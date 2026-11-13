// 広報管理の本番接続。
// - ログイン：ポータルのセッション（同じサイトの localStorage 'fsif-portal-session'）をそのまま使う
// - 保存先：広報管理用の GAS（NEXT_PUBLIC_KOUHOU_GAS_URL）。GAS はポータルの GAS にセッションを問い合わせて本人を確かめる
// NEXT_PUBLIC_KOUHOU_GAS_URL が無い（またはポータルがデモモード）ときは、ブラウザ内のデモデータで動く。

import { DEMO_MODE } from '@/lib/config'
import type { AppState } from './domain/types'
import type { Result } from './domain/actions'

export const KOUHOU_GAS_URL = (process.env.NEXT_PUBLIC_KOUHOU_GAS_URL ?? '').trim()
export const LIVE_MODE = !!KOUHOU_GAS_URL && !DEMO_MODE
/** ポータルは本番なのに広報管理の GAS が未設定（本番でデモデータを見せないよう、案内を出す） */
export const KOUHOU_NOT_CONFIGURED = !KOUHOU_GAS_URL && !DEMO_MODE

/** この画面が前提としている GAS の版名（gas/kouhou/Code.gs の1行目 GAS_VERSION と同じにする） */
export const EXPECTED_KOUHOU_GAS_VERSION = 'kouhou-1.3.0'

const SESSION_KEY = 'fsif-portal-session'

/** ポータルでログインしたときのセッション。無い・期限切れなら null */
export function readPortalSession(): string | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as { token?: string; expiresAt?: number } | null
    if (!s?.token || !s.expiresAt || s.expiresAt < Date.now() + 30_000) return null
    return s.token
  } catch {
    return null
  }
}

export class KouhouApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function callKouhou<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = readPortalSession()
  if (!token) throw new KouhouApiError('UNAUTHENTICATED', 'ポータルのログインの有効期限が切れました。ポータルでログインし直してください')
  let res: Response
  try {
    res = await fetch(KOUHOU_GAS_URL, {
      method: 'POST',
      // text/plain で CORS のプリフライトを避ける（GAS は OPTIONS に応答できない）
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, payload }),
      redirect: 'follow',
    })
  } catch {
    throw new KouhouApiError('NETWORK', 'サーバーに接続できませんでした。通信環境を確認してください')
  }
  let body: { ok: boolean; data?: T; error?: { code: string; message: string } }
  try {
    body = await res.json()
  } catch {
    throw new KouhouApiError('INTERNAL', '広報管理のサーバーから不正な応答がありました（GAS のデプロイ設定を確認してください）')
  }
  if (!body.ok) throw new KouhouApiError(body.error?.code ?? 'INTERNAL', body.error?.message ?? '不明なエラーです')
  return body.data as T
}

export type LoadResponse =
  | { registered: false; email: string; gasVersion: string; managedBy?: 'access'; reason?: string }
  | { registered: true; suspended: true; email: string; gasVersion: string }
  | { registered: true; suspended?: false; email: string; state: AppState; gasVersion: string }

export interface CommandResponse {
  result: Result
  state: AppState
}

/** 日本時間の今（"YYYY-MM-DDTHH:mm"） */
export function jstNow(): string {
  const d = new Date(Date.now() + 9 * 3600_000)
  return d.toISOString().slice(0, 16)
}

/** 画像ファイルを base64 にして Drive に保存する。戻り値は Drive のファイルID */
export async function uploadImage(file: Blob, fileName: string): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(new Error('ファイルを読み込めませんでした'))
    r.readAsDataURL(file)
  })
  const { fileId } = await callKouhou<{ fileId: string }>('upload', { base64, mimeType: file.type, fileName })
  return fileId
}

/* ---------- Drive の画像の表示（GAS から data URL で受け取り、このタブの中だけで覚えておく） ---------- */

const mediaCache = new Map<string, Promise<string>>()

export function loadMedia(fileId: string): Promise<string> {
  let p = mediaCache.get(fileId)
  if (!p) {
    p = callKouhou<{ dataUrl: string }>('media', { fileId }).then((r) => r.dataUrl)
    p.catch(() => mediaCache.delete(fileId))
    mediaCache.set(fileId, p)
  }
  return p
}
