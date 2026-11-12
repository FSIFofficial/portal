import type { AnalyticsSetting, JstDateTime, Platform } from './types'
import { addHours, isBefore, toMinutes } from './time'

export interface MetricDef {
  key: string
  label: string
}

/** すべて「デモ指標」。実APIでの取得可否は未確認 */
export const METRICS: Record<Platform, MetricDef[]> = {
  x: [
    { key: 'impressions', label: '表示回数' },
    { key: 'likes', label: 'いいね' },
    { key: 'replies', label: '返信' },
    { key: 'shares', label: 'リポスト' },
  ],
  instagram: [
    { key: 'impressions', label: 'リーチ' },
    { key: 'likes', label: 'いいね' },
    { key: 'replies', label: 'コメント' },
    { key: 'saves', label: '保存' },
  ],
  discord: [
    { key: 'reactions', label: 'リアクション' },
    { key: 'replies', label: '返信' },
  ],
}

export const ALL_METRIC_KEYS = ['impressions', 'likes', 'replies', 'shares', 'saves', 'reactions']

export const STANDARD_SETTING: AnalyticsSetting = {
  mode: 'standard',
  customOffsetsHours: [1, 12, 24],
  interval: { value: 6, unit: 'hour' },
  end: { durationHours: 72, endAt: null, maxCount: 10 },
}

const UNIT_HOURS = { minute: 1 / 60, hour: 1, day: 24 }
const PREVIEW_LIMIT = 200

export interface PlanResult {
  offsets: number[]
  errors: string[]
  stoppedBy: string | null
}

export function planCheckpoints(setting: AnalyticsSetting, publishedAt: JstDateTime | null): PlanResult {
  const errors: string[] = []
  if (setting.mode === 'standard') return { offsets: [1, 12, 24], errors, stoppedBy: null }
  if (setting.mode === 'custom') {
    const offs = [...setting.customOffsetsHours].sort((a, b) => a - b)
    if (!offs.length) errors.push('取得時点を1つ以上追加してください')
    if (offs.some((o) => !(o > 0))) errors.push('取得時点は0より大きい時間で指定してください')
    if (new Set(offs).size !== offs.length) errors.push('同じ取得時点が重複しています')
    return { offsets: offs.filter((o) => o > 0), errors, stoppedBy: null }
  }
  const step = setting.interval.value * UNIT_HOURS[setting.interval.unit]
  const { durationHours, endAt, maxCount } = setting.end
  if (!(setting.interval.value > 0)) errors.push('間隔は1以上で指定してください')
  if (setting.interval.unit === 'minute' && setting.interval.value < 10) errors.push('分単位の間隔は10分以上にしてください（デモ仕様）')
  if (durationHours == null && endAt == null && maxCount == null) errors.push('終了条件を1つ以上設定してください')
  if (durationHours != null && !(durationHours > 0)) errors.push('期間は0より大きくしてください')
  if (maxCount != null && !(maxCount >= 1)) errors.push('最大回数は1以上にしてください')
  if (endAt && publishedAt && !isBefore(publishedAt, endAt)) errors.push('終了日時は公開日時より後にしてください')
  if (errors.length) return { offsets: [], errors, stoppedBy: null }

  const offsets: number[] = []
  let stoppedBy: string | null = null
  const endAtOffset = endAt && publishedAt ? (toMinutes(endAt) - toMinutes(publishedAt)) / 60 : null
  for (let i = 1; i <= PREVIEW_LIMIT; i++) {
    const o = +(step * i).toFixed(3)
    if (maxCount != null && offsets.length >= maxCount) {
      stoppedBy = '最大回数'
      break
    }
    if (durationHours != null && o > durationHours) {
      stoppedBy = '期間'
      break
    }
    if (endAtOffset != null && o > endAtOffset) {
      stoppedBy = '終了日時'
      break
    }
    offsets.push(o)
  }
  if (!stoppedBy) {
    errors.push(`取得回数がデモ上限（${PREVIEW_LIMIT}回）を超えます。終了条件を見直してください`)
  }
  return { offsets, errors, stoppedBy }
}

export function checkpointTime(publishedAt: JstDateTime, offsetHours: number) {
  return addHours(publishedAt, offsetHours)
}

export function formatOffset(h: number) {
  if (h < 1) return `${Math.round(h * 60)}分後`
  if (h % 24 === 0 && h >= 48) return `${h / 24}日後`
  return `${+h.toFixed(2)}時間後`
}
