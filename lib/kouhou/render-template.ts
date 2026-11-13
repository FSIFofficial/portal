// 画像テンプレート（背景＋文字レイヤー）を 1080×1080 の PNG に書き出す（本番で送信する画像を作るため）。
// 画面の TemplateRender（components/kouhou/domain/asset-thumb.tsx）と同じ配置ルールで描く。

import type { AppState, TemplateEdit, TextLayer } from './domain/types'
import { mediaUrl } from './paths'
import { loadMedia } from './live'

const SIZE = 1080

const FONT: Record<TextLayer['font'], string> = {
  sans: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif',
  serif: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const url = src.startsWith('drive:') ? await loadMedia(src.slice(6)) : mediaUrl(src)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('背景画像を読み込めませんでした'))
    img.src = url
  })
}

/** object-fit: cover と同じ切り抜きで描く */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const w = img.naturalWidth || SIZE
  const h = img.naturalHeight || SIZE
  const scale = Math.max(SIZE / w, SIZE / h)
  const dw = w * scale
  const dh = h * scale
  ctx.drawImage(img, (SIZE - dw) / 2, (SIZE - dh) / 2, dw, dh)
}

export async function renderTemplatePng(s: AppState, edit: TemplateEdit): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を作成できませんでした')
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(0, 0, SIZE, SIZE)
  const bg = s.assets.find((a) => a.id === edit.backgroundAssetId)
  if (bg?.src) drawCover(ctx, await loadImage(bg.src))
  await document.fonts?.ready
  for (const l of edit.layers) {
    const lines = l.text.split('\n')
    const lineHeight = l.fontSize * 1.25
    ctx.font = `${l.weight} ${l.fontSize}px ${FONT[l.font]}`
    ctx.fillStyle = l.color
    ctx.textAlign = l.align
    ctx.textBaseline = 'middle'
    const x = (l.x / 100) * SIZE
    // 画面と同じく、文字のかたまりの縦の中心を y に合わせる
    const top = (l.y / 100) * SIZE - (lines.length * lineHeight) / 2
    lines.forEach((line, i) => ctx.fillText(line, x, top + lineHeight * (i + 0.5)))
  }
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を作成できませんでした'))), 'image/png'))
}
