'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Hand, Plus, Search } from 'lucide-react'
import { Button, buttonVariants } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import type { ContentApprovalState, Platform, PublishStatus, ScheduleApprovalState } from '@/lib/kouhou/domain/types'
import { CONTENT_META, PLATFORM_LABEL, SCHEDULE_META, STATUS_META } from '@/lib/kouhou/domain/labels'
import { getAccount, isOverdue } from '@/lib/kouhou/domain/rules'
import { formatDateTimeShort } from '@/lib/kouhou/domain/time'
import { EmptyState, Field, Input, Select, Tabs } from '@/components/kouhou/kit/primitives'
import { AccountTag, BrandTag, ContentBadge, ImportantMark, ManualMark, PostId, ScheduleBadge, StatusBadge, UserName } from '@/components/kouhou/domain/tags'
import { PostItem } from '@/components/kouhou/domain/post-item'

type Special = '' | 'overdue' | 'unscheduled'
const STATUS_TABS: (PublishStatus | 'all')[] = ['all', 'draft', 'review', 'rejected', 'scheduled', 'held', 'published', 'failed', 'cancelled']

export function PostsScreen() {
  const params = useSearchParams()
  return <PostsList key={params.toString()} params={params} />
}

function PostsList({ params }: { params: URLSearchParams }) {
  const { s, posts } = useScope()
  const router = useRouter()
  const rawQ = params.get('q') ?? ''
  const special: Special = (['overdue', 'unscheduled'] as const).find((v) => v === rawQ) ?? ''
  const [status, setStatus] = useState<PublishStatus | 'all'>(STATUS_TABS.find((t) => t === params.get('status')) ?? 'all')
  const [text, setText] = useState(special ? '' : rawQ)
  const [platform, setPlatform] = useState<Platform | 'all'>('all')
  const [content, setContent] = useState<ContentApprovalState | 'all'>('all')
  const [schedule, setSchedule] = useState<ScheduleApprovalState | 'all'>('all')
  const [typeId, setTypeId] = useState('all')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(0)

  const base = useMemo(() => {
    const q = text.trim().toLowerCase()
    return posts.filter((p) => {
      if (special === 'overdue' && !isOverdue(s, p)) return false
      if (special === 'unscheduled' && (p.scheduledAt || p.mode === 'manual' || p.status === 'cancelled')) return false
      const acc = getAccount(s, p.accountId)
      if (platform !== 'all' && acc?.platform !== platform) return false
      if (content !== 'all' && p.content.state !== content) return false
      if (schedule !== 'all' && p.schedule.state !== schedule) return false
      if (typeId !== 'all' && p.typeId !== typeId) return false
      if (q && !`${p.id} ${p.title} ${p.body} ${acc?.name ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [posts, s, special, platform, content, schedule, typeId, text])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: base.length }
    for (const p of base) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [base])

  const rows = useMemo(
    () => base.filter((p) => status === 'all' || p.status === status).sort((a, b) => (a.publishedAt ?? a.scheduledAt ?? '9999').localeCompare(b.publishedAt ?? b.scheduledAt ?? '9999')),
    [base, status],
  )
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pages - 1)
  const view = rows.slice(current * pageSize, current * pageSize + pageSize)

  const clearSpecial = () => router.replace('/kouhou/posts')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">投稿一覧</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/kouhou/posts/manual" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Hand className="size-4" aria-hidden />
            手動投稿を記録
          </Link>
          <Link href="/kouhou/posts/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="size-4" aria-hidden />
            新規投稿
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <div className="col-span-2">
            <Field label="検索" htmlFor="post-search">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="post-search" value={text} onChange={(e) => (setText(e.target.value), setPage(0))} placeholder="ID・タイトル・本文・アカウント" className="pl-9" />
              </div>
            </Field>
          </div>
          <Field label="媒体" htmlFor="pl-platform">
            <Select id="pl-platform" value={platform} onChange={(e) => (setPlatform(e.target.value as Platform | 'all'), setPage(0))}>
              <option value="all">すべて</option>
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="種類" htmlFor="pl-type">
            <Select id="pl-type" value={typeId} onChange={(e) => (setTypeId(e.target.value), setPage(0))}>
              <option value="all">すべて</option>
              {s.postTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="内容承認" htmlFor="pl-content">
            <Select id="pl-content" value={content} onChange={(e) => (setContent(e.target.value as ContentApprovalState | 'all'), setPage(0))}>
              <option value="all">すべて</option>
              {(Object.keys(CONTENT_META) as ContentApprovalState[]).map((k) => (
                <option key={k} value={k}>
                  {CONTENT_META[k].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="日時承認" htmlFor="pl-schedule">
            <Select id="pl-schedule" value={schedule} onChange={(e) => (setSchedule(e.target.value as ScheduleApprovalState | 'all'), setPage(0))}>
              <option value="all">すべて</option>
              {(Object.keys(SCHEDULE_META) as ScheduleApprovalState[]).map((k) => (
                <option key={k} value={k}>
                  {SCHEDULE_META[k].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {special && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md bg-info-soft px-2 py-1 font-medium">{special === 'overdue' ? '期限超過のみ表示中' : '日時未定のみ表示中'}</span>
            <Button variant="ghost" size="sm" onClick={clearSpecial}>
              解除
            </Button>
          </div>
        )}
      </div>

      <Tabs
        label="状態"
        value={status}
        onChange={(v) => (setStatus(v), setPage(0))}
        items={STATUS_TABS.map((t) => ({ value: t, label: t === 'all' ? 'すべて' : STATUS_META[t].label, count: counts[t] ?? 0 }))}
      />

      {rows.length === 0 ? (
        <EmptyState title="条件に一致する投稿はありません">検索語や絞り込み条件を変更してください。</EmptyState>
      ) : (
        <>
          <ul className="flex flex-col gap-2 lg:hidden">
            {view.map((p) => (
              <li key={p.id}>
                <PostItem s={s} post={p} />
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto rounded-lg border bg-card lg:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-bold">投稿ID</th>
                  <th className="px-3 py-2 font-bold">タイトル・本文</th>
                  <th className="px-3 py-2 font-bold">ブランド・投稿先</th>
                  <th className="px-3 py-2 font-bold">種類</th>
                  <th className="px-3 py-2 font-bold">作成者／最終編集者</th>
                  <th className="px-3 py-2 font-bold">現在の予定日時</th>
                  <th className="px-3 py-2 font-bold">内容承認</th>
                  <th className="px-3 py-2 font-bold">日時承認</th>
                  <th className="px-3 py-2 font-bold">全体状態</th>
                </tr>
              </thead>
              <tbody>
                {view.map((p) => {
                  const acc = getAccount(s, p.accountId)
                  const type = s.postTypes.find((t) => t.id === p.typeId)
                  const overdue = isOverdue(s, p)
                  return (
                    <tr key={p.id} className="border-b align-top last:border-b-0 hover:bg-accent/40">
                      <td className="px-3 py-2.5">
                        <Link href={`/kouhou/posts/detail?id=${encodeURIComponent(p.id)}`} className="hover:underline">
                          <PostId id={p.id} className="text-foreground" />
                        </Link>
                      </td>
                      <td className="max-w-72 px-3 py-2.5">
                        <Link href={`/kouhou/posts/detail?id=${encodeURIComponent(p.id)}`} className="block font-bold hover:text-primary hover:underline">
                          <span className="line-clamp-1">{p.title}</span>
                        </Link>
                        <span className="line-clamp-1 text-xs text-muted-foreground">{p.body || '（本文なし）'}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          <ImportantMark s={s} post={p} />
                          <ManualMark post={p} />
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <BrandTag brand={s.brands.find((b) => b.id === p.brandId)} />
                          <AccountTag s={s} account={acc} channelId={p.channelId} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{type?.name}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        <UserName s={s} id={p.authorId} />
                        <span className="text-muted-foreground"> ／ </span>
                        <UserName s={s} id={p.lastEditorId} />
                      </td>
                      <td className="tabular px-3 py-2.5 text-xs whitespace-nowrap">
                        {p.mode === 'manual' ? <span className="text-muted-foreground">公開 {formatDateTimeShort(p.publishedAt)}</span> : formatDateTimeShort(p.scheduledAt)}
                        {overdue && <span className="mt-0.5 block font-medium text-danger">期限超過</span>}
                      </td>
                      <td className="px-3 py-2.5">{p.mode === 'manual' ? <span className="text-xs text-muted-foreground">—</span> : <ContentBadge post={p} compact />}</td>
                      <td className="px-3 py-2.5">{p.mode === 'manual' ? <span className="text-xs text-muted-foreground">—</span> : <ScheduleBadge post={p} compact />}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <label htmlFor="page-size" className="text-xs text-muted-foreground">
                表示件数
              </label>
              <Select id="page-size" value={pageSize} onChange={(e) => (setPageSize(Number(e.target.value)), setPage(0))} className="w-24">
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}件
                  </option>
                ))}
              </Select>
              <span className="tabular text-xs text-muted-foreground">
                全{rows.length}件中 {current * pageSize + 1}–{Math.min(rows.length, (current + 1) * pageSize)}件
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}>
                前へ
              </Button>
              <span className="tabular px-2 text-xs">
                {current + 1} / {pages}
              </span>
              <Button variant="outline" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                次へ
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
