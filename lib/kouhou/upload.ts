'use client'

/**
 * 画像のアップロード（素材の登録まで）。
 * - 大きい写真は送信できる大きさ（5MB・長辺4096px）まで自動で縮める。HEIC など送れない形式は JPEG に変える
 * - 本番：GAS 経由で Google Drive に保存して素材に登録。デモ：縮小した画像をブラウザ内に置く
 */
import { registerUpload, type UploadInput } from '@/lib/kouhou/domain/commands'
import { runAction } from '@/lib/kouhou/store/store'
import { LIVE_MODE, uploadImage } from '@/lib/kouhou/live'

export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
const SEND_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const MAX_SIDE = 4096
/** デモはブラウザ内に保存するので小さくする */
const DEMO_SIDE = 1080

export const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)

export const baseName = (name: string) => name.replace(/\.[^.]+$/, '').trim() || '画像'

function loadBitmap(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('この画像は読み込めません（PNG・JPEG・GIF・WebP にしてください）'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), type, quality))
}

/** 送信できる形・大きさにした画像を返す。縮めなくてよいものはそのまま */
export async function prepareImage(file: File, maxSide = LIVE_MODE ? MAX_SIDE : DEMO_SIDE): Promise<{ blob: Blob; resized: boolean }> {
  const sendable = SEND_TYPES.includes(file.type)
  // GIF はアニメーションが消えるので縮めない
  if (file.type === 'image/gif') {
    if (file.size > UPLOAD_MAX_BYTES) throw new Error('GIF は5MB以下にしてください')
    return { blob: file, resized: false }
  }
  const img = await loadBitmap(file)
  const w = img.naturalWidth
  const h = img.naturalHeight
  URL.revokeObjectURL(img.src)
  if (sendable && file.size <= UPLOAD_MAX_BYTES && Math.max(w, h) <= maxSide) return { blob: file, resized: false }
  let scale = Math.min(1, maxSide / Math.max(w, h))
  // 透過のある PNG は PNG のまま、それ以外は JPEG にする
  const type = file.type === 'image/png' && file.size <= UPLOAD_MAX_BYTES * 2 ? 'image/png' : 'image/jpeg'
  for (let i = 0; i < 6; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    const ctx = canvas.getContext('2d')!
    if (type === 'image/jpeg') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    const fresh = await loadBitmap(file)
    ctx.drawImage(fresh, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(fresh.src)
    const blob = await toBlob(canvas, type, 0.88)
    if (blob.size <= UPLOAD_MAX_BYTES) return { blob, resized: true }
    scale *= 0.8
  }
  throw new Error('画像を5MB以下に縮められませんでした')
}

function readDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('ファイルを読み込めませんでした'))
    r.readAsDataURL(blob)
  })
}

export type UploadMeta = Omit<UploadInput, 'name' | 'fileId' | 'dataUrl'>

/** 1枚をアップロードして素材に登録し、素材IDを返す */
export async function uploadOne(file: File, meta: UploadMeta, name = baseName(file.name)): Promise<{ id: string; resized: boolean }> {
  const { blob, resized } = await prepareImage(file)
  const ext = blob.type === 'image/jpeg' ? '.jpg' : blob.type === 'image/png' ? '.png' : blob.type === 'image/webp' ? '.webp' : '.gif'
  const input: UploadInput = LIVE_MODE ? { ...meta, name, fileId: await uploadImage(blob, `${baseName(file.name)}${ext}`) } : { ...meta, name, dataUrl: await readDataUrl(blob) }
  const r = await runAction(registerUpload, input)
  if (!r.ok || !r.id) throw new Error(r.ok ? '登録できませんでした' : r.message)
  return { id: r.id, resized }
}
