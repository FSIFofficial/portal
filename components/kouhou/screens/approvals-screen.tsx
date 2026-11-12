'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import type { AppState, Post } from '@/lib/kouhou/domain/types'
import { canApprovePendingChange, getAccount, isMyContentTask, isMyScheduleTask } from '@/lib/kouhou/domain/rules'
import { formatDateTime, formatDateTimeShort, isBefore } from '@/lib/kouhou/domain/time'
import { EmptyState, Notice, Panel, Pill, Tabs } from '@/components/kouhou/kit/primitives'
import { AccountTag, ContentBadge, ImportantMark, PostId, ScheduleBadge, StatusBadge, UserName } from '@/components/kouhou/domain/tags'
import { ApprovalPanel } from '@/components/kouhou/post/approval-panel'
import { PostPreview } from '@/components/kouhou/post/post-preview'
import { HistoryList } from '@/components/kouhou/post/history-list'
import { CommentsPanel } from '@/components/kouhou/domain/comments'
import { cn } from '@/lib/utils'

type Kind = 'content' | 'schedule' | 'change'

const KIND_HINT: Record<Kind, string> = {
  content: '原稿の内容を確認し、承認または差し戻します。日時が未定でも内容だけ承認できます。',
  schedule: '作成者が指定した日時、または候補日時の提示が必要な投稿です。',
  change: '予約後に申請された変更・取り消しです。承認されるまで公開は保留されます。',
}

export function ApprovalsScreen() {
  const { s, user, posts } = useScope()
  const [kind, setKind] = useState<Kind>('content')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const lists = useMemo(() => {
    const change = posts.filter(
      (p) => p.pendingChange && (p.pendingChange.kind === 'cancel' ? canApprovePendingChange(s, user, p).ok : isMyContentTask(s, user, p)),
    )
    const changeIds = new Set(change.map((p) => p.id))
    const byDue = (a: Post, b: Post) => (a.approvalDue ?? a.scheduledAt ?? '9').localeCompare(b.approvalDue ?? b.scheduledAt ?? '9')
    return {
      content: posts.filter((p) => !changeIds.has(p.id) && isMyContentTask(s, user, p)).sort(byDue),
      schedule: posts.filter((p) => !changeIds.has(p.id) && isMyScheduleTask(s, user, p)).sort(byDue),
      change: change.sort(byDue),
    }
  }, [s, user, posts])

  const list = lists[kind]
  const selected = list.find((p) => p.id === selectedId) ?? list[0]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">承認待ち</h1>
        <p className="text-sm text-muted-foreground">
          {user?.name}さんが承認できる依頼だけを表示しています。コメントでは承認は成立しません。
        </p>
      </div>

      <Tabs
        label="承認の種類"
        value={kind}
        onChange={(v) => {
          setKind(v)
          setSelectedId(null)
        }}
        items={[
          { value: 'content', label: '内容', count: lists.content.length },
          { value: 'schedule', label: '日時', count: lists.schedule.length },
          { value: 'change', label: '予約後の変更・取り消し', count: lists.change.length },
        ]}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">{KIND_HINT[kind]}</p>

      {list.length === 0 ? (
        <EmptyState title="対応が必要な依頼はありません">
          承認権限のあるアカウント、または個別に指定承認者となった投稿の依頼がここに表示されます。
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <ul className="flex flex-col gap-2 lg:w-96 lg:shrink-0" aria-label="依頼一覧">
            {list.map((p) => (
              <RequestRow key={p.id} s={s} post={p} kind={kind} active={selected?.id === p.id} onSelect={() => setSelectedId(p.id)} />
            ))}
          </ul>
          {selected && <RequestDetail s={s} post={selected} kind={kind} />}
        </div>
      )}
    </div>
  )
}

function RequestRow({ s, post, kind, active, onSelect }: { s: AppState; post: Post; kind: Kind; active: boolean; onSelect: () => void }) {
  const acc = getAccount(s, post.accountId)
  const requester = kind === 'change' ? post.pendingChange?.requestedBy : post.lastEditorId
  const due = post.approvalDue
  const late = due ? isBefore(due, s.now) : false
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active}
        className={cn(
          'flex w-full flex-col gap-1.5 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/40',
          active && 'border-primary ring-1 ring-primary',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <PostId id={post.id} />
          <span className="text-xs text-muted-foreground tabular">第{post.version}版</span>
        </div>
        <p className="line-clamp-1 text-sm font-bold">{post.title}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <AccountTag s={s} account={acc} channelId={post.channelId} />
          <ImportantMark s={s} post={post} />
          {kind === 'change' && post.pendingChange && (
            <Pill tone="warning">{post.pendingChange.kind === 'cancel' ? '取り消し申請' : '予約後の変更'}</Pill>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            依頼者：<UserName s={s} id={requester} />
          </span>
          <span className={cn('tabular', late && 'font-bold text-danger')}>
            {due ? `期限 ${formatDateTimeShort(due)}${late ? '（超過）' : ''}` : '期限なし'}
          </span>
        </div>
      </button>
    </li>
  )
}

function RequestDetail({ s, post, kind }: { s: AppState; post: Post; kind: Kind }) {
  const acc = getAccount(s, post.accountId)
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <Panel
        title={
          <span className="flex flex-wrap items-center gap-2">
            {post.title}
            <PostId id={post.id} />
          </span>
        }
        actions={
          <Link href={`/kouhou/posts/detail?id=${encodeURIComponent(post.id)}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <ExternalLink className="size-4" aria-hidden />
            詳細を開く
          </Link>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={post.status} />
            <ContentBadge post={post} />
            <ScheduleBadge post={post} />
            <ImportantMark s={s} post={post} />
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            <Info label="対象アカウント"><AccountTag s={s} account={acc} channelId={post.channelId} /></Info>
            <Info label="対象版">第{post.version}版</Info>
            <Info label="原作成者"><UserName s={s} id={post.authorId} /></Info>
            <Info label="最終編集者"><UserName s={s} id={post.lastEditorId} /></Info>
            <Info label="現在の予定日時">{post.scheduledAt ? formatDateTime(post.scheduledAt) : '未定'}</Info>
            <Info label="承認期限">{post.approvalDue ? formatDateTime(post.approvalDue) : '—'}</Info>
          </dl>
          {kind === 'change' && post.pendingChange && (
            <Notice tone="warning" title={post.pendingChange.kind === 'cancel' ? '取り消し申請' : '予約後の変更申請'}>
              第{post.pendingChange.fromVersion}版からの申請です。理由：{post.pendingChange.reason || '（記載なし）'}
            </Notice>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="投稿先プレビュー（参考）">
          {acc && <PostPreview s={s} account={acc} channelId={post.channelId} body={post.body} assetIds={post.assetIds} />}
        </Panel>
        <ApprovalPanel post={post} />
      </div>

      <Panel title="変更履歴（差分）" bodyClassName="max-h-96 overflow-y-auto p-4">
        <HistoryList postId={post.id} />
      </Panel>
      <Panel title="コメント">
        <CommentsPanel target={{ type: 'post', id: post.id }} withCategory />
      </Panel>
    </div>
  )
}


function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
