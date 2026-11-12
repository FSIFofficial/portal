// アクセス権限管理の本番接続。
// - ログイン：ポータルのセッション（同じサイトの localStorage 'fsif-portal-session'）をそのまま使う。別のログインは無い
// - 保存先：権限管理用の GAS（NEXT_PUBLIC_ACCESS_GAS_URL）。GAS はポータルの GAS にセッションを問い合わせ、全権管理者だけを通す
// - ツール一覧・アカウント：ポータルの GAS（lib/api.ts）を、ログイン中の全権管理者の権限で直接呼ぶ
// NEXT_PUBLIC_ACCESS_GAS_URL が無い（またはポータルがデモモード）ときは、ブラウザ内のデモデータで動く。

import { ApiError, api } from '@/lib/api'
import { DEMO_MODE } from '@/lib/config'
import type { Tool as PortalSiteTool, User as PortalUser } from '@/lib/types'
import { computeEffectiveRows } from './effective'
import type { AccessRepository, SaveResult } from './repository'
import type { AppData, PortalTool } from './types'

export const ACCESS_GAS_URL = (process.env.NEXT_PUBLIC_ACCESS_GAS_URL ?? '').trim()
export const LIVE_MODE = !!ACCESS_GAS_URL && !DEMO_MODE
/** ポータルは本番なのに権限管理の GAS が未設定（本番でデモデータを見せないよう、案内を出す） */
export const ACCESS_NOT_CONFIGURED = !ACCESS_GAS_URL && !DEMO_MODE

/* ---------- ポータルのセッション ---------- */

const SESSION_KEY = 'fsif-portal-session'

/** ポータルでログインしたときのセッション。無い・期限切れなら null */
export function readPortalSession(): string | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as { token?: string; expiresAt?: number } | null
    if (!s?.token || !s.expiresAt || s.expiresAt < Date.now() + 60_000) return null
    return s.token
  } catch {
    return null
  }
}

/** ポータルのトップ（ログイン画面）の URL */
export const portalHomeUrl = () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/`

/* ---------- 権限管理の GAS ---------- */

export class AccessApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message)
  }
}

async function callAccessGas<T>(action: string, token: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(ACCESS_GAS_URL, {
      method: 'POST',
      // text/plain で CORS のプリフライトを避ける（GAS は OPTIONS に応答できない）
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, payload }),
      redirect: 'follow',
    })
  } catch {
    throw new AccessApiError('NETWORK', 'サーバーに接続できませんでした。通信環境を確認してください')
  }
  let body: { ok: boolean; data?: T; error?: { code: string; message: string; latest?: unknown } }
  try {
    body = await res.json()
  } catch {
    throw new AccessApiError('INTERNAL', '権限管理のサーバーから不正な応答がありました（GAS のデプロイ設定を確認してください）')
  }
  if (!body.ok) {
    const e = body.error ?? { code: 'INTERNAL', message: '不明なエラーです' }
    throw new AccessApiError(e.code, e.message, e as unknown as Record<string, unknown>)
  }
  return body.data as T
}

export interface LiveMe {
  email: string
  name: string
  picture: string
}

/** 読み込み。GAS にまだデータが無ければ data は null */
export async function loadLive(token: string): Promise<{ me: LiveMe; data: AppData | null }> {
  return callAccessGas('load', token)
}

/** 履歴・通知は増え続けるので、保存のたびに新しいものだけ残す */
const KEEP_AUDIT = 3000
const KEEP_NOTIFICATIONS = 2000

function forStorage(data: AppData): AppData {
  const { operators: _operators, ...rest } = data
  return { ...rest, audit: rest.audit.slice(0, KEEP_AUDIT), notifications: rest.notifications.slice(0, KEEP_NOTIFICATIONS) }
}

/** 本番の保存先。保存のたびに実効権限（各ツールが問い合わせる表）も計算して一緒に送る */
export function liveRepository(token: string, operators: string[]): AccessRepository {
  const withOperators = (d: AppData): AppData => ({ ...d, operators })
  return {
    async load() {
      const r = await loadLive(token)
      if (!r.data) throw new AccessApiError('NO_DATA', 'データがありません')
      return withOperators(r.data)
    },
    async save(next, expectedVersion): Promise<SaveResult> {
      const stored = forStorage(next)
      try {
        // 版はサーバーが決める（コマンドによっては画面側で版を上げないものがあるため）
        const r = await callAccessGas<{ version: number }>('save', token, { data: stored, expectedVersion, effective: computeEffectiveRows(stored) })
        return { ok: true, data: withOperators({ ...stored, version: r.version }) }
      } catch (e) {
        if (e instanceof AccessApiError && e.code === 'CONFLICT' && e.extra?.latest) {
          return { ok: false, reason: 'conflict', latest: withOperators(e.extra.latest as AppData) }
        }
        return { ok: false, reason: 'error', message: e instanceof Error ? e.message : '保存に失敗しました' }
      }
    },
    async reset() {
      throw new AccessApiError('BAD_REQUEST', '本番のデータは初期化できません')
    },
  }
}

/* ---------- ポータル（ツール一覧・アカウント） ---------- */

const portalError = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'ポータルとの通信に失敗しました')

/**
 * ポータルのツール一覧を、同期用のカタログにする。
 * ポータルのツールには役割が無いので、役割・連携状態は権限管理側で定義したもの（いまの tools）を引き継ぐ。
 * 「停止中」のツールは無効として扱う。
 */
export async function fetchPortalCatalog(token: string, current: AppData): Promise<PortalTool[]> {
  let tools: PortalSiteTool[]
  try {
    tools = (await api.adminData(token)).tools
  } catch (e) {
    throw new Error(portalError(e))
  }
  return tools.map((t) => {
    const existing = current.tools.find((x) => x.id === t.id)
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      url: t.url,
      enabled: t.status !== '停止中',
      integration: existing?.integration ?? 'unsupported',
      roles: (existing?.roles ?? []).map(({ toolId: _toolId, ...r }) => r),
      defaultRoleKey: existing?.defaultRoleKey,
    }
  })
}

/** ポータルのアカウント一覧（取り込み用） */
export async function fetchPortalUsers(token: string): Promise<PortalUser[]> {
  try {
    return (await api.adminData(token)).users ?? []
  } catch (e) {
    throw new Error(portalError(e))
  }
}

export interface PortalAccountResult {
  added: string[]
  activated: string[]
  deactivated: string[]
  renamed: string[]
  warnings: string[]
}

/**
 * メンバーの変更をポータルのアカウントに反映する（メンバーに追加した人がポータルに入れるように）。
 * - 新しいメンバー・メールを変えたメンバー：アカウントが無ければ作る（ロールはポータルの「自動登録のロール」、無ければ member）
 * - 退会：アカウントを無効にする／退会から戻した：有効にする
 * - 氏名の変更：アカウントの名前も変える
 * - メールを変えたときの古いアカウントは無効にする
 * ポータル側でしか持たない情報（ロール・メモ）は変えない。失敗しても権限管理の保存は取り消さない（warnings に入れる）。
 */
export async function syncPortalAccounts(token: string, before: AppData, after: AppData, selfEmail: string): Promise<PortalAccountResult> {
  const result: PortalAccountResult = { added: [], activated: [], deactivated: [], renamed: [], warnings: [] }
  const changed = after.members.filter((m) => {
    const b = before.members.find((x) => x.id === m.id)
    return !b || b.email !== m.email || b.name !== m.name || b.status !== m.status
  })
  if (changed.length === 0) return result

  let users: PortalUser[]
  let defaultRoles: string[] = []
  try {
    const admin = await api.adminData(token)
    users = admin.users ?? []
    defaultRoles = admin.settings?.defaultRoles ?? []
    if (defaultRoles.length === 0 && admin.roles.some((r) => r.id === 'member')) defaultRoles = ['member']
  } catch (e) {
    result.warnings.push(`ポータルのアカウントを読み込めませんでした：${portalError(e)}`)
    return result
  }
  const byEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))

  const toAdd: { email: string; name: string }[] = []
  const toActivate: string[] = []
  const toDeactivate: string[] = []
  for (const m of changed) {
    const b = before.members.find((x) => x.id === m.id)
    const email = m.email.toLowerCase()
    const user = byEmail.get(email)
    const shouldBeActive = m.status !== 'withdrawn'
    if (b && b.email.toLowerCase() !== email) {
      const old = byEmail.get(b.email.toLowerCase())
      if (old?.active && b.email.toLowerCase() !== selfEmail) toDeactivate.push(old.email)
    }
    if (!user) {
      if (shouldBeActive) toAdd.push({ email, name: m.name })
      continue
    }
    if (user.active !== shouldBeActive) {
      if (!shouldBeActive && email === selfEmail) result.warnings.push('自分自身のポータルのアカウントは無効にできません')
      else (shouldBeActive ? toActivate : toDeactivate).push(user.email)
    }
    if (b && b.name !== m.name && user.name !== m.name) {
      try {
        await api.saveUser(token, { ...user, name: m.name }, false)
        result.renamed.push(email)
      } catch (e) {
        result.warnings.push(`${m.name} のアカウント名を変更できませんでした：${portalError(e)}`)
      }
    }
  }

  if (toAdd.length) {
    try {
      const r = await api.bulkAddUsers(token, toAdd, defaultRoles)
      result.added.push(...r.added)
      for (const s of r.skipped) result.warnings.push(`${s.email}：${s.reason}`)
    } catch (e) {
      result.warnings.push(`ポータルのアカウントを作成できませんでした：${portalError(e)}`)
    }
  }
  for (const [list, active] of [
    [toActivate, true],
    [toDeactivate, false],
  ] as const) {
    if (list.length === 0) continue
    try {
      const r = await api.bulkSetActive(token, list, active)
      ;(active ? result.activated : result.deactivated).push(...r.changed)
      for (const s of r.skipped) result.warnings.push(`${s.email}：${s.reason}`)
    } catch (e) {
      result.warnings.push(`ポータルのアカウントを${active ? '有効' : '無効'}にできませんでした：${portalError(e)}`)
    }
  }
  return result
}
