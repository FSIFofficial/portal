'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, Flag, PartyPopper, Plus } from 'lucide-react'
import type { AppState, JstDate } from '@/lib/kouhou/domain/types'
import type { CalendarEntry } from '@/lib/kouhou/domain/calendar'
import { KIND_LABEL } from '@/lib/kouhou/domain/calendar'
import { getAccount } from '@/lib/kouhou/domain/rules'
import { STATUS_META } from '@/lib/kouhou/domain/labels'
import { addDays, dateOf, formatDate, monthGrid, startOfWeek, timeOf, weekday, WEEKDAY_LABELS } from '@/lib/kouhou/domain/time'
import { TONE_CLASS } from '@/components/kouhou/kit/primitives'
import { BrandDot, PlatformMark } from '@/components/kouhou/domain/tags'
import { cn } from '@/lib/utils'

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)

function KindIcon({ kind }: { kind: CalendarEntry['kind'] }) {
  if (kind === 'event') return <PartyPopper className="size-3 shrink-0" aria-hidden />
  if (kind === 'draftDue') return <Flag className="size-3 shrink-0" aria-hidden />
  if (kind === 'approvalDue') return <CalendarClock className="size-3 shrink-0" aria-hidden />
  return null
}

export function EntryChip({ s, entry, dense }: { s: AppState; entry: CalendarEntry; dense?: boolean }) {
  const brand = s.brands.find((b) => b.id === entry.brandId)
  const acc = entry.post ? getAccount(s, entry.post.accountId) : undefined
  const status = entry.post && entry.kind === 'post' ? STATUS_META[entry.post.status] : null
  const label = entry.kind === 'post' ? entry.title : `${KIND_LABEL[entry.kind]}：${entry.title}`
  const cls = cn(
    'flex w-full min-w-0 items-center gap-1 rounded border px-1.5 text-left text-xs leading-tight transition-colors',
    dense ? 'h-6' : 'min-h-7 py-1',
    entry.kind === 'post' && status ? TONE_CLASS[status.tone] : 'border-dashed border-border bg-card text-muted-foreground',
    'hover:border-primary',
  )
  const inner = (
    <>
      <BrandDot brand={brand} />
      <span className="tabular shrink-0 font-medium">{timeOf(entry.at)}</span>
      {acc && entry.kind === 'post' && <PlatformMark platform={acc.platform} className="h-4 min-w-5 text-[9px]" />}
      <KindIcon kind={entry.kind} />
      <span className="truncate">{label}</span>
      {status && <span className="sr-only">（{status.label}）</span>}
    </>
  )
  if (entry.post)
    return (
      <Link href={`/kouhou/posts/detail?id=${encodeURIComponent(entry.post.id)}`} className={cls} title={`${label}（${status?.label ?? KIND_LABEL[entry.kind]}）`}>
        {inner}
      </Link>
    )
  return (
    <div className={cls} title={label}>
      {inner}
    </div>
  )
}

function newHref(at: string) {
  return `/kouhou/posts/new?at=${encodeURIComponent(at)}`
}

export function MonthView({
  s,
  cursor,
  byDate,
  selected,
  onSelect,
  onMore,
  onOpenDay,
}: {
  s: AppState
  cursor: JstDate
  byDate: Map<string, CalendarEntry[]>
  selected: JstDate
  onSelect: (d: JstDate) => void
  onMore: (d: JstDate) => void
  onOpenDay: (d: JstDate) => void
}) {
  const router = useRouter()
  const [y, m] = cursor.split('-').map(Number)
  const days = monthGrid(y, m)
  const today = dateOf(s.now)
  const MAX = 3
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/60 text-center text-xs font-bold text-muted-foreground">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={w} className={cn('py-1.5', i === 0 && 'text-danger', i === 6 && 'text-primary')}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDate.get(d) ?? []
          const inMonth = Number(d.slice(5, 7)) === m
          const isToday = d === today
          const isSel = d === selected
          const wd = weekday(d)
          return (
            <div
              key={d}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return
                if (window.matchMedia('(min-width: 768px)').matches) router.push(newHref(`${d}T12:00`))
                else onSelect(d)
              }}
              className={cn(
                'group relative flex min-h-16 cursor-pointer flex-col gap-0.5 border-r border-b p-1 md:min-h-28',
                !inMonth && 'bg-muted/40',
                isSel && 'ring-2 ring-inset ring-primary md:ring-0',
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => (window.matchMedia('(min-width: 768px)').matches ? onOpenDay(d) : onSelect(d))}
                  aria-label={`${formatDate(d)}（${list.length}件）`}
                  className={cn(
                    'tabular inline-flex size-6 items-center justify-center rounded-full text-xs font-medium hover:bg-muted',
                    !inMonth && 'text-muted-foreground',
                    wd === 0 && inMonth && 'text-danger',
                    wd === 6 && inMonth && 'text-primary',
                    isToday && 'bg-primary font-bold text-primary-foreground hover:bg-primary',
                  )}
                >
                  {Number(d.slice(8))}
                </button>
                <Link
                  href={newHref(`${d}T12:00`)}
                  aria-label={`${formatDate(d)} に新規投稿`}
                  className="hidden rounded p-0.5 text-muted-foreground opacity-0 hover:bg-muted hover:text-primary focus-visible:opacity-100 group-hover:opacity-100 md:inline-flex"
                >
                  <Plus className="size-3.5" />
                </Link>
              </div>
              <div className="hidden flex-col gap-0.5 md:flex">
                {list.slice(0, MAX).map((e) => (
                  <EntryChip key={e.key} s={s} entry={e} dense />
                ))}
                {list.length > MAX && (
                  <button type="button" onClick={() => onMore(d)} className="h-6 rounded px-1.5 text-left text-xs font-medium text-primary hover:bg-accent">
                    他{list.length - MAX}件
                  </button>
                )}
              </div>
              {list.length > 0 && (
                <div className="pointer-events-none flex flex-wrap gap-0.5 md:hidden" aria-hidden>
                  {list.slice(0, 4).map((e) => (
                    <span key={e.key} className="size-1.5 rounded-full" style={{ backgroundColor: s.brands.find((b) => b.id === e.brandId)?.color }} />
                  ))}
                  {list.length > 4 && <span className="text-[10px] leading-none text-muted-foreground">+{list.length - 4}</span>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimeGrid({ s, dates, byDate }: { s: AppState; dates: JstDate[]; byDate: Map<string, CalendarEntry[]> }) {
  const today = dateOf(s.now)
  const nowHour = Number(s.now.slice(11, 13))
  const bucket = (h: number, list: CalendarEntry[]) =>
    list.filter((e) => {
      const eh = Number(e.at.slice(11, 13))
      const clamped = Math.min(Math.max(eh, HOURS[0]), HOURS[HOURS.length - 1])
      return clamped === h
    })
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className={cn(dates.length > 1 && 'min-w-[720px]')}>
        <div className="grid border-b bg-muted/60 text-xs font-bold" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
          <div className="py-1.5 text-center text-muted-foreground">JST</div>
          {dates.map((d) => (
            <div key={d} className={cn('border-l px-2 py-1.5', d === today && 'text-primary')}>
              {formatDate(d)}
              {d === today && <span className="ml-1 rounded bg-primary px-1 text-[10px] text-primary-foreground">今日</span>}
            </div>
          ))}
        </div>
        {HOURS.map((h) => (
          <div key={h} className="grid border-b last:border-b-0" style={{ gridTemplateColumns: `3.5rem repeat(${dates.length}, minmax(0, 1fr))` }}>
            <div className="tabular px-2 py-1 text-right text-xs text-muted-foreground">
              {h === HOURS[0] ? `〜${h}:00` : h === HOURS[HOURS.length - 1] ? `${h}:00〜` : `${h}:00`}
            </div>
            {dates.map((d) => {
              const list = bucket(h, byDate.get(d) ?? [])
              const at = `${d}T${String(h).padStart(2, '0')}:00`
              const isNow = d === today && h === nowHour
              return (
                <div key={d} className={cn('group relative flex min-h-11 flex-col gap-0.5 border-l p-0.5', isNow && 'bg-info-soft')}>
                  {list.map((e) => (
                    <EntryChip key={e.key} s={s} entry={e} />
                  ))}
                  <Link
                    href={newHref(at)}
                    aria-label={`${formatDate(d)} ${h}:00 に新規投稿`}
                    className={cn(
                      'flex flex-1 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100',
                      list.length ? 'min-h-5' : 'min-h-9',
                    )}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Link>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function WeekView({ s, cursor, byDate }: { s: AppState; cursor: JstDate; byDate: Map<string, CalendarEntry[]> }) {
  const start = startOfWeek(cursor)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return <TimeGrid s={s} dates={dates} byDate={byDate} />
}

export function DayView({ s, cursor, byDate }: { s: AppState; cursor: JstDate; byDate: Map<string, CalendarEntry[]> }) {
  return <TimeGrid s={s} dates={[cursor]} byDate={byDate} />
}

export function DayList({ s, date, list }: { s: AppState; date: JstDate; list: CalendarEntry[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold">{formatDate(date)}</h3>
        <Link href={newHref(`${date}T12:00`)} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-xs font-medium hover:bg-muted">
          <Plus className="size-3.5" aria-hidden />
          この日に作成
        </Link>
      </div>
      {list.length ? (
        <ul className="flex flex-col gap-1">
          {list.map((e) => (
            <li key={e.key}>
              <EntryChip s={s} entry={e} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">予定はありません</p>
      )}
    </div>
  )
}
