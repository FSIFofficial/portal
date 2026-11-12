import type { ContentApprovalState, Platform, PlanStatus, PublishStatus, ScheduleApprovalState } from './types'

export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'muted'

export const PLATFORM_LABEL: Record<Platform, string> = {
  x: 'X',
  instagram: 'Instagram',
  discord: 'Discord',
}

export const PLATFORM_CODE: Record<Platform, string> = { x: 'X', instagram: 'IG', discord: 'DC' }

export const STATUS_META: Record<PublishStatus, { label: string; tone: Tone }> = {
  draft: { label: '下書き', tone: 'neutral' },
  review: { label: '確認待ち', tone: 'info' },
  rejected: { label: '差し戻し', tone: 'danger' },
  scheduled: { label: '予約済み', tone: 'success' },
  held: { label: '保留', tone: 'warning' },
  published: { label: '公開済み', tone: 'muted' },
  failed: { label: '投稿失敗', tone: 'danger' },
  cancelled: { label: '取り消し済み', tone: 'muted' },
}

export const CONTENT_META: Record<ContentApprovalState, { label: string; tone: Tone }> = {
  draft: { label: '未完了', tone: 'neutral' },
  pending: { label: '承認待ち', tone: 'info' },
  approved: { label: '承認済み', tone: 'success' },
  auto_approved: { label: '自動承認', tone: 'success' },
  rejected: { label: '差し戻し', tone: 'danger' },
  manual_record: { label: '手動記録', tone: 'muted' },
}

export const SCHEDULE_META: Record<ScheduleApprovalState, { label: string; tone: Tone }> = {
  unset: { label: '未定', tone: 'neutral' },
  candidates: { label: '候補提示中', tone: 'info' },
  pending: { label: '承認待ち', tone: 'info' },
  approved: { label: '承認済み', tone: 'success' },
  rejected: { label: '差し戻し', tone: 'danger' },
  manual_record: { label: '手動記録', tone: 'muted' },
}

export const PLAN_STATUS: Record<PlanStatus, string> = {
  idea: 'アイデア',
  review: '検討中',
  production: '制作中',
  done: '完了',
}
