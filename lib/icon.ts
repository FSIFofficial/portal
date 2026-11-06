// アイコン画像の表示位置（切り抜き）。
// 位置と拡大率は画像URLの末尾に「#fsif-crop=横%,縦%,倍率」として一緒に保存する（スプレッドシートの列を増やさずに済む）。
// URLの # 以降はブラウザがサーバーに送らないので、画像の取得には影響しない。

import type { CSSProperties } from 'react'

export interface IconCrop {
  /** 0〜100。画像のどの位置を枠の中心側に寄せるか（50 が中央） */
  x: number
  y: number
  /** 1〜4。1 は枠いっぱい（はみ出す部分だけ切れる） */
  zoom: number
}

export const DEFAULT_CROP: IconCrop = { x: 50, y: 50, zoom: 1 }
export const MAX_ZOOM = 4
const MARK = '#fsif-crop='

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

export function normalizeCrop(c: IconCrop): IconCrop {
  return {
    x: Math.round(clamp(Number.isFinite(c.x) ? c.x : 50, 0, 100) * 10) / 10,
    y: Math.round(clamp(Number.isFinite(c.y) ? c.y : 50, 0, 100) * 10) / 10,
    zoom: Math.round(clamp(Number.isFinite(c.zoom) ? c.zoom : 1, 1, MAX_ZOOM) * 100) / 100,
  }
}

export const isDefaultCrop = (c: IconCrop | null) => !c || (c.x === 50 && c.y === 50 && c.zoom === 1)

/** 保存されている値を、画像のURLと位置に分ける */
export function splitIconUrl(value: string): { src: string; crop: IconCrop | null } {
  const v = value ?? ''
  const i = v.indexOf(MARK)
  if (i < 0) return { src: v, crop: null }
  const [x, y, zoom] = v.slice(i + MARK.length).split(',').map(Number)
  return { src: v.slice(0, i), crop: normalizeCrop({ x, y, zoom }) }
}

/** 画像のURLと位置を、保存する1つの値にまとめる（中央・等倍なら位置は付けない） */
export function joinIconUrl(src: string, crop: IconCrop | null): string {
  const s = src.trim()
  if (!s) return ''
  if (isDefaultCrop(crop)) return s
  const c = normalizeCrop(crop!)
  return `${s}${MARK}${c.x},${c.y},${c.zoom}`
}

/** 枠（overflow: hidden）の中いっぱいに置いた img に付けるスタイル */
export function cropStyle(crop: IconCrop | null): CSSProperties {
  const c = crop ?? DEFAULT_CROP
  const pos = `${c.x}% ${c.y}%`
  return {
    objectFit: 'cover',
    objectPosition: pos,
    transform: c.zoom !== 1 ? `scale(${c.zoom})` : undefined,
    transformOrigin: pos,
  }
}
