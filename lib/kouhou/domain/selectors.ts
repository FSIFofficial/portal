import type { AppState, Post, User } from './types'
import { canApprovePendingChange, canView, isMyContentTask, isMyScheduleTask, isOverdue } from './rules'
import { dateOf } from './time'

export function visiblePosts(s: AppState, user: User | undefined, brand: string) {
  return s.posts.filter((p) => canView(s, user, p.accountId) && (brand === 'all' || p.brandId === brand))
}

export function approvalTasks(s: AppState, user: User | undefined, brand: string) {
  const posts = visiblePosts(s, user, brand)
  return {
    content: posts.filter((p) => isMyContentTask(s, user, p)),
    schedule: posts.filter((p) => isMyScheduleTask(s, user, p)),
    change: posts.filter((p) => p.pendingChange?.kind === 'cancel' && canApprovePendingChange(s, user, p).ok),
  }
}

export function approvalCount(s: AppState, user: User | undefined, brand: string) {
  const t = approvalTasks(s, user, brand)
  return t.content.length + t.schedule.length + t.change.length
}

/** 作成者側の次の作業 */
export function myNextActions(s: AppState, user: User | undefined, brand: string) {
  if (!user) return []
  const posts = visiblePosts(s, user, brand).filter((p) => p.authorId === user.id || p.assigneeId === user.id)
  const out: { post: Post; label: string }[] = []
  for (const p of posts) {
    if (p.status === 'published' || p.status === 'cancelled') continue
    if (p.content.state === 'rejected') out.push({ post: p, label: '差し戻し内容を修正' })
    else if (p.schedule.state === 'candidates') out.push({ post: p, label: '候補日時を選択' })
    else if (p.hold) out.push({ post: p, label: '保留中：日時を確認して再予約' })
    else if (p.status === 'failed') out.push({ post: p, label: '投稿失敗：原因を確認' })
    else if (p.content.state === 'draft') out.push({ post: p, label: '原稿を仕上げて「内容を完了」' })
    else if (!p.queued && p.content.state !== 'pending' && p.schedule.state === 'approved' && p.schedule.approvedFor === p.scheduledAt) out.push({ post: p, label: '予約を確定' })
  }
  return out.sort((a, b) => (a.post.scheduledAt ?? '9').localeCompare(b.post.scheduledAt ?? '9'))
}

export function dashboardCounts(s: AppState, user: User | undefined, brand: string) {
  const posts = visiblePosts(s, user, brand)
  const today = dateOf(s.now)
  const t = approvalTasks(s, user, brand)
  return {
    today: posts.filter((p) => (p.scheduledAt && dateOf(p.scheduledAt) === today && p.status !== 'cancelled') || (p.publishedAt && dateOf(p.publishedAt) === today)),
    content: t.content,
    schedule: t.schedule,
    overdue: posts.filter((p) => isOverdue(s, p)),
    failed: posts.filter((p) => p.status === 'failed'),
    unscheduled: posts.filter((p) => !p.scheduledAt && p.mode !== 'manual' && p.status !== 'cancelled'),
  }
}
