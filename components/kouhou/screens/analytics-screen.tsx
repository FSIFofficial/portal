'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useScope } from '@/lib/kouhou/store/hooks'
import { getAccount, getType } from '@/lib/kouhou/domain/rules'
import { METRICS, formatOffset } from '@/lib/kouhou/domain/analytics'
import { diffHours, formatDateTime, formatDateTimeShort } from '@/lib/kouhou/domain/time'
import type { AppState, MetricPoint, Post } from '@/lib/kouhou/domain/types'
import { EmptyState, Field, Input, Notice, Panel, Pill, Segmented, Select } from '@/components/kouhou/kit/primitives'
import { AccountTag, PostId } from '@/components/kouhou/domain/tags'
import { AnalyticsSettingEditor } from '@/components/kouhou/analytics/setting-editor'
import { cn } from '@/lib/utils'

const METRIC_OPTIONS = [
  { key: 'impressions', label: '表示回数／リーチ' },
  { key: 'likes', label: 'いいね' },
  { key: 'replies', label: '返信／コメント' },
  { key: 'shares', label: 'シェア・リポスト' },
  { key: 'saves', label: '保存' },
  { key: 'reactions', label: 'リアクション' },
]
const COMPARE_OFFSETS = [1, 12, 24]

type Cell = { kind: 'value'; value: number; delayMin: number } | { kind: 'na' | 'none' | 'pending' | 'missing' | 'failed' | 'manual' }

function supports(s: AppState, post: Post, key: string) {
  const acc = getAccount(s, post.accountId)
  return Boolean(acc && METRICS[acc.platform].some((m) => m.key === key))
}

function cellFor(s: AppState, post: Post, key: string, offset: number): Cell {
  if (post.mode === 'manual') return { kind: 'manual' }
  if (!supports(s, post, key)) return { kind: 'na' }
  const pt = post.metrics.find((m) => m.offsetHours === offset)
  if (!pt) return { kind: 'none' }
  if (pt.status !== 'fetched') return { kind: pt.status }
  const v = pt.values[key]
  if (v == null) return { kind: 'missing' }
  return { kind: 'value', value: v, delayMin: pt.fetchedAt ? Math.round(diffHours(pt.fetchedAt, pt.plannedAt) * 60) : 0 }
}

const CELL_LABEL: Record<Exclude<Cell['kind'], 'value'>, string> = {
  na: '対象外',
  none: '設定外',
  pending: '未取得',
  missing: '欠測',
  failed: '取得失敗',
  manual: '手動記録',
}

function CellView({ c }: { c: Cell }) {
  if (c.kind === 'value')
    return (
      <span className="flex flex-col items-end">
        <span className="tabular font-medium">{c.value.toLocaleString()}</span>
        {c.delayMin > 0 && <span className="text-xs text-warning">遅延 {c.delayMin}分</span>}
      </span>
    )
  return <span className={cn('text-xs', c.kind === 'failed' || c.kind === 'missing' ? 'text-danger' : 'text-muted-foreground')}>{CELL_LABEL[c.kind]}</span>
}

const POINT_STATUS: Record<MetricPoint['status'], { label: string; tone: 'success' | 'muted' | 'danger' | 'warning' }> = {
  fetched: { label: '取得済み', tone: 'success' },
  pending: { label: '未取得（予定前）', tone: 'muted' },
  missing: { label: '欠測', tone: 'warning' },
  failed: { label: '取得失敗', tone: 'danger' },
}

export function AnalyticsScreen() {
  const { s, posts } = useScope()
  const [accountId, setAccountId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [from, setFrom] = useState('2026-11-01')
  const [to, setTo] = useState('2026-11-30')
  const [metric, setMetric] = useState('impressions')
  const [view, setView] = useState<'total' | 'delta'>('total')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const published = useMemo(
    () =>
      posts
        .filter((p) => p.publishedAt)
        .filter((p) => !accountId || p.accountId === accountId)
        .filter((p) => !typeId || p.typeId === typeId)
        .filter((p) => (!from || p.publishedAt!.slice(0, 10) >= from) && (!to || p.publishedAt!.slice(0, 10) <= to))
        .sort((a, b) => b.publishedAt!.localeCompare(a.publishedAt!)),
    [posts, accountId, typeId, from, to],
  )
  const accounts = useMemo(() => [...new Set(posts.map((p) => p.accountId))].map((id) => getAccount(s, id)!).filter(Boolean), [posts, s])
  const selected = published.find((p) => p.id === selectedId) ?? published.find((p) => p.mode !== 'manual') ?? null

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">投稿分析</h1>
        <p className="text-sm text-muted-foreground">数値はすべてデモ指標です。各媒体のAPIで実際に取得できるか・取得頻度は未確認です。</p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Field label="アカウント" htmlFor="an-acc">
          <Select id="an-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">すべて</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="投稿の種類" htmlFor="an-type">
          <Select id="an-type" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">すべて</option>
            {s.postTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="公開日（開始）" htmlFor="an-from">
          <Input id="an-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="公開日（終了）" htmlFor="an-to">
          <Input id="an-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="指標" htmlFor="an-metric" className="col-span-2 md:col-span-1">
          <Select id="an-metric" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {METRIC_OPTIONS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {!published.length ? (
        <EmptyState title="条件に合う公開済み投稿はありません">期間・アカウント・ブランドの絞り込みを見直してください。</EmptyState>
      ) : (
        <>
          <Panel title="1h／12h／24h 比較" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">投稿</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">公開日時</th>
                    {COMPARE_OFFSETS.map((h) => (
                      <th key={h} scope="col" className="px-3 py-2 text-right font-medium">
                        {h}h
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {published.map((p) => (
                    <tr key={p.id} className={cn('border-t border-border', selected?.id === p.id && 'bg-accent/50')}>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setSelectedId(p.id)} disabled={p.mode === 'manual'} className="flex flex-col items-start gap-0.5 text-left disabled:cursor-default">
                          <span className="font-medium hover:underline">{p.title}</span>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <PostId id={p.id} className="text-xs" />
                            <AccountTag s={s} account={getAccount(s, p.accountId)} channelId={p.channelId} />
                          </span>
                        </button>
                      </td>
                      <td className="tabular px-3 py-2 text-muted-foreground">{formatDateTimeShort(p.publishedAt)}</td>
                      {COMPARE_OFFSETS.map((h) => (
                        <td key={h} className="px-3 py-2 text-right">
                          <CellView c={cellFor(s, p, metric, h)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              対象外＝その媒体にない指標（例：Discordの表示回数）／設定外＝取得時点に含まれない／未取得＝予定時刻前／欠測・取得失敗は値を補完しません。
            </p>
          </Panel>

          {selected && <PostAnalytics key={selected.id} post={selected} metric={metric} view={view} setView={setView} />}
        </>
      )}
    </div>
  )
}

function PostAnalytics({ post, metric, view, setView }: { post: Post; metric: string; view: 'total' | 'delta'; setView: (v: 'total' | 'delta') => void }) {
  const { s } = useScope()
  const acc = getAccount(s, post.accountId)!
  const defs = METRICS[acc.platform]
  const supported = supports(s, post, metric)
  const key = supported ? metric : defs[0].key
  const label = defs.find((d) => d.key === key)!.label
  const points = [...post.metrics].sort((a, b) => a.offsetHours - b.offsetHours)

  const series = points.map((p, i) => {
    const v = p.status === 'fetched' ? p.values[key] : null
    if (view === 'total' || v == null) return { h: p.offsetHours, v }
    const prev = points.slice(0, i).reverse().find((q) => q.status === 'fetched' && q.values[key] != null)
    return { h: p.offsetHours, v: prev ? v - (prev.values[key] as number) : v }
  })

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <Panel
        title={
          <span className="flex flex-wrap items-center gap-2">
            {post.title}
            <Link href={`/kouhou/posts/detail?id=${post.id}`} className="text-xs font-normal text-primary hover:underline">
              詳細を開く
            </Link>
          </span>
        }
        actions={<Segmented size="sm" label="表示方法" value={view} onChange={setView} items={[{ value: 'total', label: '累計' }, { value: 'delta', label: '前回比' }]} />}
      >
        <div className="flex flex-col gap-3">
          {!supported && <Notice tone="warning">{`${acc.name}（${getType(s, post.typeId)?.name ?? ''}）には選択中の指標がないため「${label}」を表示しています。`}</Notice>}
          <p className="text-sm text-muted-foreground">
            デモ指標：{label}（横軸：公開からの経過時間）
          </p>
          <LineChart series={series} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <caption className="sr-only">取得時点ごとの状態</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="py-1.5 text-left font-medium">時点</th>
                  <th scope="col" className="py-1.5 text-left font-medium">予定取得</th>
                  <th scope="col" className="py-1.5 text-left font-medium">実取得</th>
                  <th scope="col" className="py-1.5 text-left font-medium">状態</th>
                  {defs.map((d) => (
                    <th key={d.key} scope="col" className="py-1.5 text-right font-medium">
                      {d.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p) => {
                  const delay = p.fetchedAt ? Math.round(diffHours(p.fetchedAt, p.plannedAt) * 60) : 0
                  return (
                    <tr key={p.offsetHours} className="border-b border-border last:border-0">
                      <td className="py-1.5">{formatOffset(p.offsetHours)}</td>
                      <td className="tabular py-1.5">{formatDateTime(p.plannedAt)}</td>
                      <td className="tabular py-1.5">
                        {p.fetchedAt ? formatDateTime(p.fetchedAt) : '—'}
                        {delay > 0 && <span className="ml-1 text-xs text-warning">（{delay}分遅延）</span>}
                      </td>
                      <td className="py-1.5">
                        <Pill tone={POINT_STATUS[p.status].tone}>{POINT_STATUS[p.status].label}</Pill>
                      </td>
                      {defs.map((d) => (
                        <td key={d.key} className="tabular py-1.5 text-right">
                          {p.status === 'fetched' && p.values[d.key] != null ? (p.values[d.key] as number).toLocaleString() : '—'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {!points.length && <p className="text-sm text-muted-foreground">取得時点がありません。</p>}
        </div>
      </Panel>
      <AnalyticsSettingEditor post={post} />
    </div>
  )
}

function LineChart({ series }: { series: { h: number; v: number | null }[] }) {
  const W = 600
  const H = 200
  const P = 32
  const known = series.filter((p) => p.v != null) as { h: number; v: number }[]
  if (!known.length) return <p className="flex h-40 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground">取得済みの値がまだありません</p>
  const maxH = Math.max(...series.map((p) => p.h), 1)
  const maxV = Math.max(...known.map((p) => p.v), 1)
  const minV = Math.min(0, ...known.map((p) => p.v))
  const x = (h: number) => P + (h / maxH) * (W - P * 2)
  const y = (v: number) => H - P - ((v - minV) / (maxV - minV || 1)) * (H - P * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`推移グラフ：${known.map((p) => `${formatOffset(p.h)} ${p.v}`).join('、')}`}>
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} className="stroke-border" />
      <text x={P} y={P - 10} className="fill-muted-foreground text-[11px]">
        {maxV.toLocaleString()}
      </text>
      <polyline fill="none" strokeWidth={2} className="stroke-primary" points={known.map((p) => `${x(p.h)},${y(p.v)}`).join(' ')} />
      {series.map((p) =>
        p.v == null ? (
          <g key={p.h}>
            <line x1={x(p.h)} x2={x(p.h)} y1={P} y2={H - P} strokeDasharray="3 3" className="stroke-warning" />
            <text x={x(p.h)} y={P - 2} textAnchor="middle" className="fill-warning text-[10px]">
              値なし
            </text>
          </g>
        ) : (
          <circle key={p.h} cx={x(p.h)} cy={y(p.v)} r={3.5} className="fill-primary" />
        ),
      )}
      {series.map((p) => (
        <text key={`t${p.h}`} x={x(p.h)} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {p.h}h
        </text>
      ))}
    </svg>
  )
}
