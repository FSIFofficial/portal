'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { canComment, canView, getAccount } from '@/lib/kouhou/domain/rules'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { useAppState, useCurrentUser } from '@/lib/kouhou/store/store'
import { EmptyState, Notice, Panel, Tabs } from '@/components/kouhou/kit/primitives'
import { AccountTag, ContentBadge, ImportantMark, ManualMark, PostId, ScheduleBadge, StatusBadge } from '@/components/kouhou/domain/tags'
import { CommentsPanel } from '@/components/kouhou/domain/comments'
import { DraftEditor } from '@/components/kouhou/post/draft-editor'
import { ApprovalPanel } from '@/components/kouhou/post/approval-panel'
import { HistoryList } from '@/components/kouhou/post/history-list'
import { PostPreview } from '@/components/kouhou/post/post-preview'

type Tab = 'draft' | 'approval' | 'comments' | 'history'

export function PostDetailScreen({ id }: { id: string }) {
  const s = useAppState()
  const user = useCurrentUser()
  const [tab, setTab] = useState<Tab>('draft')
  const post = s.posts.find((p) => p.id === id)

  if (!post || !canView(s, user, post.accountId)) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/kouhou/posts" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          投稿一覧に戻る
        </Link>
        <EmptyState title="投稿が見つかりません">削除されたか、閲覧権限のないアカウントの投稿です。</EmptyState>
      </div>
    )
  }

  const account = getAccount(s, post.accountId)
  const openComments = s.comments.filter((c) => c.targetType === 'post' && c.targetId === post.id && !c.resolved).length
  const historyCount = s.history.filter((h) => h.postId === post.id).length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link href="/kouhou/posts" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden />
          投稿一覧
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PostId id={post.id} />
          <ImportantMark s={s} post={post} />
          <ManualMark post={post} />
        </div>
        <h1 className="text-pretty text-2xl font-bold">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={post.status} />
          {post.mode !== 'manual' && (
            <>
              <ContentBadge post={post} />
              <ScheduleBadge post={post} />
            </>
          )}
          <AccountTag s={s} account={account} channelId={post.channelId} />
          <span className="text-sm text-muted-foreground tabular">{post.scheduledAt ? formatDateTime(post.scheduledAt) : '日時未定'}</span>
        </div>
      </header>

      {post.mode === 'manual' ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Panel title="手動記録">
            <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">実公開日時</dt>
              <dd className="tabular">{post.publishedAt ? formatDateTime(post.publishedAt) : '—'}</dd>
              <dt className="text-muted-foreground">公開URL</dt>
              <dd className="min-w-0">
                {post.publicUrl ? (
                  <a href={post.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline">
                    {post.publicUrl}
                    <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
            <Notice tone="muted" title="手動記録について" className="mt-4">
              システム外で公開した投稿の記録です。編集・予約はできません。
            </Notice>
          </Panel>
          {account && <PostPreview s={s} account={account} channelId={post.channelId} body={post.body} assetIds={post.assetIds} />}
        </div>
      ) : (
        <>
          <Tabs
            label="投稿の詳細"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'draft', label: '原稿' },
              { value: 'approval', label: '承認・予約' },
              { value: 'comments', label: 'コメント', count: openComments },
              { value: 'history', label: '履歴', count: historyCount },
            ]}
          />
          <div role="tabpanel">
            {tab === 'draft' && <DraftEditor post={post} />}
            {tab === 'approval' && <ApprovalPanel post={post} />}
            {tab === 'comments' && <CommentsPanel target={{ type: 'post', id: post.id }} withCategory canComment={canComment(s, user, post.accountId)} />}
            {tab === 'history' && (
              <Panel title="変更履歴">
                <HistoryList postId={post.id} />
              </Panel>
            )}
          </div>
        </>
      )}
    </div>
  )
}
