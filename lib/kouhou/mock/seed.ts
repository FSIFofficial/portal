import type {
  AccountPermission,
  AppState,
  Asset,
  Comment,
  HistoryEntry,
  MetricPoint,
  Platform,
  Post,
} from '@/lib/kouhou/domain/types'
import { BASE_NOW, addHours, compactDate } from '@/lib/kouhou/domain/time'
import { STANDARD_SETTING, METRICS } from '@/lib/kouhou/domain/analytics'
import { PLATFORM_CODE } from '@/lib/kouhou/domain/labels'

const brands = [
  { id: 'b-fsif', name: 'FSIF', code: 'FSIF', color: '#1f63d6' },
  { id: 'b-cb', name: 'Cosmo Base', code: 'CB', color: '#7a4cc2' },
]

const accounts = [
  { id: 'acc-fsif-x', brandId: 'b-fsif', platform: 'x' as const, name: 'FSIF公式X', code: 'fsif_x', connection: 'connected_mock' as const, defaultApproverId: 'u-b' },
  { id: 'acc-fsif-ig', brandId: 'b-fsif', platform: 'instagram' as const, name: 'FSIF Instagram', code: 'fsif_ig', connection: 'connected_mock' as const, defaultApproverId: 'u-b' },
  { id: 'acc-cb-x', brandId: 'b-cb', platform: 'x' as const, name: 'Cosmo Base公式X', code: 'cb_x', connection: 'connected_mock' as const, defaultApproverId: 'u-b' },
  { id: 'acc-cb-ig', brandId: 'b-cb', platform: 'instagram' as const, name: 'Cosmo Base Instagram', code: 'cb_ig', connection: 'disconnected_mock' as const, defaultApproverId: 'u-a' },
  { id: 'acc-cb-dc', brandId: 'b-cb', platform: 'discord' as const, name: 'Cosmo Base Discord', code: 'cb_dc', connection: 'connected_mock' as const, defaultApproverId: 'u-b', serverId: 'srv-cb' },
]

const users = [
  { id: 'u-a', name: '管理者A', email: 'admin-a@example.com', isAdmin: true, level: 3 as const, status: 'active' as const, publishSuccessCount: 42 },
  { id: 'u-b', name: '承認者B', email: 'approver-b@example.com', isAdmin: false, level: 3 as const, status: 'active' as const, publishSuccessCount: 37 },
  { id: 'u-c', name: '担当者C', email: 'staff-c@example.com', isAdmin: false, level: 2 as const, status: 'active' as const, publishSuccessCount: 18 },
  { id: 'u-d', name: '担当者D', email: 'staff-d@example.com', isAdmin: false, level: 1 as const, status: 'active' as const, publishSuccessCount: 9 },
  { id: 'u-e', name: '閲覧者E', email: 'viewer-e@example.com', isAdmin: false, level: 1 as const, status: 'active' as const, publishSuccessCount: 0 },
  { id: 'u-f', name: '招待中F', email: 'invited-f@example.com', isAdmin: false, level: 1 as const, status: 'invited' as const, publishSuccessCount: 0 },
]

function perms(): AccountPermission[] {
  const out: AccountPermission[] = []
  for (const a of accounts) {
    const isCb = a.brandId === 'b-cb'
    out.push({ userId: 'u-a', accountId: a.id, view: true, create: true, edit: true, approve: true, levelOverride: null })
    out.push({ userId: 'u-b', accountId: a.id, view: true, create: true, edit: true, approve: true, levelOverride: null })
    out.push({
      userId: 'u-c',
      accountId: a.id,
      view: true,
      create: true,
      edit: true,
      approve: false,
      // FSIF Instagramのみレベル③として運用している例
      levelOverride: a.id === 'acc-fsif-ig' ? 3 : null,
    })
    out.push({
      userId: 'u-d',
      accountId: a.id,
      view: true,
      create: isCb || a.id === 'acc-fsif-x',
      edit: isCb || a.id === 'acc-fsif-x',
      approve: false,
      levelOverride: null,
    })
    out.push({ userId: 'u-e', accountId: a.id, view: true, create: false, edit: false, approve: false, levelOverride: null })
  }
  return out
}

const postTypes = [
  { id: 'pt-tips', name: '知っトク告知', routine: true, important: false },
  { id: 'pt-partner', name: 'パートナー連携', routine: true, important: false },
  { id: 'pt-event', name: 'イベント告知', routine: false, important: false },
  { id: 'pt-important', name: '重要なお知らせ', routine: false, important: true },
]

const TIPS_BODY = '今週の宇宙知っトクは、月探査をテーマに開催します。参加方法はコミュニティ内のお知らせをご覧ください。'

let seq = 0
type Seed = Partial<Post> & Pick<Post, 'title' | 'accountId' | 'typeId' | 'body' | 'authorId'>

function metricsFor(platform: Platform, publishedAt: string, base: number, flaw?: 'missing' | 'delayed'): MetricPoint[] {
  const growth = [1, 3.4, 4.6]
  return [1, 12, 24].map((h, i) => {
    const plannedAt = addHours(publishedAt, h)
    const values: Record<string, number | null> = {}
    for (const m of METRICS[platform]) {
      const scale = m.key === 'impressions' ? 40 : m.key === 'likes' ? 2 : m.key === 'reactions' ? 1.6 : 0.4
      values[m.key] = Math.round(base * scale * growth[i])
    }
    if (platform === 'x') values.shares = i === 0 ? 0 : values.shares
    let status: MetricPoint['status'] = 'fetched'
    let fetchedAt: string | null = addHours(plannedAt, 0.05)
    if (plannedAt > BASE_NOW) {
      status = 'pending'
      fetchedAt = null
      for (const k of Object.keys(values)) values[k] = null
    } else if (flaw === 'missing' && h === 12) {
      status = 'missing'
      fetchedAt = null
      for (const k of Object.keys(values)) values[k] = null
    } else if (flaw === 'delayed' && h === 24) {
      fetchedAt = addHours(plannedAt, 2.5)
    }
    return { offsetHours: h, plannedAt, fetchedAt, status, values }
  })
}

function mk(seed: Seed): Post {
  const acc = accounts.find((a) => a.id === seed.accountId)!
  const brand = brands.find((b) => b.id === acc.brandId)!
  seq += 1
  const initialDate = seed.scheduledAt ?? seed.publishedAt ?? null
  const id = `${brand.code}-${PLATFORM_CODE[acc.platform]}-${compactDate(initialDate)}-${String(seq).padStart(4, '0')}`
  const p: Post = {
    id,
    draftGroupId: seed.draftGroupId ?? `d-${seq}`,
    brandId: brand.id,
    channelId: acc.platform === 'discord' ? (seed.channelId ?? 'ch-news') : null,
    importantManual: false,
    assetIds: [],
    planId: null,
    assigneeId: seed.authorId,
    lastEditorId: seed.authorId,
    contentEditorsSinceApproval: [seed.authorId],
    version: 1,
    editOpen: false,
    draftDue: null,
    approvalDue: null,
    scheduledAt: null,
    publishedAt: null,
    publicUrl: null,
    mode: 'scheduled',
    designatedApproverId: null,
    content: { state: 'draft' },
    schedule: { state: 'unset', candidates: [] },
    queued: false,
    hold: null,
    pendingChange: null,
    status: 'draft',
    delivery: 'none',
    deliveryError: null,
    analytics: STANDARD_SETTING,
    metrics: [],
    createdAt: '2026-10-28T10:00',
    updatedAt: '2026-11-02T15:00',
    ...seed,
  }
  return p
}

const approvedContent = (by = 'u-b', at = '2026-11-02T16:00', v = 1) => ({
  state: 'approved' as const,
  decidedBy: by,
  decidedAt: at,
  decidedVersion: v,
})
const approvedSchedule = (at: string, by = 'u-b') => ({
  state: 'approved' as const,
  candidates: [],
  approvedFor: at,
  decidedBy: by,
  decidedAt: '2026-11-03T11:00',
  via: 'direct' as const,
})

function published(seed: Seed & { publishedAt: string }, base: number, flaw?: 'missing' | 'delayed'): Post {
  const acc = accounts.find((a) => a.id === seed.accountId)!
  return mk({
    scheduledAt: seed.publishedAt,
    content: approvedContent(),
    schedule: approvedSchedule(seed.publishedAt),
    status: 'published',
    delivery: 'sent_mock',
    publicUrl: `https://example.com/demo/${acc.code}/${seq + 1}`,
    metrics: metricsFor(acc.platform, seed.publishedAt, base, flaw),
    ...seed,
  })
}

function buildPosts(): Post[] {
  seq = 0
  const list: Post[] = [
    published({ title: 'FSIF 11月の活動予定', accountId: 'acc-fsif-x', typeId: 'pt-partner', body: 'FSIFの11月の活動予定をまとめました。各プログラムの詳細は順次お知らせします。', authorId: 'u-c', publishedAt: '2026-11-02T12:00', planId: 'pl-2' }, 30),
    mk({ title: '活動報告：秋の観測会フォト', accountId: 'acc-fsif-ig', typeId: 'pt-event', body: '先週末の観測会の様子をお届けします。ご参加いただいた皆さま、ありがとうございました。', authorId: 'u-c', mode: 'manual', publishedAt: '2026-11-03T18:12', scheduledAt: null, status: 'published', content: { state: 'manual_record' }, schedule: { state: 'manual_record', candidates: [] }, publicUrl: 'https://example.com/demo/fsif_ig/manual-1', delivery: 'none', assetIds: ['as-photo-1'] }),
    published({ title: '宇宙知っトク #44 小惑星の話', accountId: 'acc-cb-dc', typeId: 'pt-tips', channelId: 'ch-tips', body: '今週の宇宙知っトクは、小惑星の分類について紹介しました。アーカイブはコミュニティ内に掲載しています。', authorId: 'u-c', publishedAt: '2026-11-04T19:00', draftGroupId: 'd-tips44', planId: 'pl-1' }, 22),
    published({ title: '宇宙知っトク #44 小惑星の話', accountId: 'acc-cb-x', typeId: 'pt-tips', body: '今週の宇宙知っトクは小惑星の分類がテーマでした。次回もお楽しみに。', authorId: 'u-c', publishedAt: '2026-11-04T19:05', draftGroupId: 'd-tips44', planId: 'pl-1' }, 18, 'missing'),
    published({ title: 'Cosmo Base 天体写真コンテスト告知', accountId: 'acc-cb-x', typeId: 'pt-event', body: '天体写真コンテストの応募受付を開始しました。締切は11月末です。', authorId: 'u-b', publishedAt: '2026-11-05T20:00', draftGroupId: 'd-contest', planId: 'pl-3' }, 26, 'delayed'),
    mk({ title: 'Cosmo Base 天体写真コンテスト告知', accountId: 'acc-cb-ig', typeId: 'pt-event', body: '天体写真コンテストの応募受付を開始しました。プロフィールのリンクから詳細をご覧ください。', authorId: 'u-b', draftGroupId: 'd-contest', planId: 'pl-3', scheduledAt: '2026-11-05T20:00', content: approvedContent(), schedule: approvedSchedule('2026-11-05T20:00'), status: 'failed', delivery: 'error', deliveryError: '投稿先アカウントの接続が切れていました（デモ）', assetIds: ['as-photo-2'] }),
    mk({ title: 'オンライン講座 第3回の振り返り', accountId: 'acc-cb-x', typeId: 'pt-event', body: 'オンライン講座第3回の振り返りを公開しました。', authorId: 'u-d', scheduledAt: '2026-11-05T19:00', approvalDue: '2026-11-05T12:00', content: { state: 'pending', requestedAt: '2026-11-04T17:00' }, schedule: approvedSchedule('2026-11-05T19:00'), hold: { kind: 'late_approval', reason: '予定時刻までに内容承認が完了しませんでした。新しい日時を設定してください', at: '2026-11-05T19:00' } }),
    mk({ title: '宇宙知っトク #45 月探査', accountId: 'acc-cb-dc', typeId: 'pt-tips', channelId: 'ch-tips', body: TIPS_BODY, authorId: 'u-c', scheduledAt: '2026-11-06T19:00', draftGroupId: 'd-tips45', planId: 'pl-1', content: { state: 'auto_approved', decidedBy: 'u-c', decidedAt: '2026-11-04T10:00', decidedVersion: 2 }, version: 2, schedule: approvedSchedule('2026-11-06T19:00'), queued: true, delivery: 'queued', assetIds: ['as-copy-1'] }),
    mk({ title: '宇宙知っトク #45 月探査', accountId: 'acc-cb-x', typeId: 'pt-tips', body: TIPS_BODY, authorId: 'u-c', scheduledAt: '2026-11-06T19:05', draftGroupId: 'd-tips45', planId: 'pl-1', content: { state: 'auto_approved', decidedBy: 'u-c', decidedAt: '2026-11-04T10:00', decidedVersion: 1 }, schedule: approvedSchedule('2026-11-06T19:05'), queued: true, delivery: 'queued' }),
    mk({ title: '連携団体紹介：星空案内ボランティア', accountId: 'acc-fsif-x', typeId: 'pt-partner', body: '連携団体の星空案内ボランティアの皆さんをご紹介します。', authorId: 'u-b', scheduledAt: '2026-11-06T12:00', planId: 'pl-2', content: approvedContent('u-a'), schedule: approvedSchedule('2026-11-06T12:00', 'u-a'), queued: true, delivery: 'queued' }),
    mk({ title: '差し戻し：週末観望会の案内', accountId: 'acc-fsif-x', typeId: 'pt-event', body: '週末の観望会を開催します。申込は不要です。', authorId: 'u-d', scheduledAt: '2026-11-07T12:00', draftDue: '2026-11-05T18:00', content: { state: 'rejected', decidedBy: 'u-b', decidedAt: '2026-11-05T15:20', decidedVersion: 1, reason: '雨天時の扱いと集合場所を追記してください' } }),
    mk({ title: '【重要】Discordサーバーのメンテナンス', accountId: 'acc-cb-dc', typeId: 'pt-important', channelId: 'ch-news', body: '11月8日21時から約1時間、Discordサーバーのメンテナンスを行います。この間は一部機能が利用できません。', authorId: 'u-a', designatedApproverId: 'u-c', scheduledAt: '2026-11-08T21:00', approvalDue: '2026-11-07T18:00', content: { state: 'pending', requestedAt: '2026-11-05T11:00' }, schedule: { state: 'pending', candidates: [] } }),
    mk({ title: 'Instagram：観測機材の紹介', accountId: 'acc-fsif-ig', typeId: 'pt-event', body: '観測会で使用している機材を紹介します。初めての方にも扱いやすい構成です。', authorId: 'u-d', scheduledAt: '2026-11-09T18:00', approvalDue: '2026-11-08T12:00', content: { state: 'pending', requestedAt: '2026-11-05T09:30' }, schedule: approvedSchedule('2026-11-09T18:00'), assetIds: ['as-photo-1'] }),
    mk({ title: 'パートナー紹介：天文同好会', accountId: 'acc-cb-x', typeId: 'pt-partner', body: '連携している天文同好会の活動をご紹介します。月に一度の観測会に参加できます。', authorId: 'u-d', planId: 'pl-2', approvalDue: '2026-11-09T18:00', content: approvedContent('u-b', '2026-11-05T17:00'), schedule: { state: 'candidates', candidates: [
      { at: '2026-11-10T19:00', proposedBy: 'u-b', proposedAt: '2026-11-05T17:05' },
      { at: '2026-11-11T18:30', proposedBy: 'u-b', proposedAt: '2026-11-05T17:05' },
      { at: '2026-11-12T20:00', proposedBy: 'u-b', proposedAt: '2026-11-05T17:05' },
    ] } }),
    mk({ title: '宇宙知っトク #46 惑星の環', accountId: 'acc-cb-dc', typeId: 'pt-tips', channelId: 'ch-tips', body: '今週の宇宙知っトクは、惑星の環をテーマに開催します。', authorId: 'u-c', scheduledAt: '2026-11-11T19:00', planId: 'pl-1', draftDue: '2026-11-09T18:00' }),
    mk({ title: '天体写真コンテスト 中間発表', accountId: 'acc-cb-x', typeId: 'pt-event', body: '天体写真コンテストの応募作品から、中間発表として数点をご紹介します。', authorId: 'u-c', scheduledAt: '2026-11-12T20:00', approvalDue: '2026-11-05T18:00', planId: 'pl-3', content: { state: 'pending', requestedAt: '2026-11-04T12:00' }, schedule: { state: 'pending', candidates: [] } }),
    mk({ title: 'FSIF 会員向けアンケート', accountId: 'acc-fsif-x', typeId: 'pt-event', body: '今後の活動に向けたアンケートを実施しています。ご協力をお願いします。', authorId: 'u-b', scheduledAt: '2026-11-13T12:00', content: approvedContent('u-a'), schedule: approvedSchedule('2026-11-13T12:00', 'u-a'), queued: true, delivery: 'queued' }),
    mk({ title: '講師紹介：天文講座 第4回', accountId: 'acc-cb-x', typeId: 'pt-event', body: '天文講座第4回の講師をご紹介します。テーマは「星の一生」です。', authorId: 'u-c', scheduledAt: '2026-11-14T10:00', content: approvedContent(), schedule: approvedSchedule('2026-11-14T10:00'), queued: true, delivery: 'queued', planId: 'pl-3' }),
    mk({ title: 'FSIF 年次報告の予告', accountId: 'acc-fsif-x', typeId: 'pt-event', body: '今年度の活動をまとめた年次報告を準備しています。', authorId: 'u-c', editOpen: true, draftDue: '2026-11-12T18:00' }),
    mk({ title: '冬の星座ガイド（下書き）', accountId: 'acc-cb-ig', typeId: 'pt-tips', body: '冬に見やすい星座を写真付きで紹介します。', authorId: 'u-d', draftDue: '2026-11-04T18:00' }),
    mk({ title: '宇宙知っトク #47 系外惑星', accountId: 'acc-cb-dc', typeId: 'pt-tips', channelId: 'ch-tips', body: '今週の宇宙知っトクは、系外惑星の探し方をテーマに開催します。', authorId: 'u-c', scheduledAt: '2026-11-18T19:00', planId: 'pl-1', schedule: { state: 'pending', candidates: [] } }),
    mk({ title: 'Cosmo Base 公開ミーティング告知', accountId: 'acc-cb-x', typeId: 'pt-event', body: '11月22日に公開ミーティングを開催します。どなたでも参加できます。', authorId: 'u-b', scheduledAt: '2026-11-20T19:00', content: approvedContent('u-a'), schedule: { state: 'pending', candidates: [] } }),
    mk({ title: '観測会フォトまとめ', accountId: 'acc-fsif-ig', typeId: 'pt-event', body: '11月の観測会の写真をまとめました。', authorId: 'u-c', scheduledAt: '2026-11-21T18:00', content: approvedContent(), schedule: approvedSchedule('2026-11-21T18:00'), queued: true, delivery: 'queued', assetIds: ['as-photo-2'] }),
    mk({ title: 'パートナー連携：科学館との共催', accountId: 'acc-fsif-x', typeId: 'pt-partner', body: '科学館との共催プログラムについてお知らせします。', authorId: 'u-c', scheduledAt: '2026-11-25T12:00', planId: 'pl-2' }),
    mk({ title: '宇宙知っトク #48 ブラックホール', accountId: 'acc-cb-dc', typeId: 'pt-tips', channelId: 'ch-tips', body: '今週の宇宙知っトクは、ブラックホールの観測をテーマに開催します。', authorId: 'u-c', scheduledAt: '2026-11-25T19:00', planId: 'pl-1' }),
    mk({ title: '年末スターパーティー告知', accountId: 'acc-cb-ig', typeId: 'pt-event', body: '年末恒例のスターパーティーを開催します。詳細は後日発表します。', authorId: 'u-d', scheduledAt: '2026-11-27T20:00', approvalDue: '2026-11-24T18:00', content: { state: 'pending', requestedAt: '2026-11-05T19:00' }, schedule: { state: 'pending', candidates: [] }, channelId: null }),
    mk({ title: 'Discordイベントチャンネル案内', accountId: 'acc-cb-dc', typeId: 'pt-event', channelId: 'ch-event', body: 'イベントチャンネルでは今後の催しを随時お知らせします。', authorId: 'u-b', scheduledAt: '2026-11-28T12:00' }),
    mk({ title: '11月の活動まとめ', accountId: 'acc-fsif-x', typeId: 'pt-event', body: '11月の活動をまとめてお届けします。', authorId: 'u-c', scheduledAt: '2026-11-30T12:00' }),
    published({ title: 'Cosmo Base 11月のスケジュール', accountId: 'acc-cb-x', typeId: 'pt-event', body: 'Cosmo Baseの11月のスケジュールを公開しました。', authorId: 'u-b', publishedAt: '2026-11-01T12:00' }, 20),
    published({ title: '秋の観測会 参加者募集', accountId: 'acc-fsif-ig', typeId: 'pt-event', body: '秋の観測会の参加者を募集しています。', authorId: 'u-c', publishedAt: '2026-10-30T18:00' }, 15),
  ]
  for (const p of list) {
    if (p.status !== 'published' && p.status !== 'failed') {
      p.status = p.hold ? 'held' : p.queued ? 'scheduled' : p.content.state === 'rejected' ? 'rejected' : p.content.state === 'pending' || p.schedule.state === 'pending' ? 'review' : 'draft'
    }
    if (p.status === 'published' && !p.publishedAt) p.publishedAt = p.scheduledAt
  }
  return list
}

function buildHistory(posts: Post[]): HistoryEntry[] {
  const h: HistoryEntry[] = []
  posts.forEach((p, i) => {
    h.push({ id: `h-${i}-c`, postId: p.id, at: p.createdAt, actorId: p.authorId, kind: p.mode === 'manual' ? 'manual_recorded' : 'created', summary: p.mode === 'manual' ? '手動投稿を記録しました' : '原稿を作成しました', version: 1 })
    if (p.content.state === 'approved' || p.content.state === 'auto_approved') {
      h.push({ id: `h-${i}-a`, postId: p.id, at: p.content.decidedAt ?? p.updatedAt, actorId: p.content.decidedBy ?? 'system', kind: p.content.state === 'approved' ? 'content_approved' : 'content_auto_approved', summary: p.content.state === 'approved' ? `内容 v${p.content.decidedVersion} を承認` : `内容 v${p.content.decidedVersion} を自動承認（種類・レベルによる）`, version: p.content.decidedVersion ?? 1 })
    }
    if (p.content.state === 'rejected') {
      h.push({ id: `h-${i}-r`, postId: p.id, at: p.content.decidedAt!, actorId: p.content.decidedBy!, kind: 'content_rejected', summary: `差し戻し：${p.content.reason}`, version: 1 })
    }
    if (p.schedule.state === 'candidates') {
      h.push({ id: `h-${i}-cand`, postId: p.id, at: p.schedule.candidates[0].proposedAt, actorId: p.schedule.candidates[0].proposedBy, kind: 'candidates_proposed', summary: `候補日時を${p.schedule.candidates.length}件提示`, version: p.version })
    }
    if (p.schedule.state === 'approved' && p.mode !== 'manual') {
      h.push({ id: `h-${i}-s`, postId: p.id, at: p.schedule.decidedAt!, actorId: p.schedule.decidedBy!, kind: 'schedule_approved', summary: `日時 ${p.schedule.approvedFor?.replace('T', ' ')} を承認`, version: p.version })
    }
    if (p.queued || p.status === 'published') {
      h.push({ id: `h-${i}-q`, postId: p.id, at: '2026-11-03T12:00', actorId: p.authorId, kind: 'scheduled', summary: '予約を確定しました', version: p.version })
    }
    if (p.status === 'published' && p.mode !== 'manual') {
      h.push({ id: `h-${i}-p`, postId: p.id, at: p.publishedAt!, actorId: 'system', kind: 'published', summary: '公開しました（デモ配信）', version: p.version })
    }
    if (p.status === 'failed') {
      h.push({ id: `h-${i}-f`, postId: p.id, at: p.scheduledAt!, actorId: 'system', kind: 'failed', summary: `投稿失敗：${p.deliveryError}`, version: p.version })
    }
    if (p.hold) {
      h.push({ id: `h-${i}-hold`, postId: p.id, at: p.hold.at, actorId: 'system', kind: 'held', summary: `保留：${p.hold.reason}`, version: p.version })
    }
  })
  return h
}

function buildComments(posts: Post[]): Comment[] {
  const byTitle = (t: string) => posts.find((p) => p.title.startsWith(t))!.id
  return [
    { id: 'cm-1', targetType: 'post', targetId: byTitle('パートナー紹介：天文同好会'), parentId: null, authorId: 'u-b', body: '内容は問題ありません。候補日時を3つ提示しました。', createdAt: '2026-11-05T17:06', resolved: false, category: 'schedule' },
    { id: 'cm-2', targetType: 'post', targetId: byTitle('パートナー紹介：天文同好会'), parentId: 'cm-1', authorId: 'u-d', body: '@承認者B ありがとうございます。先方と調整して選びます。', createdAt: '2026-11-05T18:10', resolved: false, category: 'schedule' },
    { id: 'cm-3', targetType: 'post', targetId: byTitle('差し戻し'), parentId: null, authorId: 'u-b', body: '集合場所の地図リンクも追加できると親切です。', createdAt: '2026-11-05T15:22', resolved: false, category: 'content' },
    { id: 'cm-4', targetType: 'post', targetId: byTitle('【重要】'), parentId: null, authorId: 'u-a', body: '@担当者C 重要投稿のため確認をお願いします。', createdAt: '2026-11-05T11:02', resolved: false, category: 'content' },
    { id: 'cm-5', targetType: 'plan', targetId: 'pl-1', parentId: null, authorId: 'u-c', body: '#47以降のテーマ案を企画資料に追記しました。', createdAt: '2026-11-04T09:00', resolved: true, category: null },
    { id: 'cm-6', targetType: 'asset', targetId: 'as-bg-1', parentId: null, authorId: 'u-b', body: 'タイトル文字は上部1/3に収めると読みやすいです。', createdAt: '2026-11-02T13:00', resolved: false, category: null },
  ]
}

const assets: Asset[] = [
  { id: 'as-bg-1', kind: 'background', name: '知っトク告知 背景（ネイビー）', brandId: 'b-cb', purpose: '知っトク告知', src: '/kouhou/templates/bg-tips.svg', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-b', updatedAt: '2026-11-01T10:00' },
  { id: 'as-bg-2', kind: 'background', name: 'イベント告知 背景（ライト）', brandId: 'b-fsif', purpose: 'イベント告知', src: '/kouhou/templates/bg-event.svg', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-a', updatedAt: '2026-10-28T15:00' },
  { id: 'as-bg-3', kind: 'background', name: 'お知らせ 背景（グリッド）', brandId: 'b-fsif', purpose: 'お知らせ', src: '/kouhou/templates/bg-notice.svg', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-a', updatedAt: '2026-10-20T09:00' },
  { id: 'as-photo-1', kind: 'image', name: '観測会の様子', brandId: 'b-fsif', purpose: '活動報告', src: '/kouhou/assets/observation.png', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-c', updatedAt: '2026-11-03T17:00' },
  { id: 'as-photo-2', kind: 'image', name: '天体写真コンテスト 告知写真', brandId: 'b-cb', purpose: 'イベント告知', src: '/kouhou/assets/telescope.png', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-b', updatedAt: '2026-11-04T12:00' },
  {
    id: 'as-copy-1', kind: 'image', name: '知っトク #45 告知画像', brandId: 'b-cb', purpose: '知っトク告知', src: null, text: null, sourceAssetId: 'as-bg-1', updatedBy: 'u-c', updatedAt: '2026-11-04T09:40',
    edit: { backgroundAssetId: 'as-bg-1', layers: [
      { id: 'l1', text: '宇宙知っトク #45', x: 50, y: 30, fontSize: 84, color: '#ffffff', font: 'sans', align: 'center', weight: 700 },
      { id: 'l2', text: 'テーマ：月探査', x: 50, y: 48, fontSize: 56, color: '#cfe0ff', font: 'sans', align: 'center', weight: 400 },
      { id: 'l3', text: '11/6(金) 19:00〜', x: 50, y: 78, fontSize: 44, color: '#ffffff', font: 'mono', align: 'center', weight: 400 },
    ] },
  },
  { id: 'as-logo-1', kind: 'logo', name: 'FSIF ロゴ（横組み）', brandId: 'b-fsif', purpose: 'ロゴ', src: '/kouhou/templates/logo-fsif.svg', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-a', updatedAt: '2026-09-01T10:00' },
  { id: 'as-logo-2', kind: 'logo', name: 'Cosmo Base ロゴ', brandId: 'b-cb', purpose: 'ロゴ', src: '/kouhou/templates/logo-cb.svg', text: null, edit: null, sourceAssetId: null, updatedBy: 'u-a', updatedAt: '2026-09-01T10:00' },
  { id: 'as-video-1', kind: 'video', name: '観測会ダイジェスト（動画）', brandId: 'b-fsif', purpose: '活動報告', src: null, text: null, edit: null, sourceAssetId: null, updatedBy: 'u-c', updatedAt: '2026-11-03T20:00' },
  { id: 'as-text-1', kind: 'text', name: '知っトク告知 文章テンプレート', brandId: 'b-cb', purpose: '知っトク告知', src: null, text: '今週の宇宙知っトクは、{テーマ}をテーマに開催します。参加方法はコミュニティ内のお知らせをご覧ください。', edit: null, sourceAssetId: null, updatedBy: 'u-c', updatedAt: '2026-10-25T10:00' },
  { id: 'as-text-2', kind: 'text', name: 'イベント告知 文章テンプレート', brandId: 'b-fsif', purpose: 'イベント告知', src: null, text: '{日付}に{イベント名}を開催します。詳細と申込方法は{URL}をご覧ください。', edit: null, sourceAssetId: null, updatedBy: 'u-a', updatedAt: '2026-10-25T10:00' },
]

export function createSeed(): AppState {
  const posts = buildPosts()
  return {
    now: BASE_NOW,
    currentUserId: 'u-a',
    brands,
    accounts,
    servers: [{ id: 'srv-cb', brandId: 'b-cb', name: 'Cosmo Base コミュニティ' }],
    channels: [
      { id: 'ch-news', serverId: 'srv-cb', name: 'お知らせ', postable: true },
      { id: 'ch-tips', serverId: 'srv-cb', name: '宇宙知っトク', postable: true },
      { id: 'ch-event', serverId: 'srv-cb', name: 'イベント', postable: true },
      { id: 'ch-notify', serverId: 'srv-cb', name: '広報管理通知', postable: false },
    ],
    users,
    permissions: perms(),
    postTypes,
    posts,
    comments: buildComments(posts),
    history: buildHistory(posts),
    plans: [
      { id: 'pl-1', title: '宇宙知っトク11月企画', brandId: 'b-cb', description: '毎週の宇宙知っトクのテーマと告知文を管理します。', status: 'production', ownerId: 'u-c', dueDate: '2026-11-30', links: [{ id: 'lk-1', label: 'テーマ案シート', url: 'https://example.com/demo/tips-themes' }] },
      { id: 'pl-2', title: 'パートナー紹介', brandId: 'b-fsif', description: '連携団体を月2回紹介する企画。先方確認済みの素材のみ使用。', status: 'review', ownerId: 'u-b', dueDate: '2026-11-20', links: [] },
      { id: 'pl-3', title: '宇宙イベント告知', brandId: 'b-cb', description: '天体写真コンテストと公開ミーティングの告知計画。', status: 'production', ownerId: 'u-b', dueDate: '2026-11-28', links: [{ id: 'lk-2', label: '応募要項（下書き）', url: 'https://example.com/demo/contest' }] },
      { id: 'pl-4', title: '冬休み特別講座', brandId: 'b-fsif', description: '12月の特別講座の告知アイデア。', status: 'idea', ownerId: 'u-d', dueDate: null, links: [] },
      { id: 'pl-5', title: '10月 観測会レポート', brandId: 'b-fsif', description: '10月観測会の写真と振り返り。', status: 'done', ownerId: 'u-c', dueDate: '2026-10-31', links: [] },
    ],
    events: [
      { id: 'ev-1', title: '宇宙知っトク #45 開催', brandId: 'b-cb', at: '2026-11-06T20:00' },
      { id: 'ev-2', title: '週末観望会', brandId: 'b-fsif', at: '2026-11-08T18:00' },
      { id: 'ev-3', title: '天文講座 第4回', brandId: 'b-cb', at: '2026-11-15T14:00' },
      { id: 'ev-4', title: 'Cosmo Base 公開ミーティング', brandId: 'b-cb', at: '2026-11-22T19:00' },
      { id: 'ev-5', title: 'コンテスト応募締切', brandId: 'b-cb', at: '2026-11-30T23:59' },
    ],
    assets,
    recurrences: [
      { id: 'rc-1', name: '宇宙知っトク 毎週水曜19時', accountIds: ['acc-cb-dc'], channelId: 'ch-tips', typeId: 'pt-tips', weekdays: [3], time: '19:00', startDate: '2026-11-18', endDate: '2026-12-30', count: null, mode: 'template', templateText: '今週の宇宙知っトクは、{テーマ}をテーマに開催します。参加方法はコミュニティ内のお知らせをご覧ください。', generatedPostIds: [] },
    ],
    stops: [],
    notifications: [
      { id: 'nt-1', at: '2026-11-05T17:05', channelId: 'ch-notify', mentions: ['@広報チーム'], text: '【候補日時の提示】パートナー紹介：天文同好会 に候補日時が3件提示されました（デモ・未送信）', postId: null },
      { id: 'nt-2', at: '2026-11-05T20:01', channelId: 'ch-notify', mentions: ['@広報チーム'], text: '【投稿失敗】Cosmo Base 天体写真コンテスト告知（Instagram）の投稿に失敗しました（デモ・未送信）', postId: null },
    ],
    settings: { notifyChannelId: 'ch-notify', notifyMentions: ['@広報チーム'], promotionThreshold: 20 },
    demo: { conflictOnNextSave: false, failNextDelivery: false },
    seq,
  }
}
