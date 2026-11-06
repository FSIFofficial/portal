// Google Drive の共有リンクから、閲覧用・ダウンロード用・サムネイル用のURLを組み立てる。
// 実際に開けるかどうかは Drive 側の共有設定に従う（ポータルの権限とは別に Drive の共有設定も必要）。

import type { PortalDocument } from './types'
import { splitIconUrl } from './icon'

export type DriveKind = 'file' | 'document' | 'spreadsheets' | 'presentation' | 'forms' | 'folder' | 'unknown'

export interface DriveInfo {
  id: string
  kind: DriveKind
}

export function parseDriveUrl(url: string): DriveInfo | null {
  if (!url) return null
  const trimmed = url.trim()
  const docs = trimmed.match(/docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/([\w-]+)/)
  if (docs) return { kind: docs[1] as DriveKind, id: docs[2] }
  const folder = trimmed.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/)
  if (folder) return { kind: 'folder', id: folder[1] }
  const file = trimmed.match(/drive\.google\.com\/file\/d\/([\w-]+)/)
  if (file) return { kind: 'file', id: file[1] }
  const query = trimmed.match(/[?&]id=([\w-]+)/)
  if (query && /google\.com/.test(trimmed)) return { kind: 'file', id: query[1] }
  // IDだけが入力された場合
  if (/^[\w-]{25,}$/.test(trimmed)) return { kind: 'file', id: trimmed }
  return null
}

const EXPORT_FORMAT: Partial<Record<DriveKind, string>> = {
  document: 'pdf',
  spreadsheets: 'xlsx',
  presentation: 'pdf',
}

export function viewUrl(doc: Pick<PortalDocument, 'driveUrl'>): string {
  const info = parseDriveUrl(doc.driveUrl)
  if (!info) return doc.driveUrl
  if (info.kind === 'file') return `https://drive.google.com/file/d/${info.id}/view`
  return doc.driveUrl
}

/** ポータル内で表示するための埋め込みURL（Drive以外のリンクは空） */
export function previewUrl(doc: Pick<PortalDocument, 'driveUrl'>): string {
  const info = parseDriveUrl(doc.driveUrl)
  if (!info) return ''
  switch (info.kind) {
    case 'file': return `https://drive.google.com/file/d/${info.id}/preview`
    case 'document': return `https://docs.google.com/document/d/${info.id}/preview`
    case 'spreadsheets': return `https://docs.google.com/spreadsheets/d/${info.id}/preview`
    case 'presentation': return `https://docs.google.com/presentation/d/${info.id}/embed?start=false&loop=false`
    case 'folder': return `https://drive.google.com/embeddedfolderview?id=${info.id}#grid`
    case 'forms': return `https://docs.google.com/forms/d/${info.id}/viewform?embedded=true`
    default: return ''
  }
}

export function downloadUrl(doc: Pick<PortalDocument, 'driveUrl' | 'downloadUrl'>): string {
  if (doc.downloadUrl) return doc.downloadUrl
  const info = parseDriveUrl(doc.driveUrl)
  if (!info) return ''
  if (info.kind === 'file') return `https://drive.google.com/uc?export=download&id=${info.id}`
  const format = EXPORT_FORMAT[info.kind]
  if (format) return `https://docs.google.com/${info.kind}/d/${info.id}/export?format=${format}`
  // フォルダ・フォームは直接ダウンロードできない
  return ''
}

export function downloadLabel(doc: Pick<PortalDocument, 'driveUrl' | 'downloadUrl'>): string {
  if (doc.downloadUrl) return 'ダウンロード'
  const info = parseDriveUrl(doc.driveUrl)
  const format = info ? EXPORT_FORMAT[info.kind] : undefined
  return format ? `ダウンロード (${format.toUpperCase()})` : 'ダウンロード'
}

export function thumbnailUrl(doc: Pick<PortalDocument, 'driveUrl' | 'thumbnailUrl'>): string {
  if (doc.thumbnailUrl) return doc.thumbnailUrl
  const info = parseDriveUrl(doc.driveUrl)
  if (!info || info.kind === 'folder' || info.kind === 'forms') return ''
  return `https://drive.google.com/thumbnail?id=${info.id}&sz=w800`
}

/** 画像として表示するURL。Driveの共有リンクならサムネイルURLに変換する */
export function imageUrl(value: string, size = 200): string {
  // アイコンの表示位置（#fsif-crop=…）が付いていれば外す
  const url = splitIconUrl(value).src
  if (!url) return ''
  const info = parseDriveUrl(url)
  if (info && info.kind !== 'folder' && info.kind !== 'forms') return `https://drive.google.com/thumbnail?id=${info.id}&sz=w${size}`
  return url
}

export function driveKindLabel(url: string): string {
  const info = parseDriveUrl(url)
  switch (info?.kind) {
    case 'document': return 'Googleドキュメント'
    case 'spreadsheets': return 'Googleスプレッドシート'
    case 'presentation': return 'Googleスライド'
    case 'forms': return 'Googleフォーム'
    case 'folder': return 'Driveフォルダ'
    case 'file': return 'Driveファイル'
    default: return url ? '外部リンク' : 'リンク未設定'
  }
}
