'use client'

import { AlertTriangle, Ban, CalendarCheck, CheckCircle2, CircleDashed, Clock, FileEdit, Hand, PauseCircle, Send, Star, XCircle } from 'lucide-react'
import type { Account, AppState, Brand, Platform, Post, PublishStatus } from '@/lib/kouhou/domain/types'
import { CONTENT_META, PLATFORM_CODE, PLATFORM_LABEL, SCHEDULE_META, STATUS_META } from '@/lib/kouhou/domain/labels'
import { getUser, isImportant } from '@/lib/kouhou/domain/rules'
import { Pill } from '@/components/kouhou/kit/primitives'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<PublishStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  review: Clock,
  rejected: XCircle,
  scheduled: CalendarCheck,
  held: PauseCircle,
  published: Send,
  failed: AlertTriangle,
  cancelled: Ban,
}

export function StatusBadge({ status }: { status: PublishStatus }) {
  const m = STATUS_META[status]
  const Icon = STATUS_ICON[status]
  return (
    <Pill tone={m.tone} icon={<Icon className="size-3" aria-hidden />}>
      {m.label}
    </Pill>
  )
}

export function ContentBadge({ post, compact }: { post: Post; compact?: boolean }) {
  const m = CONTENT_META[post.content.state]
  const ok = post.content.state === 'approved' || post.content.state === 'auto_approved'
  return (
    <Pill tone={m.tone} icon={ok ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}>
      {compact ? '' : '内容 '}
      {m.label}
    </Pill>
  )
}

export function ScheduleBadge({ post, compact }: { post: Post; compact?: boolean }) {
  const stale = post.schedule.state === 'approved' && post.schedule.approvedFor !== post.scheduledAt
  const m = stale ? { label: '再承認が必要', tone: 'warning' as const } : SCHEDULE_META[post.schedule.state]
  const ok = post.schedule.state === 'approved' && !stale
  return (
    <Pill tone={m.tone} icon={ok ? <CheckCircle2 className="size-3" aria-hidden /> : <CircleDashed className="size-3" aria-hidden />}>
      {compact ? '' : '日時 '}
      {m.label}
    </Pill>
  )
}

export function ImportantMark({ s, post }: { s: AppState; post: Post }) {
  if (!isImportant(s, post)) return null
  return (
    <Pill tone="danger" icon={<Star className="size-3" aria-hidden />}>
      重要
    </Pill>
  )
}

export function ManualMark({ post }: { post: Post }) {
  if (post.mode !== 'manual') return null
  return (
    <Pill tone="muted" icon={<Hand className="size-3" aria-hidden />}>
      手動記録
    </Pill>
  )
}

export function BrandDot({ brand, className }: { brand?: Brand; className?: string }) {
  if (!brand) return null
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-sm', className)} style={{ backgroundColor: brand.color }} />
}

export function BrandTag({ brand }: { brand?: Brand }) {
  if (!brand) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap">
      <BrandDot brand={brand} />
      {brand.name}
    </span>
  )
}

export function PlatformMark({ platform, className }: { platform: Platform; className?: string }) {
  return (
    <span
      title={PLATFORM_LABEL[platform]}
      className={cn('inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded border border-foreground/20 bg-card px-1 font-mono text-[10px] font-bold text-foreground', className)}
    >
      {PLATFORM_CODE[platform]}
      <span className="sr-only">{PLATFORM_LABEL[platform]}</span>
    </span>
  )
}

export function AccountTag({ s, account, channelId }: { s: AppState; account?: Account; channelId?: string | null }) {
  if (!account) return null
  const ch = channelId ? s.channels.find((c) => c.id === channelId) : null
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs">
      <PlatformMark platform={account.platform} />
      <span className="truncate">{account.name}</span>
      {ch && <span className="shrink-0 text-muted-foreground">#{ch.name}</span>}
    </span>
  )
}

export function UserName({ s, id }: { s: AppState; id: string | null | undefined }) {
  if (id === 'system') return <span>システム</span>
  const u = getUser(s, id)
  return <span>{u?.name ?? '—'}</span>
}

export function PostId({ id, className }: { id: string; className?: string }) {
  return <span className={cn('font-mono text-xs tabular text-muted-foreground', className)}>{id}</span>
}
