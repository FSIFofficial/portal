'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileQuestion, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import type { JstDate, Platform, PublishStatus } from '@/lib/kouhou/domain/types'
import { activeFilterCount, buildEntries, DEFAULT_FILTERS, groupByDate, KIND_LABEL, type CalendarFilters, type EntryKind } from '@/lib/kouhou/domain/calendar'
import { PLATFORM_LABEL, STATUS_META } from '@/lib/kouhou/domain/labels'
import { addDays, dateOf, formatDate, startOfWeek } from '@/lib/kouhou/domain/time'
import { Dialog, Field, Segmented, Select } from '@/components/kouhou/kit/primitives'
import { PostItem } from '@/components/kouhou/domain/post-item'
import { DayList, DayView, MonthView, WeekView } from '@/components/kouhou/calendar/calendar-views'
import { cn } from '@/lib/utils'

type View = 'month' | 'week' | 'day'

function shiftMonth(d: JstDate, n: number): JstDate {
  const [y, m] = d.split('-').map(Number)
  const idx = y * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`
}

export function CalendarScreen() {
  const { s, brand, posts } = useScope()
  const params = useSearchParams()
  const today = dateOf(s.now)
  const initialView = (['month', 'week', 'day'] as const).find((v) => v === params.get('view')) ?? 'month'
  const [view, setView] = useState<View>(initialView)
  const [cursor, setCursor] = useState<JstDate>(today)
  const [selected, setSelected] = useState<JstDate>(today)
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [moreDate, setMoreDate] = useState<JstDate | null>(null)
  const [showUnscheduled, setShowUnscheduled] = useState(false)

  const entries = useMemo(() => buildEntries(s, posts, brand, filters), [s, posts, brand, filters])
  const byDate = useMemo(() => groupByDate(entries), [entries])
  const unscheduled = posts.filter((p) => !p.scheduledAt && p.mode !== 'manual' && p.status !== 'cancelled')

  const accounts = s.accounts.filter((a) => (brand === 'all' || a.brandId === brand) && (filters.platform === 'all' || a.platform === filters.platform))
  const set = <K extends keyof CalendarFilters>(k: K, v: CalendarFilters[K]) => setFilters((f) => ({ ...f, [k]: v }))
  const toggleKind = (k: EntryKind) => setFilters((f) => ({ ...f, kinds: { ...f.kinds, [k]: !f.kinds[k] } }))

  const move = (dir: -1 | 1) => {
    if (view === 'month') setCursor((c) => shiftMonth(c, dir))
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7))
    else setCursor((c) => addDays(c, dir))
  }
  const goToday = () => {
    setCursor(today)
    setSelected(today)
  }

  const title =
    view === 'month'
      ? `${cursor.slice(0, 4)}年${Number(cursor.slice(5, 7))}月`
      : view === 'week'
        ? `${formatDate(startOfWeek(cursor))} 〜 ${formatDate(addDays(startOfWeek(cursor), 6))}`
        : formatDate(cursor)

  const nFilters = activeFilterCount(filters)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold">カレンダー</h1>
          <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">日本時間（JST）</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowUnscheduled(true)}>
          <FileQuestion className="size-4" aria-hidden />
          日時未定の原稿
          <span className="tabular rounded-full bg-muted px-1.5 text-xs">{unscheduled.length}</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="前へ">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            今日
          </Button>
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="次へ">
            <ChevronRight className="size-4" />
          </Button>
          <h2 className="tabular ml-2 text-sm font-bold md:text-base" aria-live="polite">
            {title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="表示切り替え"
            value={view}
            onChange={setView}
            items={[
              { value: 'month', label: '月' },
              { value: 'week', label: '週' },
              { value: 'day', label: '日' },
            ]}
          />
          <Button variant={showFilters || nFilters ? 'secondary' : 'outline'} size="sm" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
            <SlidersHorizontal className="size-4" aria-hidden />
            絞り込み{nFilters ? `（${nFilters}）` : ''}
          </Button>
        </div>
      </div>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <legend className="sr-only">表示対象</legend>
        {(Object.keys(KIND_LABEL) as EntryKind[]).map((k) => (
          <label key={k} className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={filters.kinds[k]} onChange={() => toggleKind(k)} className="size-4 accent-primary" />
            {KIND_LABEL[k]}
          </label>
        ))}
      </fieldset>

      {showFilters && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="媒体" htmlFor="f-platform">
            <Select id="f-platform" value={filters.platform} onChange={(e) => setFilters((f) => ({ ...f, platform: e.target.value as Platform | 'all', accountId: 'all' }))}>
              <option value="all">すべて</option>
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="アカウント" htmlFor="f-account">
            <Select id="f-account" value={filters.accountId} onChange={(e) => set('accountId', e.target.value)}>
              <option value="all">すべて</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="担当者" htmlFor="f-assignee">
            <Select id="f-assignee" value={filters.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
              <option value="all">すべて</option>
              {s.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="種類" htmlFor="f-type">
            <Select id="f-type" value={filters.typeId} onChange={(e) => set('typeId', e.target.value)}>
              <option value="all">すべて</option>
              {s.postTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="状態" htmlFor="f-status">
            <Select id="f-status" value={filters.status} onChange={(e) => set('status', e.target.value as PublishStatus | 'all')}>
              <option value="all">すべて（取り消し済みを除く）</option>
              {(Object.keys(STATUS_META) as PublishStatus[]).map((st) => (
                <option key={st} value={st}>
                  {STATUS_META[st].label}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => setFilters((f) => ({ ...DEFAULT_FILTERS, kinds: f.kinds }))} disabled={!nFilters}>
              条件をクリア
            </Button>
          </div>
          {nFilters > 0 && <p className="col-span-full text-xs text-muted-foreground">条件で絞り込み中はイベントを表示しません。</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-muted-foreground">
        {s.brands.map((b) => (
          <span key={b.id} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ backgroundColor: b.color }} aria-hidden />
            {b.name}
          </span>
        ))}
        <span>色枠＝公開状態　点線＝イベント・期限</span>
      </div>

      {view === 'month' && (
        <>
          <MonthView
            s={s}
            cursor={cursor}
            byDate={byDate}
            selected={selected}
            onSelect={setSelected}
            onMore={setMoreDate}
            onOpenDay={(d) => {
              setCursor(d)
              setView('day')
            }}
          />
          <div className={cn('rounded-lg border bg-card p-3 md:hidden')}>
            <DayList s={s} date={selected} list={byDate.get(selected) ?? []} />
          </div>
        </>
      )}
      {view === 'week' && <WeekView s={s} cursor={cursor} byDate={byDate} />}
      {view === 'day' && <DayView s={s} cursor={cursor} byDate={byDate} />}

      <Dialog open={!!moreDate} onClose={() => setMoreDate(null)} title={moreDate ? `${formatDate(moreDate)} の予定` : ''} size="md">
        {moreDate && <DayList s={s} date={moreDate} list={byDate.get(moreDate) ?? []} />}
      </Dialog>

      <Dialog open={showUnscheduled} onClose={() => setShowUnscheduled(false)} title="日時未定の原稿" description="予定日時が未設定の公開単位です。開いて日時を設定するか、承認者に候補日時の提示を依頼します。" size="lg">
        {unscheduled.length ? (
          <ul className="flex flex-col gap-2">
            {unscheduled.map((p) => (
              <li key={p.id}>
                <PostItem s={s} post={p} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">日時未定の原稿はありません。</p>
        )}
      </Dialog>
    </div>
  )
}
