/**
 * 業務操作。すべて (state, ...) => Result の純粋な形で、モック状態のドラフトを変更する。
 * API接続時はこのファイルの各関数をAPI呼び出しに置き換える。
 */
import type { AppState, HistoryKind, JstDateTime, Post, User } from './types'
import {
  canApproveContent,
  canApprovePendingChange,
  canApproveSchedule,
  canCreate,
  canDecideSchedule,
  canEditDraft,
  canRequestAfterSchedule,
  canSchedule,
  canSelectCandidate,
  canToggleEditOpen,
  contentRequirement,
  deriveStatus,
  getAccount,
  getUser,
  isStopped,
  approversFor,
} from './rules'
import { compactDate, formatDateTime, isBefore, isValidDateTime, toMinutes } from './time'
import { PLATFORM_CODE } from './labels'
import { METRICS, STANDARD_SETTING, planCheckpoints, checkpointTime } from './analytics'

export type Result = { ok: true; message?: string; id?: string; ids?: string[] } | { ok: false; message: string; conflict?: boolean }

const ok = (message?: string, extra?: { id?: string; ids?: string[] }): Result => ({ ok: true, message, ...extra })
const fail = (message: string, conflict = false): Result => ({ ok: false, message, conflict })

export const DEMO_STOP_CODE = 'DEMO-STOP'

function me(s: AppState): User | undefined {
  return getUser(s, s.currentUserId)
}

function uid(s: AppState, prefix: string) {
  s.seq += 1
  return `${prefix}-${s.seq}`
}

function findPost(s: AppState, id: string) {
  return s.posts.find((p) => p.id === id)
}

function log(s: AppState, post: Post, kind: HistoryKind, summary: string, extra?: { before?: string; after?: string; actor?: string }) {
  s.history.push({
    id: uid(s, 'h'),
    postId: post.id,
    at: s.now,
    actorId: extra?.actor ?? s.currentUserId ?? 'system',
    kind,
    summary,
    version: post.version,
    before: extra?.before,
    after: extra?.after,
  })
}

function notify(s: AppState, text: string, postId: string | null) {
  s.notifications.unshift({
    id: uid(s, 'nt'),
    at: s.now,
    channelId: s.settings.notifyChannelId,
    mentions: s.settings.notifyMentions,
    text: `${text}（デモ・未送信）`,
    postId,
  })
}

function touch(s: AppState, post: Post) {
  post.updatedAt = s.now
  post.status = deriveStatus(post)
}

export function makePostId(s: AppState, accountId: string, initialDate: JstDateTime | null) {
  const acc = getAccount(s, accountId)!
  const brand = s.brands.find((b) => b.id === acc.brandId)!
  s.seq += 1
  return `${brand.code}-${PLATFORM_CODE[acc.platform]}-${compactDate(initialDate)}-${String(s.seq).padStart(4, '0')}`
}

export interface DraftFields {
  title: string
  typeId: string
  importantManual: boolean
  planId: string | null
  assigneeId: string
  designatedApproverId: string | null
  draftDue: JstDateTime | null
  approvalDue: JstDateTime | null
  scheduledAt: JstDateTime | null
}

export interface UnitFields {
  accountId: string
  channelId: string | null
  body: string
  assetIds: string[]
}

function validateFields(s: AppState, f: DraftFields, units: UnitFields[]): string | null {
  if (!f.title.trim()) return '管理用タイトルを入力してください'
  if (!units.length) return '投稿先を1つ以上選択してください'
  for (const u of units) {
    const acc = getAccount(s, u.accountId)
    if (!acc) return '投稿先が見つかりません'
    if (!u.body.trim() && !u.assetIds.length) return `${acc.name}：本文または素材を入力してください`
    if (acc.platform === 'discord' && !u.channelId) return `${acc.name}：チャンネルを選択してください`
  }
  if (f.scheduledAt && !isValidDateTime(f.scheduledAt)) return '予定日時の形式が正しくありません'
  return null
}

export function createPosts(s: AppState, f: DraftFields, units: UnitFields[]): Result {
  const user = me(s)
  const err = validateFields(s, f, units)
  if (err) return fail(err)
  for (const u of units) {
    const v = canCreate(s, user, u.accountId)
    if (!v.ok) return fail(`${getAccount(s, u.accountId)?.name}：${v.reason}`)
  }
  if (f.scheduledAt && !isBefore(s.now, f.scheduledAt)) return fail('予定日時は基準日時より後にしてください')
  const group = uid(s, 'd')
  const ids: string[] = []
  for (const u of units) {
    const acc = getAccount(s, u.accountId)!
    const post: Post = {
      id: makePostId(s, u.accountId, f.scheduledAt),
      draftGroupId: group,
      title: f.title.trim(),
      brandId: acc.brandId,
      accountId: u.accountId,
      channelId: acc.platform === 'discord' ? u.channelId : null,
      typeId: f.typeId,
      importantManual: f.importantManual,
      body: u.body,
      assetIds: u.assetIds,
      planId: f.planId,
      authorId: user!.id,
      assigneeId: f.assigneeId || user!.id,
      lastEditorId: user!.id,
      contentEditorsSinceApproval: [user!.id],
      version: 1,
      editOpen: false,
      draftDue: f.draftDue,
      approvalDue: f.approvalDue,
      scheduledAt: f.scheduledAt,
      publishedAt: null,
      publicUrl: null,
      mode: 'scheduled',
      designatedApproverId: f.designatedApproverId,
      content: { state: 'draft' },
      schedule: { state: f.scheduledAt ? 'pending' : 'unset', candidates: [] },
      queued: false,
      hold: null,
      pendingChange: null,
      status: 'draft',
      delivery: 'none',
      deliveryError: null,
      analytics: structuredClone(STANDARD_SETTING),
      metrics: [],
      createdAt: s.now,
      updatedAt: s.now,
    }
    touch(s, post)
    s.posts.push(post)
    log(s, post, 'created', units.length > 1 ? `原稿を作成（${units.length}件の投稿先に展開）` : '原稿を作成しました')
    if (f.scheduledAt) log(s, post, 'schedule_requested', `日時 ${formatDateTime(f.scheduledAt)} の承認を依頼`)
    ids.push(post.id)
  }
  return ok(`${ids.length}件の公開単位を作成しました`, { id: ids[0], ids })
}

export interface EditPatch extends Partial<DraftFields> {
  body?: string
  assetIds?: string[]
  channelId?: string | null
}

/** 他ユーザーの保存を再現（デモの競合再現用） */
function simulateExternalUpdate(s: AppState, post: Post) {
  const other = s.users.find((u) => u.id !== s.currentUserId && u.level === 3 && u.status === 'active')!
  post.body = `${post.body}（表記を修正）`
  post.version += 1
  post.lastEditorId = other.id
  post.editOpen = false
  if (!post.contentEditorsSinceApproval.includes(other.id)) post.contentEditorsSinceApproval.push(other.id)
  if (post.content.state === 'approved' || post.content.state === 'auto_approved') post.content = { state: 'draft' }
  log(s, post, 'body_changed', `${other.name}が本文を保存（デモで再現）`, { actor: other.id })
  touch(s, post)
}

export function savePost(s: AppState, id: string, patch: EditPatch, baseVersion: number): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post || !user) return fail('投稿が見つかりません')
  const v = canEditDraft(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (s.demo.conflictOnNextSave) {
    s.demo.conflictOnNextSave = false
    simulateExternalUpdate(s, post)
  }
  if (post.version !== baseVersion) return fail('他のユーザーが更新しました。最新版を確認してください', true)

  const nextSchedule = patch.scheduledAt !== undefined ? patch.scheduledAt : post.scheduledAt
  if (nextSchedule && !isValidDateTime(nextSchedule)) return fail('予定日時の形式が正しくありません')
  if (nextSchedule && nextSchedule !== post.scheduledAt && !isBefore(s.now, nextSchedule)) return fail('過去の日時は設定できません')
  const nextBody = patch.body ?? post.body
  const nextAssets = patch.assetIds ?? post.assetIds
  if (!nextBody.trim() && !nextAssets.length) return fail('本文または素材を入力してください')
  if (patch.title !== undefined && !patch.title.trim()) return fail('管理用タイトルを入力してください')

  const contentChanged =
    nextBody !== post.body ||
    JSON.stringify(nextAssets) !== JSON.stringify(post.assetIds) ||
    (patch.typeId !== undefined && patch.typeId !== post.typeId) ||
    (patch.importantManual !== undefined && patch.importantManual !== post.importantManual) ||
    (patch.channelId !== undefined && patch.channelId !== post.channelId)
  const scheduleChanged = nextSchedule !== post.scheduledAt
  const wasQueued = post.queued

  const prevEditor = post.lastEditorId
  post.version += 1
  if (prevEditor !== user.id) {
    post.editOpen = false
    log(s, post, 'editor_handover', `最終編集者が ${getUser(s, prevEditor)?.name} から ${user.name} に交代。編集許可は自動でOFF`)
  }
  post.lastEditorId = user.id

  if (contentChanged) {
    if (nextBody !== post.body) log(s, post, 'body_changed', '本文を変更', { before: post.body, after: nextBody })
    if (JSON.stringify(nextAssets) !== JSON.stringify(post.assetIds)) log(s, post, 'asset_changed', `素材を変更（${post.assetIds.length}件 → ${nextAssets.length}件）`)
    post.body = nextBody
    post.assetIds = nextAssets
    if (patch.typeId !== undefined) post.typeId = patch.typeId
    if (patch.importantManual !== undefined) post.importantManual = patch.importantManual
    if (patch.channelId !== undefined) post.channelId = patch.channelId
    if (!post.contentEditorsSinceApproval.includes(user.id)) post.contentEditorsSinceApproval.push(user.id)
    if (wasQueued || post.hold?.kind === 'pending_change') {
      post.content = { state: 'pending', requestedAt: s.now }
    } else if (post.content.state !== 'draft') {
      post.content = { state: 'draft', reason: '内容が変更されたため再判定が必要です' }
    }
  }

  if (scheduleChanged) {
    log(s, post, 'schedule_changed', '予定日時を変更（IDは変わりません）', { before: formatDateTime(post.scheduledAt), after: formatDateTime(nextSchedule) })
    post.scheduledAt = nextSchedule
    const cand = nextSchedule ? post.schedule.candidates.find((c) => c.at === nextSchedule) : undefined
    if (!nextSchedule) {
      post.schedule = { ...post.schedule, state: post.schedule.candidates.length ? 'candidates' : 'unset', approvedFor: undefined }
    } else if (cand && !wasQueued) {
      post.schedule = { ...post.schedule, state: 'approved', approvedFor: nextSchedule, decidedBy: cand.proposedBy, decidedAt: s.now, via: 'candidate' }
      log(s, post, 'schedule_selected', `候補日時 ${formatDateTime(nextSchedule)} を選択し日時承認が成立`)
    } else {
      post.schedule = { ...post.schedule, state: 'pending', approvedFor: post.schedule.approvedFor }
      log(s, post, 'schedule_requested', `日時 ${formatDateTime(nextSchedule)} の承認を依頼`)
    }
  }

  if (patch.title !== undefined) post.title = patch.title.trim()
  if (patch.planId !== undefined) post.planId = patch.planId
  if (patch.assigneeId !== undefined) post.assigneeId = patch.assigneeId
  if (patch.designatedApproverId !== undefined) post.designatedApproverId = patch.designatedApproverId
  if (patch.draftDue !== undefined) post.draftDue = patch.draftDue
  if (patch.approvalDue !== undefined) post.approvalDue = patch.approvalDue

  if ((contentChanged || scheduleChanged) && (wasQueued || post.hold?.kind === 'pending_change')) {
    post.queued = false
    post.delivery = 'none'
    post.pendingChange = { kind: 'edit', requestedBy: user.id, requestedAt: s.now, reason: '予約後の変更', fromVersion: baseVersion }
    post.hold = { kind: 'pending_change', reason: '予約後の変更が承認待ちのため公開を保留しています', at: s.now }
    log(s, post, 'held', '予約後の変更を保存したため公開を保留。再承認待ち')
    notify(s, `【再承認依頼】${post.title} の予約後変更が保存されました`, post.id)
  }

  log(s, post, 'saved', `v${post.version} を保存`)
  touch(s, post)
  return ok(`v${post.version} を保存しました`)
}

export function toggleEditOpen(s: AppState, id: string, value: boolean): Result {
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canToggleEditOpen(me(s), post)
  if (!v.ok) return fail(v.reason!)
  post.editOpen = value
  log(s, post, 'edit_open_changed', value ? '他の人の編集を許可' : '他の人の編集許可を解除')
  touch(s, post)
  return ok(value ? '他の人の編集を許可しました' : '編集許可を解除しました')
}

export function completeContent(s: AppState, id: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post || !user) return fail('投稿が見つかりません')
  const v = canEditDraft(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (post.content.state !== 'draft' && post.content.state !== 'rejected') return fail('内容はすでに完了済みです')
  const req = contentRequirement(s, post)
  if (req === 'auto') {
    post.content = { state: 'auto_approved', decidedBy: user.id, decidedAt: s.now, decidedVersion: post.version }
    post.contentEditorsSinceApproval = []
    log(s, post, 'content_auto_approved', `内容 v${post.version} を自動承認（種類・レベルによる）`)
    touch(s, post)
    return ok('内容を完了し、自動承認されました')
  }
  post.content = { state: 'pending', requestedAt: s.now }
  log(s, post, 'content_completed', `内容 v${post.version} の承認を依頼`)
  notify(s, `【内容承認依頼】${post.title}`, post.id)
  touch(s, post)
  return ok(req === 'important' ? '重要投稿として指定承認者へ承認を依頼しました' : '内容承認を依頼しました')
}

function resolvePendingEditIfDone(s: AppState, post: Post) {
  if (post.pendingChange?.kind === 'edit' && post.content.state !== 'pending' && post.schedule.state !== 'pending') {
    post.pendingChange = null
    post.hold = { kind: 'reschedule', reason: '変更は承認済みです。内容と日時を確認して予約を確定してください', at: s.now }
  }
}

export function approveContent(s: AppState, id: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canApproveContent(s, user, post)
  if (!v.ok) return fail(v.reason!)
  post.content = { state: 'approved', decidedBy: user!.id, decidedAt: s.now, decidedVersion: post.version }
  post.contentEditorsSinceApproval = []
  log(s, post, 'content_approved', `内容 v${post.version} を承認`)
  resolvePendingEditIfDone(s, post)
  touch(s, post)
  return ok('内容を承認しました（日時承認は別途必要です）')
}

export function rejectContent(s: AppState, id: string, reason: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canApproveContent(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (!reason.trim()) return fail('差し戻し理由を入力してください')
  post.content = { state: 'rejected', decidedBy: user!.id, decidedAt: s.now, decidedVersion: post.version, reason: reason.trim() }
  if (post.pendingChange?.kind === 'edit') post.pendingChange = null
  log(s, post, 'content_rejected', `差し戻し：${reason.trim()}`)
  notify(s, `【差し戻し】${post.title}`, post.id)
  touch(s, post)
  return ok('差し戻しました')
}

export function proposeCandidates(s: AppState, id: string, times: string[]): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canDecideSchedule(s, user, post)
  if (!v.ok) return fail(v.reason!)
  const clean = [...new Set(times.filter(Boolean))]
  if (!clean.length) return fail('候補日時を1つ以上入力してください')
  if (clean.some((t) => !isValidDateTime(t))) return fail('日時の形式が正しくありません')
  if (clean.some((t) => !isBefore(s.now, t))) return fail('過去���日時は候補にできません')
  for (const t of clean) {
    if (!post.schedule.candidates.some((c) => c.at === t)) post.schedule.candidates.push({ at: t, proposedBy: user!.id, proposedAt: s.now })
  }
  post.schedule.candidates.sort((a, b) => toMinutes(a.at) - toMinutes(b.at))
  if (post.schedule.state !== 'approved') post.schedule.state = 'candidates'
  log(s, post, 'candidates_proposed', `候補日時を提示：${clean.map(formatDateTime).join('、')}`)
  notify(s, `【候補日時の提示】${post.title}`, post.id)
  touch(s, post)
  return ok(`候補日時を${clean.length}件提示しました`)
}

export function selectCandidate(s: AppState, id: string, at: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post || !user) return fail('投稿が見つかりません')
  if (post.queued) return fail('予約後の日時変更は、原稿の保存で変更申請してください')
  const v = canSelectCandidate(s, user, post, at)
  if (!v.ok) return fail(v.reason!)
  const cand = post.schedule.candidates.find((c) => c.at === at)!
  const before = post.scheduledAt
  post.scheduledAt = at
  post.schedule = { ...post.schedule, state: 'approved', approvedFor: at, decidedBy: cand.proposedBy, decidedAt: s.now, via: 'candidate' }
  log(s, post, 'schedule_selected', `候補日時 ${formatDateTime(at)} を選択し日時承認が成立`, { before: formatDateTime(before), after: formatDateTime(at) })
  notify(s, `【日時確定】${post.title} は ${formatDateTime(at)} に決まりました。宛先：${getUser(s, cand.proposedBy)?.name}`, post.id)
  resolvePendingEditIfDone(s, post)
  touch(s, post)
  return ok('日時承認が成立しました。確定通知を承認者へ送信予定として記録しました')
}

export function approveSchedule(s: AppState, id: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canApproveSchedule(s, user, post)
  if (!v.ok) return fail(v.reason!)
  post.schedule = { ...post.schedule, state: 'approved', approvedFor: post.scheduledAt!, decidedBy: user!.id, decidedAt: s.now, via: 'direct' }
  log(s, post, 'schedule_approved', `日時 ${formatDateTime(post.scheduledAt)} を承認`)
  resolvePendingEditIfDone(s, post)
  touch(s, post)
  return ok('日時を承認しました')
}

export function rejectSchedule(s: AppState, id: string, reason: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canDecideSchedule(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (post.schedule.state !== 'pending') return fail('日時承認の依頼がありません')
  if (!reason.trim()) return fail('差し戻し理由を入力してください')
  post.schedule = { ...post.schedule, state: 'rejected', decidedBy: user!.id, decidedAt: s.now, reason: reason.trim() }
  log(s, post, 'schedule_rejected', `日時を差し戻し：${reason.trim()}`)
  touch(s, post)
  return ok('日時を差し戻しました')
}

export function confirmSchedule(s: AppState, id: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canSchedule(s, user, post)
  if (!v.ok) return fail(v.reason!)
  post.queued = true
  post.hold = null
  post.delivery = 'queued'
  post.deliveryError = null
  if (post.status === 'failed') post.status = 'draft'
  log(s, post, 'scheduled', `${formatDateTime(post.scheduledAt)} に予約を確定（デモ・実送信なし）`)
  touch(s, post)
  return ok('予約を確定しました（デモのため実際には送信されません）')
}

export function requestCancel(s: AppState, id: string, reason: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canRequestAfterSchedule(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (!reason.trim()) return fail('取り消し理由を入力してください')
  post.queued = false
  post.delivery = 'none'
  post.pendingChange = { kind: 'cancel', requestedBy: user!.id, requestedAt: s.now, reason: reason.trim(), fromVersion: post.version }
  post.hold = { kind: 'pending_change', reason: '取り消し申請が承認待ちのため保留しています', at: s.now }
  log(s, post, 'cancel_requested', `取り消しを申請：${reason.trim()}`)
  notify(s, `【取り消し申請】${post.title}`, post.id)
  touch(s, post)
  return ok('取り消しを申請しました。承認まで公開は保留されます')
}

export function approveCancel(s: AppState, id: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canApprovePendingChange(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (post.pendingChange?.kind !== 'cancel') return fail('取り消し申請ではありません')
  post.pendingChange = null
  post.hold = null
  post.queued = false
  post.status = 'cancelled'
  log(s, post, 'cancelled', '取り消しを承認しました')
  touch(s, post)
  return ok('取り消しを承認しました')
}

export function rejectCancel(s: AppState, id: string, reason: string): Result {
  const user = me(s)
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const v = canApprovePendingChange(s, user, post)
  if (!v.ok) return fail(v.reason!)
  if (!reason.trim()) return fail('理由を入力してください')
  post.pendingChange = null
  post.hold = { kind: 'reschedule', reason: '取り消し申請は却下されました。予約を確定し直してください', at: s.now }
  log(s, post, 'change_rejected', `取り消し申請を却下：${reason.trim()}`)
  touch(s, post)
  return ok('取り消し申請を却下しました。再度「予約を確定」で予約に戻せます')
}

export interface ManualInput {
  title: string
  accountId: string
  channelId: string | null
  typeId: string
  body: string
  assetIds: string[]
  publishedAt: string
  publicUrl: string
}

export function recordManual(s: AppState, input: ManualInput): Result {
  const user = me(s)
  const v = canCreate(s, user, input.accountId)
  if (!v.ok) return fail(v.reason!)
  if (!input.title.trim()) return fail('管理用タイトルを入力してください')
  if (!input.body.trim() && !input.assetIds.length) return fail('本文または素材を入力してください')
  if (!isValidDateTime(input.publishedAt)) return fail('実公開日時を入力してください')
  if (isBefore(s.now, input.publishedAt)) return fail('実公開日時は基準日時以前にしてください')
  if (!/^https?:\/\/\S+$/.test(input.publicUrl)) return fail('公開URLを http(s):// から入力してください')
  const acc = getAccount(s, input.accountId)!
  if (acc.platform === 'discord' && !input.channelId) return fail('チャンネルを選択してください')
  const post: Post = {
    id: makePostId(s, input.accountId, input.publishedAt),
    draftGroupId: uid(s, 'd'),
    title: input.title.trim(),
    brandId: acc.brandId,
    accountId: acc.id,
    channelId: acc.platform === 'discord' ? input.channelId : null,
    typeId: input.typeId,
    importantManual: false,
    body: input.body,
    assetIds: input.assetIds,
    planId: null,
    authorId: user!.id,
    assigneeId: user!.id,
    lastEditorId: user!.id,
    contentEditorsSinceApproval: [],
    version: 1,
    editOpen: false,
    draftDue: null,
    approvalDue: null,
    scheduledAt: null,
    publishedAt: input.publishedAt,
    publicUrl: input.publicUrl,
    mode: 'manual',
    designatedApproverId: null,
    content: { state: 'manual_record' },
    schedule: { state: 'manual_record', candidates: [] },
    queued: false,
    hold: null,
    pendingChange: null,
    status: 'published',
    delivery: 'none',
    deliveryError: null,
    analytics: structuredClone(STANDARD_SETTING),
    metrics: [],
    createdAt: s.now,
    updatedAt: s.now,
  }
  s.posts.push(post)
  log(s, post, 'manual_recorded', '手動投稿を記録（事前承認なし）')
  return ok('手動投稿を記録しました', { id: post.id })
}

export function addComment(
  s: AppState,
  target: { type: 'post' | 'plan' | 'asset'; id: string },
  body: string,
  parentId: string | null,
  category: 'content' | 'schedule' | null,
): Result {
  const user = me(s)
  if (!user || user.status !== 'active') return fail('コメントできません')
  if (!body.trim()) return fail('コメントを入力してください')
  s.comments.push({
    id: uid(s, 'cm'),
    targetType: target.type,
    targetId: target.id,
    parentId,
    authorId: user.id,
    body: body.trim(),
    createdAt: s.now,
    resolved: false,
    category,
  })
  return ok('コメントを追加しました')
}

export function toggleResolved(s: AppState, commentId: string): Result {
  const c = s.comments.find((x) => x.id === commentId)
  if (!c) return fail('コメントが見つかりません')
  c.resolved = !c.resolved
  return ok(c.resolved ? '解決済みにしました' : '未解決に戻しました')
}

function stopMatches(s: AppState, scope: 'all' | 'brand' | 'account', targetId: string | null, post: Post) {
  return scope === 'all' || (scope === 'brand' && post.brandId === targetId) || (scope === 'account' && post.accountId === targetId)
}

export function countStopTargets(s: AppState, scope: 'all' | 'brand' | 'account', targetId: string | null) {
  return s.posts.filter((p) => p.queued && stopMatches(s, scope, targetId, p)).length
}

export function emergencyStop(s: AppState, scope: 'all' | 'brand' | 'account', targetId: string | null, reason: string, code: string): Result {
  const user = me(s)
  if (!user?.isAdmin) return fail('緊急停止は管理者のみ実行できます')
  if (scope !== 'all' && !targetId) return fail('対象を選択してください')
  if (!reason.trim()) return fail('停止理由を入力してください')
  if (code !== DEMO_STOP_CODE) return fail('確認値が一致しません')
  let n = 0
  for (const p of s.posts) {
    if (p.queued && stopMatches(s, scope, targetId, p)) {
      p.queued = false
      p.delivery = 'stopped'
      p.hold = { kind: 'emergency', reason: `緊急停止：${reason.trim()}`, at: s.now }
      log(s, p, 'held', '緊急停止により予約を保留')
      touch(s, p)
      n++
    }
  }
  s.stops.push({ id: uid(s, 'st'), scope, targetId, reason: reason.trim(), at: s.now, by: user.id })
  notify(s, `【緊急停止】${n}件の予約を保留しました`, null)
  return ok(`緊急停止しました。${n}件の予約を保留にしました`)
}

export function releaseStop(s: AppState, stopId: string): Result {
  const user = me(s)
  if (!user?.isAdmin) return fail('解除は管理者のみ実行できます')
  s.stops = s.stops.filter((st) => st.id !== stopId)
  let n = 0
  for (const p of s.posts) {
    if (p.hold?.kind === 'emergency' && !isStopped(s, p)) {
      p.hold = { kind: 'reschedule', reason: '緊急停止は解除されました。日時を確認して再予約してください（自動送信はしません）', at: s.now }
      n++
      touch(s, p)
    }
  }
  return ok(`停止を解除しました。${n}件は再予約待ちのまま残ります`)
}

function makeMetrics(s: AppState, post: Post, now: JstDateTime) {
  if (!post.publishedAt) return []
  const acc = getAccount(s, post.accountId)!
  const plan = planCheckpoints(post.analytics, post.publishedAt)
  return plan.offsets.map((h) => {
    const plannedAt = checkpointTime(post.publishedAt!, h)
    const fetched = !isBefore(now, plannedAt)
    const values: Record<string, number | null> = {}
    for (const m of METRICS[acc.platform]) values[m.key] = fetched ? Math.round((12 + h) * (m.key === 'impressions' ? 25 : 1.5)) : null
    return { offsetHours: h, plannedAt, fetchedAt: fetched ? plannedAt : null, status: fetched ? ('fetched' as const) : ('pending' as const), values }
  })
}

export function setNow(s: AppState, next: JstDateTime): Result {
  if (!isValidDateTime(next)) return fail('日時の形式が正しくありません')
  if (isBefore(next, s.now)) return fail('基準日時を過去に戻すことはできません。リセットを使用してください')
  s.now = next
  let published = 0
  let held = 0
  for (const p of [...s.posts].sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))) {
    if (!p.scheduledAt || isBefore(next, p.scheduledAt)) continue
    if (p.queued) {
      if (s.demo.failNextDelivery) {
        s.demo.failNextDelivery = false
        p.queued = false
        p.status = 'failed'
        p.delivery = 'error'
        p.deliveryError = '配信処理でエラーが発生しました（デモで再現）'
        log(s, p, 'failed', `投稿失敗：${p.deliveryError}`, { actor: 'system' })
        notify(s, `【投稿失敗】${p.title}`, p.id)
        touch(s, p)
        continue
      }
      p.queued = false
      p.status = 'published'
      p.publishedAt = p.scheduledAt
      p.delivery = 'sent_mock'
      p.publicUrl = `https://example.com/demo/${p.id}`
      p.metrics = makeMetrics(s, p, next)
      const author = getUser(s, p.authorId)
      if (author) {
        author.publishSuccessCount += 1
        if (author.publishSuccessCount === s.settings.promotionThreshold) notify(s, `【昇格検討】${author.name} の公開成功回数が${s.settings.promotionThreshold}回に達しました`, null)
      }
      log(s, p, 'published', '公開しました（デモ配信）', { actor: 'system' })
      published++
    } else if (!p.hold && (p.status === 'review' || p.status === 'draft' || p.status === 'rejected')) {
      p.hold = { kind: 'late_approval', reason: '予定時刻までに承認が完了しませんでした。新しい日時を設定してください', at: next }
      log(s, p, 'held', '承認が間に合わず保留', { actor: 'system' })
      notify(s, `【保留】${p.title} は承認が間に合わなかったため保留しました`, p.id)
      held++
      touch(s, p)
    }
  }
  for (const p of s.posts) {
    if (p.status === 'published' && p.mode !== 'manual') {
      for (const m of p.metrics) {
        if (m.status === 'pending' && !isBefore(next, m.plannedAt)) {
          m.status = 'fetched'
          m.fetchedAt = m.plannedAt
          for (const k of Object.keys(m.values)) m.values[k] = Math.round(10 + m.offsetHours * 3)
        }
      }
    }
  }
  return ok(`基準日時を ${formatDateTime(next)} に進めました（公開 ${published}件・保留 ${held}件）`)
}

export function failEarliestQueued(s: AppState): Result {
  const target = s.posts.filter((p) => p.queued).sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))[0]
  if (!target) return fail('予約済みの投稿がありません')
  target.queued = false
  target.status = 'failed'
  target.delivery = 'error'
  target.deliveryError = '配信処理でエラーが発生しました（デモで再現）'
  log(s, target, 'failed', `投稿失敗：${target.deliveryError}`, { actor: 'system' })
  notify(s, `【投稿失敗】${target.title}`, target.id)
  touch(s, target)
  return ok(`${target.id} を投稿失敗にしました`, { id: target.id })
}

export function updateAnalyticsSetting(s: AppState, id: string, setting: Post['analytics']): Result {
  const post = findPost(s, id)
  if (!post) return fail('投稿が見つかりません')
  const user = me(s)
  if (!user || !s.permissions.find((p) => p.userId === user.id && p.accountId === post.accountId)?.edit) return fail('このアカウントの編集権限がありません')
  const plan = planCheckpoints(setting, post.publishedAt ?? post.scheduledAt)
  if (plan.errors.length) return fail(plan.errors[0])
  post.analytics = setting
  if (post.publishedAt && post.mode !== 'manual') {
    const existing = new Map(post.metrics.map((m) => [m.offsetHours, m]))
    const fresh = makeMetrics(s, post, s.now)
    post.metrics = fresh.map((m) => existing.get(m.offsetHours) ?? m)
  }
  return ok('取得設定を保存しました（デモ：実取得は行いません）')
}

export function generateFromRecurrence(s: AppState, recId: string, dates: JstDateTime[]): Result {
  const user = me(s)
  const rec = s.recurrences.find((r) => r.id === recId)
  if (!rec) return fail('設定が見つかりません')
  for (const a of rec.accountIds) {
    const v = canCreate(s, user, a)
    if (!v.ok) return fail(v.reason!)
  }
  const future = dates.filter((d) => isBefore(s.now, d))
  if (!future.length) return fail('生成できる未来の予定がありません')
  const ids: string[] = []
  for (const at of future) {
    const r = createPosts(
      s,
      { title: `${rec.name}（${formatDateTime(at)}）`, typeId: rec.typeId, importantManual: false, planId: null, assigneeId: user!.id, designatedApproverId: null, draftDue: null, approvalDue: null, scheduledAt: at },
      rec.accountIds.map((a) => ({ accountId: a, channelId: getAccount(s, a)?.platform === 'discord' ? rec.channelId : null, body: rec.mode === 'template' ? rec.templateText : '（毎回個別に作成してください）', assetIds: [] })),
    )
    if (r.ok && r.ids) ids.push(...r.ids)
  }
  rec.generatedPostIds.push(...ids)
  return ok(`${ids.length}件の下書きを生成しました。各投稿は個別に内容承認・日時承認が必要です`, { ids })
}

export function canEditPlan(s: AppState, user: User | undefined, brandId: string) {
  if (!user || user.status !== 'active') return false
  return s.accounts.some((a) => a.brandId === brandId && canCreate(s, user, a.id).ok)
}

export type PlanInput = Omit<import('./types').Plan, 'id'> & { id?: string }

export function savePlan(s: AppState, input: PlanInput): Result {
  const user = me(s)
  if (!canEditPlan(s, user, input.brandId)) return fail('このブランドの企画を編集する権限がありません')
  if (!input.title.trim()) return fail('企画名を入力してください')
  const badLink = input.links.find((l) => l.url && !/^https?:\/\//.test(l.url))
  if (badLink) return fail('関連資料URLは http:// または https:// で始めてください')
  const links = input.links.filter((l) => l.url.trim())
  if (input.id) {
    const plan = s.plans.find((p) => p.id === input.id)
    if (!plan) return fail('企画が見つかりません')
    Object.assign(plan, { ...input, links })
    return ok('企画を保存しました', { id: plan.id })
  }
  const id = uid(s, 'plan')
  s.plans.push({ ...input, id, links })
  return ok('企画を追加しました', { id })
}

export function movePlan(s: AppState, id: string, status: import('./types').PlanStatus): Result {
  const plan = s.plans.find((p) => p.id === id)
  if (!plan) return fail('企画が見つかりません')
  if (!canEditPlan(s, me(s), plan.brandId)) return fail('このブランドの企画を編集する権限がありません')
  plan.status = status
  return ok()
}

export type RecurrenceInput = Omit<import('./types').Recurrence, 'id' | 'generatedPostIds'> & { id?: string }

export function saveRecurrence(s: AppState, input: RecurrenceInput): Result {
  const user = me(s)
  if (!input.name.trim()) return fail('設定名を入力してください')
  if (!input.accountIds.length) return fail('投稿先を1つ以上選んでください')
  for (const a of input.accountIds) {
    const v = canCreate(s, user, a)
    if (!v.ok) return fail(v.reason!)
  }
  if (!input.weekdays.length) return fail('曜日を1つ以上選んでください')
  if (!/^\d{2}:\d{2}$/.test(input.time)) return fail('時刻を入力してください')
  if (!input.endDate && !input.count) return fail('終了日または回数を指定してください')
  if (input.endDate && input.endDate < input.startDate) return fail('終了日は開始日以降にしてください')
  if (input.mode === 'template' && !input.templateText.trim()) return fail('原稿テンプレートを入力してください')
  if (input.id) {
    const rec = s.recurrences.find((r) => r.id === input.id)
    if (!rec) return fail('設定が見つかりません')
    Object.assign(rec, input)
    return ok('繰り返し設定を保存しました', { id: rec.id })
  }
  const id = uid(s, 'rec')
  s.recurrences.push({ ...input, id, generatedPostIds: [] })
  return ok('繰り返し設定を追加しました', { id })
}

export interface TemplateCopyInput {
  /** 編集の起点となった素材（背景テンプレート、または既存の投稿用コピー） */
  originId: string
  name: string
  edit: import('./types').TemplateEdit
}

/** 元テンプレートは上書きしない。起点が投稿用コピーならそのコピーを更新、背景なら新しいコピーを作る */
export function saveTemplateCopy(s: AppState, input: TemplateCopyInput): Result {
  const user = me(s)
  if (!user || user.status !== 'active') return fail('保存できません')
  const origin = s.assets.find((a) => a.id === input.originId)
  if (!origin) return fail('元の素材が見つかりません')
  if (!input.name.trim()) return fail('素材名を入力してください')
  if (!input.edit.layers.length) return fail('文字レイヤーを1つ以上追加してください')
  if (input.edit.layers.some((l) => !l.text.trim())) return fail('空の文字レイヤーがあります')
  const edit = structuredClone(input.edit)

  if (origin.edit && origin.sourceAssetId) {
    origin.edit = edit
    origin.name = input.name.trim()
    origin.updatedBy = user.id
    origin.updatedAt = s.now
    return ok('投稿用コピーを更新しました', { id: origin.id })
  }
  const bg = s.assets.find((a) => a.id === edit.backgroundAssetId)
  const id = uid(s, 'as')
  s.assets.push({
    id,
    kind: 'image',
    name: input.name.trim(),
    brandId: bg?.brandId ?? origin.brandId,
    purpose: bg?.purpose ?? origin.purpose,
    src: null,
    text: null,
    edit,
    sourceAssetId: edit.backgroundAssetId,
    updatedBy: user.id,
    updatedAt: s.now,
  })
  return ok('投稿用コピーを保存しました（元テンプレートは変更していません）', { id })
}

/** 素材の添付は通常の保存と同じ判定を通すため、承認済みなら内容再承認になる */
export function attachAssetToPost(s: AppState, postId: string, assetId: string): Result {
  const post = findPost(s, postId)
  if (!post) return fail('投稿が見つかりません')
  if (!s.assets.some((a) => a.id === assetId)) return fail('素材が見つかりません')
  if (post.assetIds.includes(assetId)) return ok('この素材はすでに添付されています')
  const wasApproved = post.content.state === 'approved' || post.content.state === 'auto_approved'
  const r = savePost(s, postId, { assetIds: [...post.assetIds, assetId] }, post.version)
  if (!r.ok) return r
  return ok(wasApproved ? '投稿に添付しました。素材が変わったため内容の再承認が必要です' : '投稿に添付しました', { id: postId })
}

export { approversFor }

/** 管理者設定の更新。fn がエラー文言を返したら変更を破棄する */
export function adminEdit(s: AppState, message: string, fn: (s: AppState) => string | void): Result {
  if (!me(s)?.isAdmin) return fail('管理者設定を変更できるのは管理者のみです')
  const err = fn(s)
  if (typeof err === 'string') return fail(err)
  return ok(message)
}

export function newId(s: AppState, prefix: string) {
  return uid(s, prefix)
}
