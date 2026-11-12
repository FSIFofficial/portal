import type { AppState, JstDateTime, Platform, Post, PublishStatus } from './types'
import { getAccount } from './rules'

export type EntryKind = 'post' | 'event' | 'draftDue' | 'approvalDue'

export interface CalendarEntry {
  key: string
  kind: EntryKind
  at: JstDateTime
  title: string
  brandId: string
  post?: Post
}

export interface CalendarFilters {
  kinds: Record<EntryKind, boolean>
  platform: Platform | 'all'
  accountId: string
  assigneeId: string
  typeId: string
  status: PublishStatus | 'all'
}

export const DEFAULT_FILTERS: CalendarFilters = {
  kinds: { post: true, event: true, draftDue: true, approvalDue: true },
  platform: 'all',
  accountId: 'all',
  assigneeId: 'all',
  typeId: 'all',
  status: 'all',
}

export const KIND_LABEL: Record<EntryKind, string> = {
  post: '投稿予定',
  event: 'イベント',
  draftDue: '原稿期限',
  approvalDue: '承認期限',
}

export function activeFilterCount(f: CalendarFilters) {
  return [f.platform !== 'all', f.accountId !== 'all', f.assigneeId !== 'all', f.typeId !== 'all', f.status !== 'all'].filter(Boolean).length
}

/** 閲覧可能な投稿（ブランド絞り込み済み）からカレンダー項目を組み立てる */
export function buildEntries(s: AppState, posts: Post[], brand: string, f: CalendarFilters): CalendarEntry[] {
  const out: CalendarEntry[] = []
  const filtered = posts.filter((p) => {
    if (p.status === 'cancelled' && f.status !== 'cancelled') return false
    const acc = getAccount(s, p.accountId)
    if (f.platform !== 'all' && acc?.platform !== f.platform) return false
    if (f.accountId !== 'all' && p.accountId !== f.accountId) return false
    if (f.assigneeId !== 'all' && p.assigneeId !== f.assigneeId) return false
    if (f.typeId !== 'all' && p.typeId !== f.typeId) return false
    if (f.status !== 'all' && p.status !== f.status) return false
    return true
  })
  for (const p of filtered) {
    const at = p.publishedAt ?? p.scheduledAt
    if (f.kinds.post && at) out.push({ key: `p-${p.id}`, kind: 'post', at, title: p.title, brandId: p.brandId, post: p })
    if (f.kinds.draftDue && p.draftDue && p.status !== 'published') out.push({ key: `dd-${p.id}`, kind: 'draftDue', at: p.draftDue, title: p.title, brandId: p.brandId, post: p })
    if (f.kinds.approvalDue && p.approvalDue && p.status !== 'published') out.push({ key: `ad-${p.id}`, kind: 'approvalDue', at: p.approvalDue, title: p.title, brandId: p.brandId, post: p })
  }
  const postOnlyFilter = activeFilterCount(f) > 0
  if (f.kinds.event && !postOnlyFilter) {
    for (const e of s.events) {
      if (brand !== 'all' && e.brandId !== brand) continue
      out.push({ key: `e-${e.id}`, kind: 'event', at: e.at, title: e.title, brandId: e.brandId })
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

export function groupByDate(entries: CalendarEntry[]) {
  const map = new Map<string, CalendarEntry[]>()
  for (const e of entries) {
    const d = e.at.slice(0, 10)
    const list = map.get(d)
    if (list) list.push(e)
    else map.set(d, [e])
  }
  return map
}
