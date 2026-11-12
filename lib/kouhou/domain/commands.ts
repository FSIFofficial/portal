/**
 * 本番（GAS）とブラウザで共通に使う「コマンド」の一覧と、本番用の補助。
 * - ブラウザは操作をまず手元で試し（入力ミスはその場で返す）、通ればコマンド名と引数を GAS に送る
 * - GAS は保存済みの状態に同じ関数を実行し、その結果を正とする（権限の判定もサーバー側で行われる）
 * scripts/build-kouhou-gas.mjs がこのファイル（と domain/ 以下）を GAS 用の1ファイルにまとめる。
 */
import type { AccountPermission, AppState, Asset, AssetKind, JstDateTime, Settings, User } from './types'
import {
  type Result,
  addComment,
  approveCancel,
  approveContent,
  approveSchedule,
  attachAssetToPost,
  completeContent,
  confirmSchedule,
  createPosts,
  emergencyStop,
  generateFromRecurrence,
  movePlan,
  newId,
  proposeCandidates,
  recordManual,
  rejectCancel,
  rejectContent,
  rejectSchedule,
  releaseStop,
  requestCancel,
  runClock,
  savePlan,
  savePost,
  saveRecurrence,
  saveTemplateCopy,
  selectCandidate,
  toggleEditOpen,
  toggleResolved,
  updateAnalyticsSetting,
} from './actions'
import { canView, getUser } from './rules'
import { createLiveSeed } from '../mock/live-seed'

/* ---------- アップロードした画像 ---------- */

export interface UploadInput {
  name: string
  kind: Extract<AssetKind, 'image' | 'logo' | 'background'>
  brandId: string
  purpose: string
  fileId: string
}

/** Drive に保存した画像を素材として登録する（ファイルの保存自体は GAS の upload が行う） */
export function registerUpload(s: AppState, input: UploadInput): Result {
  const user = getUser(s, s.currentUserId)
  if (!user || user.status !== 'active') return { ok: false, message: '登録できません' }
  if (!input.name.trim()) return { ok: false, message: '素材名を入力してください' }
  if (!s.brands.some((b) => b.id === input.brandId)) return { ok: false, message: 'ブランドを選択してください' }
  if (!/^[\w-]{10,}$/.test(input.fileId)) return { ok: false, message: 'ファイルが正しくありません' }
  const id = newId(s, 'as')
  s.assets.push({
    id,
    kind: input.kind,
    name: input.name.trim(),
    brandId: input.brandId,
    purpose: input.purpose.trim() || 'その他',
    src: `drive:${input.fileId}`,
    text: null,
    edit: null,
    sourceAssetId: null,
    updatedBy: user.id,
    updatedAt: s.now,
    fileId: input.fileId,
  })
  return { ok: true, message: '素材を追加しました', id }
}

/** テンプレートから書き出した画像（PNG）を素材に結び付ける。送信にはこの画像が使われる */
export function setAssetRender(s: AppState, assetId: string, fileId: string): Result {
  const user = getUser(s, s.currentUserId)
  if (!user || user.status !== 'active') return { ok: false, message: '保存できません' }
  const asset = s.assets.find((a) => a.id === assetId)
  if (!asset?.edit) return { ok: false, message: '素材が見つかりません' }
  if (!/^[\w-]{10,}$/.test(fileId)) return { ok: false, message: 'ファイルが正しくありません' }
  asset.fileId = fileId
  return { ok: true }
}

/* ---------- 管理者設定 ---------- */

/** 管理者設定で変えられる一覧。画面は変更前後を比べて、変わった項目だけを送る */
export const ADMIN_COLLECTIONS = ['brands', 'accounts', 'servers', 'channels', 'users', 'permissions', 'postTypes'] as const
export type AdminCollection = (typeof ADMIN_COLLECTIONS)[number]

export interface AdminPatch {
  upsert: Partial<Record<AdminCollection, unknown[]>>
  remove: Partial<Record<AdminCollection, string[]>>
  settings?: Settings
}

const keyOf = (c: AdminCollection, item: unknown) =>
  c === 'permissions' ? `${(item as AccountPermission).userId}|${(item as AccountPermission).accountId}` : (item as { id: string }).id

export function diffAdmin(before: AppState, after: AppState): AdminPatch {
  const patch: AdminPatch = { upsert: {}, remove: {} }
  for (const c of ADMIN_COLLECTIONS) {
    const prev = new Map((before[c] as unknown[]).map((x) => [keyOf(c, x), JSON.stringify(x)]))
    const next = after[c] as unknown[]
    const changed = next.filter((x) => prev.get(keyOf(c, x)) !== JSON.stringify(x))
    const nextKeys = new Set(next.map((x) => keyOf(c, x)))
    const removed = [...prev.keys()].filter((k) => !nextKeys.has(k))
    if (changed.length) patch.upsert[c] = changed
    if (removed.length) patch.remove[c] = removed
  }
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) patch.settings = after.settings
  return patch
}

export const isEmptyPatch = (p: AdminPatch) => !Object.keys(p.upsert).length && !Object.keys(p.remove).length && !p.settings

/** サーバーが管理する項目（画面から送られても上書きしない） */
const SERVER_OWNED: Partial<Record<AdminCollection, string[]>> = {
  accounts: ['connection', 'handle', 'connectionError'],
  users: ['publishSuccessCount'],
}

export function applyAdminPatch(s: AppState, patch: AdminPatch): Result {
  const user = getUser(s, s.currentUserId)
  if (!user?.isAdmin || user.status !== 'active') return { ok: false, message: '管理者設定を変更できるのは管理者のみです' }
  for (const c of ADMIN_COLLECTIONS) {
    const list = s[c] as unknown[]
    for (const k of patch.remove[c] ?? []) {
      const i = list.findIndex((x) => keyOf(c, x) === k)
      if (i >= 0) list.splice(i, 1)
    }
    for (const raw of patch.upsert[c] ?? []) {
      if (!raw || typeof raw !== 'object') return { ok: false, message: '送られたデータが正しくありません' }
      const item = { ...(raw as Record<string, unknown>) }
      const k = keyOf(c, item)
      if (!k || typeof k !== 'string' || k.includes('undefined')) return { ok: false, message: '送られたデータが正しくありません' }
      const i = list.findIndex((x) => keyOf(c, x) === k)
      const existing = i >= 0 ? (list[i] as Record<string, unknown>) : null
      for (const f of SERVER_OWNED[c] ?? []) {
        if (existing) item[f] = existing[f]
        else if (c === 'accounts' && f === 'connection') item[f] = s.live ? 'disconnected' : item[f]
        else if (c === 'users' && f === 'publishSuccessCount') item[f] = 0
      }
      if (i >= 0) list[i] = item
      else list.push(item)
    }
  }
  if (patch.settings) s.settings = patch.settings
  // 自分の管理者権限は外せない（誰も管理できなくなるのを防ぐ）
  const self = s.users.find((u) => u.id === user.id)
  if (!self?.isAdmin || self.status !== 'active') return { ok: false, message: '自分自身の管理者権限・利用状態は変更できません' }
  return { ok: true }
}

/* ---------- コマンドの一覧 ---------- */

/** GAS に送れる操作。名前は通信で使うので変えないこと（関数名は本番ビルドで短くなるため、名前はここで決める） */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const COMMANDS: Record<string, (s: AppState, ...args: any[]) => Result> = {
  createPosts,
  savePost,
  toggleEditOpen,
  completeContent,
  approveContent,
  rejectContent,
  proposeCandidates,
  selectCandidate,
  approveSchedule,
  rejectSchedule,
  confirmSchedule,
  requestCancel,
  approveCancel,
  rejectCancel,
  recordManual,
  addComment,
  toggleResolved,
  emergencyStop,
  releaseStop,
  updateAnalyticsSetting,
  generateFromRecurrence,
  savePlan,
  movePlan,
  saveRecurrence,
  saveTemplateCopy,
  attachAssetToPost,
  registerUpload,
  setAssetRender,
  applyAdminPatch,
}

/** 関数からコマンド名を引く（デモ専用の操作は null） */
export function commandName(fn: unknown): string | null {
  for (const [name, f] of Object.entries(COMMANDS)) if (f === fn) return name
  return null
}

/* ---------- GAS から呼ぶ入口 ---------- */

/** ログイン中の利用者（メールアドレス）を状態の利用者に結び付ける。招待中ならここで利用中にする */
export function resolveUser(s: AppState, email: string): User | null {
  const e = email.trim().toLowerCase()
  const u = s.users.find((x) => x.email.trim().toLowerCase() === e)
  if (!u) return null
  if (u.status === 'invited') u.status = 'active'
  return u
}

/** コマンドを実行する。成功したときだけ呼び出し側が保存する */
export function execute(s: AppState, userId: string, now: JstDateTime, name: string, args: unknown[]): Result {
  const fn = COMMANDS[name]
  if (!fn) return { ok: false, message: `不明な操作です（${name}）` }
  s.now = now
  s.currentUserId = userId
  s.live = true
  try {
    return fn(s, ...(Array.isArray(args) ? args : []))
  } catch (e) {
    return { ok: false, message: `処理中にエラーが発生しました：${e instanceof Error ? e.message : String(e)}` }
  }
}

/** その利用者に見せてよい範囲だけを返す（見られないアカウントの投稿・履歴・コメントは送らない） */
export function viewFor(s: AppState, userId: string): AppState {
  const user = getUser(s, userId)
  const posts = s.posts.filter((p) => canView(s, user, p.accountId))
  const ids = new Set(posts.map((p) => p.id))
  return {
    ...s,
    currentUserId: userId,
    posts,
    history: s.history.filter((h) => ids.has(h.postId)),
    comments: s.comments.filter((c) => c.targetType !== 'post' || ids.has(c.targetId)),
    notifications: s.notifications.filter((n) => !n.postId || ids.has(n.postId)).slice(0, 200),
  }
}

/** 素材の画像を見てよいか（Drive のファイルIDがこの状態の素材に使われているものか） */
export function isKnownFile(s: AppState, fileId: string) {
  return s.assets.some((a) => a.fileId === fileId || a.src === `drive:${fileId}`)
}

export { runClock, createLiveSeed }
