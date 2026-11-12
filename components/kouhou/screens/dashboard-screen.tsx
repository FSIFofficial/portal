'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useScope } from '@/lib/kouhou/store/hooks'
import { dashboardCounts, myNextActions } from '@/lib/kouhou/domain/selectors'
import { EmptyState, Panel } from '@/components/kouhou/kit/primitives'
import { PostItem } from '@/components/kouhou/domain/post-item'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { cn } from '@/lib/utils'

export function DashboardScreen() {
  const { s, user, brand } = useScope()
  const c = dashboardCounts(s, user, brand)
  const next = myNextActions(s, user, brand)

  const tiles = [
    { label: '今日の投稿', n: c.today.length, href: '/kouhou/calendar?view=day', tone: '' },
    { label: '内容承認待ち', n: c.content.length, href: '/kouhou/approvals?tab=content', tone: c.content.length ? 'text-primary' : '' },
    { label: '日時承認待ち', n: c.schedule.length, href: '/kouhou/approvals?tab=schedule', tone: c.schedule.length ? 'text-primary' : '' },
    { label: '期限超過', n: c.overdue.length, href: '/kouhou/posts?q=overdue', tone: c.overdue.length ? 'text-danger' : '' },
    { label: '投稿失敗', n: c.failed.length, href: '/kouhou/posts?status=failed', tone: c.failed.length ? 'text-danger' : '' },
    { label: '日時未定', n: c.unscheduled.length, href: '/kouhou/posts?q=unscheduled', tone: '' },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">ダッシュボード</h1>
          <p className="text-xs text-muted-foreground">基準日時 {formatDateTime(s.now)} 時点</p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="flex h-full flex-col gap-1 rounded-lg border bg-card px-3 py-3 transition-colors hover:border-primary/50">
              <span className="text-xs text-muted-foreground">{t.label}</span>
              <span className={cn('tabular text-2xl font-bold', t.tone)}>{t.n}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="自分の次の作業" actions={<span className="tabular text-xs text-muted-foreground">{next.length}件</span>}>
          {next.length ? (
            <ul className="flex flex-col gap-2">
              {next.slice(0, 8).map(({ post, label }) => (
                <li key={post.id}>
                  <PostItem s={s} post={post} note={label} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="今すぐ必要な作業はありません">担当している投稿の差し戻し・候補日時の選択・予約確定がここに表示されます。</EmptyState>
          )}
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title="承認者としての作業"
            actions={
              <Link href="/kouhou/approvals" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
                承認待ちへ
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            }
          >
            {c.content.length + c.schedule.length ? (
              <ul className="flex flex-col gap-2">
                {[...c.content.map((p) => ({ p, k: '内容承認' })), ...c.schedule.map((p) => ({ p, k: '日時承認' }))].slice(0, 6).map(({ p, k }) => (
                  <li key={`${k}-${p.id}`}>
                    <PostItem s={s} post={p} note={`${k}の判断`} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="承認依頼はありません" />
            )}
          </Panel>

          <Panel title="今日の投稿">
            {c.today.length ? (
              <ul className="flex flex-col gap-2">
                {c.today.map((p) => (
                  <li key={p.id}>
                    <PostItem s={s} post={p} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="今日の投稿はありません" />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
