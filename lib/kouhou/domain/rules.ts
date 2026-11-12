import type { Account, AccountPermission, AppState, Level, Post, PostType, PublishStatus, User } from './types'
import { isBefore } from './time'

export interface Verdict {
  ok: boolean
  reason?: string
}

const OK: Verdict = { ok: true }
const no = (reason: string): Verdict => ({ ok: false, reason })

export function getUser(s: AppState, id: string | null | undefined) {
  return s.users.find((u) => u.id === id)
}

export function getAccount(s: AppState, id: string) {
  return s.accounts.find((a) => a.id === id)
}

export function getType(s: AppState, id: string): PostType | undefined {
  return s.postTypes.find((t) => t.id === id)
}

export function permissionOf(s: AppState, userId: string | null | undefined, accountId: string): AccountPermission | undefined {
  if (!userId) return undefined
  return s.permissions.find((p) => p.userId === userId && p.accountId === accountId)
}

export function effectiveLevel(s: AppState, user: User, accountId: string): Level {
  return permissionOf(s, user.id, accountId)?.levelOverride ?? user.level
}

function activeUser(user: User | undefined): user is User {
  return !!user && user.status === 'active'
}

export function canView(s: AppState, user: User | undefined, accountId: string) {
  return activeUser(user) && !!permissionOf(s, user.id, accountId)?.view
}

export function canCreate(s: AppState, user: User | undefined, accountId: string): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (!permissionOf(s, user.id, accountId)?.create) return no('このアカウントの作成権限がありません')
  return OK
}

export function isImportant(s: AppState, post: Pick<Post, 'typeId' | 'importantManual'>) {
  return !!getType(s, post.typeId)?.important || post.importantManual
}

export function isRoutine(s: AppState, post: Pick<Post, 'typeId'>) {
  return !!getType(s, post.typeId)?.routine
}

const TERMINAL: PublishStatus[] = ['published', 'cancelled']

/** アカウント別の編集権限 + 最終編集者ロックの両方を満たして初めて編集可能 */
export function canEditDraft(s: AppState, user: User | undefined, post: Post): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (post.mode === 'manual') return no('手動記録の投稿は編集できません')
  if (TERMINAL.includes(post.status)) return no('公開済み・取り消し済みの投稿は編集できません')
  if (!permissionOf(s, user.id, post.accountId)?.edit) return no('このアカウントの編集権限がありません')
  if (post.lastEditorId !== user.id && !post.editOpen) return no('最終編集者が編集を許可すると変更できます')
  return OK
}

export function canToggleEditOpen(user: User | undefined, post: Post): Verdict {
  if (!user) return no('ログインが必要です')
  if (post.lastEditorId !== user.id) return no('編集許可を変更できるのは最終編集者のみです')
  return OK
}

/** 承認を判定する時点の「最も低いレベル」。最後の承認以降に編集した人を対象にする */
export function lowestEditorLevel(s: AppState, post: Post): Level {
  const ids = post.contentEditorsSinceApproval.length ? post.contentEditorsSinceApproval : [post.lastEditorId]
  let lvl: Level = 3
  for (const id of ids) {
    const u = getUser(s, id)
    if (!u) continue
    const l = effectiveLevel(s, u, post.accountId)
    if (l < lvl) lvl = l
  }
  return lvl
}

export type ContentRequirement = 'approval' | 'auto' | 'important'

export function contentRequirement(s: AppState, post: Post): ContentRequirement {
  if (isImportant(s, post)) return 'important'
  if (post.queued || post.hold?.kind === 'pending_change') return 'approval'
  const lvl = lowestEditorLevel(s, post)
  if (lvl >= 3) return 'auto'
  if (lvl === 2 && isRoutine(s, post)) return 'auto'
  return 'approval'
}

export function requiresContentApproval(s: AppState, post: Post) {
  return contentRequirement(s, post) !== 'auto'
}

export function contentRequirementLabel(req: ContentRequirement) {
  switch (req) {
    case 'auto':
      return '「内容を完了」で内容を自動承認'
    case 'approval':
      return '内容承認が必要'
    case 'important':
      return '重要投稿：本人以外の指定承認者が承認'
  }
}

function isApproverFor(s: AppState, user: User, post: Post) {
  if (post.designatedApproverId === user.id) return true
  const perm = permissionOf(s, user.id, post.accountId)
  return !!perm?.approve && effectiveLevel(s, user, post.accountId) === 3
}

export function canApproveContent(s: AppState, user: User | undefined, post: Post): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (post.content.state !== 'pending') return no('内容承認の依頼がありません')
  if (!isApproverFor(s, user, post)) return no('この投稿の承認権限がありません')
  const selfIds = [post.authorId, ...post.contentEditorsSinceApproval]
  if (isImportant(s, post) && selfIds.includes(user.id)) return no('重要投稿は原作成者・編集者本人が承認できません')
  if (!isImportant(s, post) && post.lastEditorId === user.id) return no('自分が最後に編集した内容は承認できません')
  if (isImportant(s, post) && post.designatedApproverId && post.designatedApproverId !== user.id) {
    return no('重要投稿は指定承認者が承認します')
  }
  return OK
}

export function canDecideSchedule(s: AppState, user: User | undefined, post: Post): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (!isApproverFor(s, user, post)) return no('この投稿の承認権限がありません')
  if (post.status === 'published' || post.status === 'cancelled') return no('公開済み・取り消し済みです')
  return OK
}

export function canApproveSchedule(s: AppState, user: User | undefined, post: Post): Verdict {
  const base = canDecideSchedule(s, user, post)
  if (!base.ok) return base
  if (post.schedule.state !== 'pending') return no('日時承認の依頼がありません')
  if (!post.scheduledAt) return no('日時が未定です')
  if (!isBefore(s.now, post.scheduledAt)) return no('過去の日時は承認できません。新しい日時を設定してください')
  return OK
}

/** 作成者側：候補日時を選ぶ・日時を変更する */
export function canSelectCandidate(s: AppState, user: User | undefined, post: Post, at: string): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (!permissionOf(s, user.id, post.accountId)?.edit) return no('このアカウントの編集権限がありません')
  if (!post.schedule.candidates.some((c) => c.at === at)) return no('提示された候補ではありません')
  if (!isBefore(s.now, at)) return no('過去の候補は選択できません')
  return OK
}

export function isStopped(s: AppState, post: Pick<Post, 'brandId' | 'accountId'>) {
  return s.stops.some(
    (st) =>
      st.scope === 'all' ||
      (st.scope === 'brand' && st.targetId === post.brandId) ||
      (st.scope === 'account' && st.targetId === post.accountId),
  )
}

export function contentOk(post: Post) {
  return post.content.state === 'approved' || post.content.state === 'auto_approved'
}

export function scheduleOk(post: Post) {
  return post.schedule.state === 'approved' && !!post.scheduledAt && post.schedule.approvedFor === post.scheduledAt
}

export interface ScheduleCheck {
  label: string
  ok: boolean
  detail: string
}

export function scheduleChecks(s: AppState, post: Post): ScheduleCheck[] {
  const future = !!post.scheduledAt && isBefore(s.now, post.scheduledAt)
  return [
    {
      label: '内容承認',
      ok: contentOk(post),
      detail: contentOk(post) ? `v${post.content.decidedVersion} を承認済み` : '内容承認が成立していません',
    },
    {
      label: '日時承認',
      ok: scheduleOk(post),
      detail: scheduleOk(post) ? '現在の予定日時が承認済み' : post.scheduledAt ? '現在の予定日時は未承認です' : '日時が未定です',
    },
    {
      label: '未来の日時',
      ok: future,
      detail: future ? '基準日時より後です' : post.scheduledAt ? '予定日時が過去です。新しい日時を設定してください' : '日時が未定です',
    },
    {
      label: '停止されていない',
      ok: !isStopped(s, post),
      detail: isStopped(s, post) ? '緊急停止の対象です' : '停止対象外',
    },
    ...(s.live ? [connectionCheck(s, post)] : []),
    {
      label: '承認待ちの変更なし',
      ok: !post.pendingChange,
      detail: post.pendingChange ? '予約後の変更・取り消しが承認待ちです' : 'なし',
    },
  ]
}

/** 本番：送信先アカウントが自動送信できる状態か（Instagramの自動送信は未対応） */
function connectionCheck(s: AppState, post: Post): ScheduleCheck {
  const acc = getAccount(s, post.accountId)
  if (!acc) return { label: 'アカウント接続', ok: false, detail: 'アカウントが見つかりません' }
  if (acc.platform === 'instagram') return { label: 'アカウント接続', ok: false, detail: 'Instagramの自動送信は未対応です。公開後に「手動投稿の記録」で記録してください' }
  if (acc.platform === 'discord') {
    const ch = s.channels.find((c) => c.id === post.channelId)
    if (!ch?.discordId) return { label: 'アカウント接続', ok: false, detail: 'チャンネルのDiscord IDが未設定です（管理者設定）' }
  }
  const ok = acc.connection === 'connected'
  return { label: 'アカウント接続', ok, detail: ok ? '接続済み' : acc.connectionError || '未接続です（管理者設定で接続してください）' }
}

export function canSchedule(s: AppState, user: User | undefined, post: Post): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (post.queued) return no('すでに予約済みです')
  if (post.status === 'published' || post.status === 'cancelled') return no('この状態では予約できません')
  if (post.mode === 'manual') return no('手動記録の投稿は予約できません')
  if (!permissionOf(s, user.id, post.accountId)?.edit) return no('このアカウントの編集権限がありません')
  const failed = scheduleChecks(s, post).find((c) => !c.ok)
  if (failed) return no(`${failed.label}：${failed.detail}`)
  return OK
}

export function canRequestAfterSchedule(s: AppState, user: User | undefined, post: Post): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (!post.queued && post.status !== 'held') return no('予約後の投稿ではありません')
  if (post.pendingChange) return no('変更・取り消しの申請が承認待ちです')
  const perm = permissionOf(s, user.id, post.accountId)
  if (!(post.authorId === user.id || perm?.edit || user.isAdmin)) return no('申請できる立場ではありません')
  return OK
}

export function canApprovePendingChange(s: AppState, user: User | undefined, post: Post): Verdict {
  if (!activeUser(user)) return no('利用できないユーザーです')
  if (!post.pendingChange) return no('申請がありません')
  if (!isApproverFor(s, user, post)) return no('この投稿の承認権限がありません')
  if (post.pendingChange.requestedBy === user.id) return no('自分の申請は承認できません')
  return OK
}

export function canComment(s: AppState, user: User | undefined, accountId?: string) {
  if (!activeUser(user)) return false
  return accountId ? canView(s, user, accountId) : true
}

export function deriveStatus(post: Post): PublishStatus {
  if (post.status === 'published' || post.status === 'cancelled') return post.status
  if (post.status === 'failed' && !post.queued && !post.hold) return 'failed'
  if (post.hold) return 'held'
  if (post.queued) return 'scheduled'
  if (post.content.state === 'rejected' || post.schedule.state === 'rejected') return 'rejected'
  if (post.content.state === 'pending' || post.schedule.state === 'pending') return 'review'
  return 'draft'
}

export function approversFor(s: AppState, post: Post): User[] {
  return s.users.filter((u) => u.status === 'active' && isApproverFor(s, u, post))
}

export function visibleAccounts(s: AppState, user: User | undefined): Account[] {
  return s.accounts.filter((a) => canView(s, user, a.id))
}

/** 内容承認の依頼を受けられるか（承認待ち画面の対象判定） */
export function isMyContentTask(s: AppState, user: User | undefined, post: Post) {
  return canApproveContent(s, user, post).ok
}

export function isMyScheduleTask(s: AppState, user: User | undefined, post: Post) {
  if (!user) return false
  if (post.schedule.state === 'pending') return canDecideSchedule(s, user, post).ok && post.lastEditorId !== user.id
  return false
}

export function isOverdue(s: AppState, post: Post) {
  if (post.status === 'published' || post.status === 'cancelled') return false
  if (post.approvalDue && post.content.state === 'pending' && isBefore(post.approvalDue, s.now)) return true
  if (post.draftDue && post.content.state === 'draft' && isBefore(post.draftDue, s.now)) return true
  if (post.hold?.kind === 'late_approval') return true
  return false
}
