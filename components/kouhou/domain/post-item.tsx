'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import type { AppState, Post } from '@/lib/kouhou/domain/types'
import { getAccount, isOverdue } from '@/lib/kouhou/domain/rules'
import { formatDateTimeShort } from '@/lib/kouhou/domain/time'
import { cn } from '@/lib/utils'
import { AccountTag, BrandDot, ContentBadge, ImportantMark, ManualMark, PostId, ScheduleBadge, StatusBadge } from './tags'

export function PostItem({ s, post, note, className }: { s: AppState; post: Post; note?: React.ReactNode; className?: string }) {
  const acc = getAccount(s, post.accountId)
  const brand = s.brands.find((b) => b.id === post.brandId)
  const overdue = isOverdue(s, post)
  return (
    <Link
      href={`/kouhou/posts/detail?id=${encodeURIComponent(post.id)}`}
      className={cn('flex flex-col gap-1.5 rounded-md border bg-card px-3 py-2.5 transition-colors hover:border-primary/50 hover:bg-accent/40', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <BrandDot brand={brand} />
          <span className="truncate text-sm font-bold">{post.title}</span>
        </div>
        <StatusBadge status={post.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <AccountTag s={s} account={acc} channelId={post.channelId} />
        <span className="tabular">{post.publishedAt ? `公開 ${formatDateTimeShort(post.publishedAt)}` : post.scheduledAt ? formatDateTimeShort(post.scheduledAt) : '日時未定'}</span>
        <PostId id={post.id} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {post.mode === 'manual' ? (
          <ManualMark post={post} />
        ) : (
          <>
            <ContentBadge post={post} compact />
            <ScheduleBadge post={post} compact />
          </>
        )}
        <ImportantMark s={s} post={post} />
        {overdue && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
            <AlertTriangle className="size-3.5" aria-hidden />
            期限超過
          </span>
        )}
      </div>
      {note && <div className="text-xs font-medium text-primary">{note}</div>}
    </Link>
  )
}
