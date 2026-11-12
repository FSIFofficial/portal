import type { JstDate, JstDateTime } from './types'

export const BASE_NOW: JstDateTime = '2026-11-06T10:00'
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** JST壁時計文字列 ⇔ 分単位の通し番号（UTC演算で日付計算を安定させる） */
export function toMinutes(dt: JstDateTime): number {
  const [d, t = '00:00'] = dt.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  return Date.UTC(y, m - 1, day, hh, mm) / 60000
}

export function fromMinutes(min: number): JstDateTime {
  const d = new Date(min * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function addMinutes(dt: JstDateTime, m: number) {
  return fromMinutes(toMinutes(dt) + m)
}

export function addHours(dt: JstDateTime, h: number) {
  return addMinutes(dt, h * 60)
}

export function addDays(date: JstDate, days: number): JstDate {
  return fromMinutes(toMinutes(`${date}T00:00`) + days * 1440).slice(0, 10)
}

export function dateOf(dt: JstDateTime): JstDate {
  return dt.slice(0, 10)
}

export function timeOf(dt: JstDateTime) {
  return dt.slice(11, 16)
}

export function weekday(date: JstDate) {
  return new Date(toMinutes(`${date}T00:00`) * 60000).getUTCDay()
}

export function weekdayLabel(date: JstDate) {
  return WEEKDAYS[weekday(date)]
}

export const WEEKDAY_LABELS = WEEKDAYS

export function isBefore(a: JstDateTime, b: JstDateTime) {
  return toMinutes(a) < toMinutes(b)
}

export function diffHours(a: JstDateTime, b: JstDateTime) {
  return (toMinutes(a) - toMinutes(b)) / 60
}

export function formatDateTime(dt: JstDateTime | null | undefined) {
  if (!dt) return '未定'
  const [d, t] = dt.split('T')
  const [y, m, day] = d.split('-')
  return `${y}/${m}/${day} ${t}`
}

export function formatDateTimeShort(dt: JstDateTime | null | undefined) {
  if (!dt) return '未定'
  const [d, t] = dt.split('T')
  const [, m, day] = d.split('-')
  return `${Number(m)}/${Number(day)}(${weekdayLabel(d)}) ${t}`
}

export function formatDate(date: JstDate) {
  const [y, m, d] = date.split('-')
  return `${y}/${m}/${d}(${weekdayLabel(date)})`
}

export function monthGrid(year: number, month: number): JstDate[] {
  const first: JstDate = `${year}-${pad(month)}-01`
  const start = addDays(first, -weekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function startOfWeek(date: JstDate) {
  return addDays(date, -weekday(date))
}

export function compactDate(dt: JstDateTime | null) {
  return dt ? dt.slice(0, 10).replaceAll('-', '') : 'UNSCHEDULED'
}

export function isValidDateTime(v: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)
}
