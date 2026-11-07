// バックエンド呼び出し。GAS_URL が設定されていれば GAS へ、なければブラウザ内のデモバックエンドへ送る。
// デモバックエンドはGASと同じルール（権限・閲覧範囲）を再現している。

import { DEMO_MODE, EXPECTED_GAS_VERSION, GAS_URL } from './config'
import { createDemoDb, type DemoDb } from './demo-data'
import type {
  AckStatus, AdminData, CategoryKind, LogFilter, SelfCheckResult, Announcement, BackupStatus, Branding, PortalLink, DiscordStatus, TrashItem, ErrorDigestStatus, BootstrapData, BulkAddResult, HelpContent, LogEntry, Me, Permission, PortalDocument, Role,
  Settings, SystemCheck, Tool, UploadFolders, UploadResult, UsageStats, User,
} from './types'
import { DEFAULT_BRANDING } from './types'

export class ApiError extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

type Payload = Record<string, unknown>

export async function call<T>(action: string, token: string, payload: Payload = {}): Promise<T> {
  if (DEMO_MODE) return demoCall(action, token, payload) as T
  let res: Response
  try {
    res = await fetch(GAS_URL, {
      method: 'POST',
      // text/plain にすることで CORS プリフライトを発生させない（GAS は OPTIONS に応答できないため）
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, payload }),
      redirect: 'follow',
    })
  } catch {
    throw new ApiError('NETWORK', 'サーバーに接続できませんでした。通信環境を確認してください')
  }
  let body: { ok: boolean; data?: T; error?: { code: string; message: string } }
  try {
    body = await res.json()
  } catch {
    throw new ApiError('INTERNAL', 'サーバーから不正な応答がありました（GASのデプロイ設定を確認してください）')
  }
  if (!body.ok) throw new ApiError(body.error?.code ?? 'INTERNAL', body.error?.message ?? '不明なエラーです')
  return body.data as T
}

export const api = {
  /** Googleの IDトークンを渡して、GASのセッションを受け取る（以降はセッションで認証） */
  login: (idToken: string) => call<BootstrapData>('login', '', { idToken }),
  logout: (token: string) => call('logout', token),
  bootstrap: (token: string) => call<BootstrapData>('bootstrap', token),
  setFavorites: (token: string, ids: string[]) => call<{ favorites: string[] }>('setFavorites', token, { ids }),
  track: (token: string, kind: 'tool' | 'doc' | 'link', id: string) => call('track', token, { kind, id }),
  saveLink: (token: string, item: Partial<PortalLink>, isNew: boolean) => call<PortalLink>('saveLink', token, { item, isNew }),
  deleteLink: (token: string, id: string) => call('deleteLink', token, { id }),
  reorderLinks: (token: string, ids: string[], baseIds: string[]) => call<PortalLink[]>('reorderLinks', token, { ids, baseIds }),
  ackAnnouncement: (token: string, id: string) => call('ackAnnouncement', token, { id }),
  announcementAcks: (token: string, id: string) => call<AckStatus>('announcementAcks', token, { id }),
  setErrorDigest: (token: string, enabled: boolean) => call<ErrorDigestStatus>('setErrorDigest', token, { enabled }),
  saveDiscord: (token: string, item: { webhookUrl?: string; clearWebhook?: boolean; notifyDocuments: boolean; notifyAnnouncements: boolean; portalUrl: string }) =>
    call<DiscordStatus>('saveDiscord', token, { item }),
  testDiscord: (token: string) => call('testDiscord', token),
  saveBranding: (token: string, item: Branding) => call<Branding>('saveBranding', token, { item }),
  setSecurityAlerts: (token: string, enabled: boolean) => call<{ enabled: boolean; recipients: number }>('setSecurityAlerts', token, { enabled }),
  bulkSetActive: (token: string, emails: string[], active: boolean) =>
    call<{ changed: string[]; skipped: { email: string; reason: string }[] }>('bulkSetActive', token, { emails, active }),
  listTrash: (token: string) => call<TrashItem[]>('listTrash', token),
  restoreTrash: (token: string, key: string) => call('restoreTrash', token, { key }),
  purgeTrash: (token: string, key: string) => call('purgeTrash', token, { key }),
  adminData: (token: string) => call<AdminData>('adminData', token),
  // isNew=false のときは item.updatedAt（編集開始時点の値）で同時編集の衝突を検出する
  saveTool: (token: string, item: Partial<Tool>, isNew: boolean) => call<Tool>('saveTool', token, { item, isNew }),
  deleteTool: (token: string, id: string) => call('deleteTool', token, { id }),
  reorderTools: (token: string, ids: string[], baseIds: string[]) => call<Tool[]>('reorderTools', token, { ids, baseIds }),
  // notify=false のときは、新規追加でも Discord に通知しない
  // notifyUpdate=true のときは、編集でも Discord に「更新」として通知する
  saveDocument: (token: string, item: Partial<PortalDocument>, isNew: boolean, notify = true, notifyUpdate = false) =>
    call<PortalDocument>('saveDocument', token, { item, isNew, notify, notifyUpdate }),
  deleteDocument: (token: string, id: string) => call('deleteDocument', token, { id }),
  saveAnnouncement: (token: string, item: Partial<Announcement>, isNew: boolean, notify = true) => call<Announcement>('saveAnnouncement', token, { item, isNew, notify }),
  deleteAnnouncement: (token: string, id: string) => call('deleteAnnouncement', token, { id }),
  saveUser: (token: string, item: Partial<User>, isNew: boolean) => call<User>('saveUser', token, { item, isNew }),
  deleteUser: (token: string, email: string) => call('deleteUser', token, { email }),
  saveRole: (token: string, item: Partial<Role>, isNew: boolean) => call<Role>('saveRole', token, { item, isNew }),
  deleteRole: (token: string, id: string) => call('deleteRole', token, { id }),
  saveSettings: (token: string, item: Settings) => call<Settings>('saveSettings', token, { item }),
  listLogs: (token: string, filter: LogFilter = {}) => call<LogEntry[]>('listLogs', token, { limit: 300, ...filter }),
  markAllSeen: (token: string) => call<{ newSince: string }>('markAllSeen', token),
  searchContent: (token: string, q: string) => call<{ ids: string[] }>('searchContent', token, { q }),
  selfCheck: (token: string, opts: { sendMail?: boolean; sendDiscord?: boolean }) =>
    call<{ results: SelfCheckResult[]; checkedAt: string }>('selfCheck', token, opts),
  renameCategory: (token: string, kind: CategoryKind, from: string, to: string) => call<{ count: number }>('renameCategory', token, { kind, from, to }),
  systemCheck: (token: string) => call<SystemCheck>('systemCheck', token),
  saveHelp: (token: string, item: HelpContent) => call<HelpContent>('saveHelp', token, { item }),
  usageStats: (token: string) => call<UsageStats>('usageStats', token),
  uploadFile: (token: string, file: { name: string; mimeType: string; base64: string; purpose: 'document' | 'icon' }) =>
    call<UploadResult>('uploadFile', token, file),
  syncDrive: (token: string, id?: string) => call<{ count: number }>('syncDrive', token, { id }),
  restrictLinkSharing: (token: string, id: string) => call('restrictLinkSharing', token, { id }),
  bulkAddUsers: (token: string, users: { email: string; name: string }[], roles: string[]) =>
    call<BulkAddResult>('bulkAddUsers', token, { users, roles }),
  backupNow: (token: string) => call<BackupStatus>('backupNow', token),
  setBackupSchedule: (token: string, enabled: boolean) => call<BackupStatus>('setBackupSchedule', token, { enabled }),
  setUploadFolder: (token: string, purpose: 'document' | 'icon', url: string) => call<UploadFolders>('setUploadFolder', token, { purpose, url }),
}

/** ファイルを base64 文字列に変換する（アップロード用） */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(new Error('ファイルを読み込めませんでした'))
    reader.readAsDataURL(file)
  })
}

// ---------------------------------------------------------------------------
// デモバックエンド（localStorage に保存）
// ---------------------------------------------------------------------------

const DEMO_KEY = 'fsif-portal-demo-db-v7'
const SUPER = 'superadmin'

function loadDb(): DemoDb {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw) as DemoDb
  } catch {
    // ストレージが使えない環境では毎回初期データ
  }
  return createDemoDb()
}

function saveDb(db: DemoDb) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(db))
  } catch {
    // 保存できなくても画面上は動かす
  }
}

export function resetDemoDb() {
  try {
    window.localStorage.removeItem(DEMO_KEY)
  } catch {
    // noop
  }
}

export function demoUsers(): User[] {
  return loadDb().users.filter((u) => u.active)
}

const now = () => new Date().toISOString()
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
const newId = () => Math.random().toString(36).slice(2, 14)
const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v : String(v ?? '').split(',')).map((s) => String(s).trim()).filter(Boolean)

function fail(code: string, message: string): never {
  throw new ApiError(code, message)
}

function demoAuth(db: DemoDb, token: string): Me {
  if (!token) fail('UNAUTHENTICATED', 'ログインしてください')
  const user = db.users.find((u) => u.email === token)
  if (!user) fail('NOT_REGISTERED', `${token} はポータルに登録されていません。全権管理者に登録を依頼してください。`)
  if (!user.active) fail('FORBIDDEN', 'このアカウントは無効化されています')
  const perms = new Set<Permission>()
  user.roles.forEach((id) => db.roles.find((r) => r.id === id)?.permissions.forEach((p) => perms.add(p)))
  const isSuper = user.roles.includes(SUPER) || perms.has('*')
  return { email: user.email, name: user.name, picture: '', roles: user.roles, permissions: isSuper ? ['*'] : [...perms], isSuper, favorites: user.favorites ?? [] }
}

function requirePerm(me: Me, perm: Permission | 'any-manager') {
  const ok = me.isSuper || (perm === 'any-manager' ? me.permissions.length > 0 : me.permissions.includes(perm))
  if (!ok) fail('FORBIDDEN', 'この操作を行う権限がありません')
}

function canSee(me: Me, item: { visibleRoles: string[] }) {
  return me.isSuper || !item.visibleRoles.length || item.visibleRoles.some((r) => me.roles.includes(r))
}

function validRoles(db: DemoDb, v: unknown) {
  return list(v).filter((r) => db.roles.some((role) => role.id === r))
}

function required(v: unknown, label: string) {
  const s = String(v ?? '').trim()
  if (!s) fail('BAD_REQUEST', `${label}を入力してください`)
  return s
}

function url(v: unknown) {
  const s = String(v ?? '').trim()
  if (s && !/^https?:\/\//i.test(s)) fail('BAD_REQUEST', `URLは http:// または https:// で始めてください: ${s}`)
  return s
}

function checkConflict(existing: { updatedAt: string } | undefined, p: Payload, label: string) {
  const item = (p.item ?? {}) as { updatedAt?: string }
  if (p.isNew) {
    if (existing) fail('CONFLICT', `同じ${label}がすでに登録されています。画面を再読み込みしてください`)
    return
  }
  if (!existing) fail('CONFLICT', `この${label}は他の人が削除しました。画面を再読み込みしてください`)
  if (existing.updatedAt !== (item.updatedAt ?? '')) fail('CONFLICT', `この${label}は他の人が先に更新しました。最新の内容を読み込んでから編集し直してください`)
}

function recentMonths(n: number) {
  const d = new Date()
  return Array.from({ length: n }, (_, i) => new Date(d.getFullYear(), d.getMonth() - i, 15).toISOString().slice(0, 7))
}

function demoPopularity(db: DemoDb) {
  const months = recentMonths(3)
  const map: Record<string, number> = {}
  Object.values(db.stats).forEach((r) => {
    if (months.includes(r.month)) map[`${r.kind}:${r.itemId}`] = (map[`${r.kind}:${r.itemId}`] ?? 0) + r.count
  })
  return map
}

const TRASH_PERM: Record<string, Permission> = { Tools: 'tools.manage', Documents: 'documents.manage', Announcements: 'announcements.manage', Links: 'links.manage', Users: '*' }

function demoCanManage(me: Me, sheet: string) {
  const perm = TRASH_PERM[sheet]
  return !!perm && (me.isSuper || me.permissions.includes(perm))
}

function demoSheet(db: DemoDb, sheet: string) {
  return sheet === 'Tools' ? db.tools : sheet === 'Documents' ? db.documents : sheet === 'Announcements' ? db.announcements : sheet === 'Links' ? db.links : db.users
}

function toTrash(db: DemoDb, me: Me, sheet: TrashItem['sheet'], itemKey: string, title: string, data: unknown) {
  db.trash.push({ key: newId(), sheet, itemKey, title, data, deletedAt: now(), deletedBy: me.email })
}

function upsert<T>(rows: T[], key: keyof T, record: T) {
  const i = rows.findIndex((r) => r[key] === record[key])
  if (i >= 0) rows[i] = record
  else rows.push(record)
}

function demoCall(action: string, token: string, p: Payload): unknown {
  const db = loadDb()
  db.acks ??= []
  db.errorDigest ??= { enabled: false, lastSentAt: '', recipients: 1 }
  db.trash ??= []
  db.links ??= []
  db.securityAlerts ??= { enabled: true, recipients: 1 }
  db.uploadFolders ??= { document: { url: '', name: '', custom: false }, icon: { url: '', name: '', custom: false } }
  db.branding ??= { ...DEFAULT_BRANDING }
  db.discord ??= { configured: false, webhookHint: '', notifyDocuments: true, notifyAnnouncements: true, portalUrl: 'https://admin.fsif.jp/' }
  // デモではメールアドレスをそのままセッションとして使う
  if (action === 'login') {
    const data = demoCall('bootstrap', String(p.idToken ?? ''), {}) as BootstrapData
    return { ...data, session: String(p.idToken), sessionExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString() }
  }
  const me = demoAuth(db, token)
  const log = (act: string, target: string, detail = '') => db.logs.push({ timestamp: now(), email: me.email, action: act, target, detail })
  const commit = <T>(value: T): T => {
    saveDb(db)
    return JSON.parse(JSON.stringify(value)) as T
  }
  const item = (p.item ?? {}) as Record<string, unknown>

  switch (action) {
    case 'bootstrap': {
      const user = db.users.find((u) => u.email === me.email)
      let newSince = user?.prevLoginAt ?? ''
      if (user && (user.lastLoginAt ?? '').slice(0, 10) !== now().slice(0, 10)) {
        newSince = user.lastLoginAt
        user.prevLoginAt = user.lastLoginAt
        user.lastLoginAt = now()
      }
      if (!newSince) newSince = new Date(Date.now() - 7 * 86400000).toISOString()
      const d = today()
      return commit<BootstrapData>({
        me: { ...me, newSince, acks: db.acks.filter((a) => a.email === me.email).map((a) => a.announcementId) },
        tools: db.tools.filter((x) => canSee(me, x)).sort((a, b) => a.order - b.order),
        links: db.links.filter((x) => canSee(me, x)).sort((a, b) => a.order - b.order),
        documents: db.documents.filter((x) => canSee(me, x)),
        announcements: db.announcements.filter((a) => a.active && canSee(me, a) && (!a.startDate || a.startDate <= d) && (!a.endDate || a.endDate >= d)),
        announcementArchive: db.announcements
          .filter((a) => a.active && canSee(me, a) && (!a.startDate || a.startDate <= d))
          .sort((a, b) => (b.startDate || b.updatedAt.slice(0, 10)).localeCompare(a.startDate || a.updatedAt.slice(0, 10))),
        roles: db.roles.map((r) => ({ id: r.id, name: r.name })),
        gasVersion: EXPECTED_GAS_VERSION,
        help: db.help,
        popularity: demoPopularity(db),
        branding: db.branding,
      })
    }
    case 'logout':
      return {}
    case 'ackAnnouncement': {
      const a = db.announcements.find((x) => x.id === p.id)
      if (!a || !canSee(me, a)) fail('NOT_FOUND', 'お知らせが見つかりません')
      if (!db.acks.some((x) => x.announcementId === a.id && x.email === me.email)) db.acks.push({ announcementId: a.id, email: me.email, ackAt: now() })
      return commit({ id: a.id })
    }
    case 'announcementAcks': {
      requirePerm(me, 'announcements.manage')
      const a = db.announcements.find((x) => x.id === p.id)
      if (!a) fail('NOT_FOUND', 'お知らせが見つかりません')
      const targets = db.users.filter((u) => u.active && (u.roles.includes(SUPER) || !a.visibleRoles.length || a.visibleRoles.some((r) => u.roles.includes(r))))
      const acked = new Map(db.acks.filter((x) => x.announcementId === a.id).map((x) => [x.email, x.ackAt]))
      return commit<AckStatus>({
        acked: targets.filter((u) => acked.has(u.email)).map((u) => ({ email: u.email, name: u.name, ackAt: acked.get(u.email)! })),
        pending: targets.filter((u) => !acked.has(u.email)).map((u) => ({ email: u.email, name: u.name })),
      })
    }
    case 'saveDiscord': {
      requirePerm(me, '*')
      const hook = String(item.webhookUrl ?? '').trim()
      if (hook && !/^https:\/\/(?:canary\.|ptb\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(hook)) fail('BAD_REQUEST', 'DiscordのWebhook URL（https://discord.com/api/webhooks/…）を入力してください')
      const configured = item.clearWebhook ? false : hook ? true : db.discord.configured
      db.discord = {
        configured,
        webhookHint: item.clearWebhook ? '' : hook ? `…${hook.slice(-6)}` : db.discord.webhookHint,
        notifyDocuments: item.notifyDocuments !== false,
        notifyAnnouncements: item.notifyAnnouncements !== false,
        portalUrl: url(item.portalUrl) || 'https://admin.fsif.jp/',
      }
      return commit(db.discord)
    }
    case 'saveBranding': {
      requirePerm(me, '*')
      const color = String(item.primaryColor || '#1f6fba')
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) fail('BAD_REQUEST', '色は #1f6fba のような6桁のカラーコードで入力してください')
      db.branding = {
        portalName: required(item.portalName, 'ポータル名').slice(0, 40),
        tagline: String(item.tagline ?? '').slice(0, 40),
        logoUrl: url(item.logoUrl),
        primaryColor: color.toLowerCase(),
      }
      return commit(db.branding)
    }
    case 'setUploadFolder': {
      requirePerm(me, '*')
      // デモでは Drive に接続できないので、リンクの形だけ確かめて保存する
      const raw = String(p.url ?? '').trim()
      const m = raw.match(/drive\.google\.com\/drive\/(?:u\/\d+\/)?(?:mobile\/)?folders\/([\w-]+)/) ?? raw.match(/[?&]id=([\w-]+)/)
      const id = m ? m[1] : /^[\w-]{10,}$/.test(raw) ? raw : ''
      if (raw && !id) fail('BAD_REQUEST', 'Driveのフォルダのリンク（https://drive.google.com/drive/folders/…）を貼ってください')
      const folder = { url: id ? `https://drive.google.com/drive/folders/${id}` : '', name: id ? `デモのフォルダ（${id.slice(0, 6)}…）` : '', custom: !!id }
      db.uploadFolders = { ...db.uploadFolders!, [p.purpose === 'icon' ? 'icon' : 'document']: folder }
      log('Settings.uploadFolder', String(p.purpose ?? ''), id ? folder.name : '既定に戻す')
      return commit(db.uploadFolders)
    }
    case 'setSecurityAlerts': {
      requirePerm(me, '*')
      db.securityAlerts = { ...db.securityAlerts, enabled: !!p.enabled }
      return commit(db.securityAlerts)
    }
    case 'bulkSetActive': {
      requirePerm(me, '*')
      const emails = list(p.emails)
      const changed: string[] = []
      const skipped: { email: string; reason: string }[] = []
      db.users.forEach((u) => {
        if (!emails.includes(u.email)) return
        if (!p.active && u.email === me.email) return skipped.push({ email: u.email, reason: '自分自身は無効化できません' })
        if (u.active === !!p.active) return
        u.active = !!p.active
        u.updatedAt = now()
        changed.push(u.email)
      })
      return commit({ changed, skipped })
    }
    case 'listTrash': {
      requirePerm(me, 'any-manager')
      return commit(db.trash.filter((t) => demoCanManage(me, t.sheet)).map(({ data: _data, ...t }) => t).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)))
    }
    case 'restoreTrash': {
      const t = db.trash.find((x) => x.key === p.key)
      if (!t) fail('NOT_FOUND', 'ゴミ箱に見つかりません')
      if (!demoCanManage(me, t.sheet)) fail('FORBIDDEN', 'この操作を行う権限がありません')
      const target = demoSheet(db, t.sheet) as unknown as { [k: string]: unknown }[]
      const keyCol = t.sheet === 'Users' ? 'email' : 'id'
      if (target.some((x) => x[keyCol] === t.itemKey)) fail('CONFLICT', '同じ項目がすでにあるため元に戻せません')
      const record = { ...(t.data as object), updatedAt: now() } as { [k: string]: unknown }
      if (t.sheet === 'Tools') record.order = Math.max(0, ...db.tools.map((x) => x.order)) + 1
      if (t.sheet === 'Links') record.order = Math.max(0, ...db.links.map((x) => x.order)) + 1
      target.push(record)
      db.trash = db.trash.filter((x) => x.key !== t.key)
      log(`${t.sheet}.restore`, t.itemKey, t.title)
      return commit({ sheet: t.sheet, itemKey: t.itemKey })
    }
    case 'purgeTrash': {
      const t = db.trash.find((x) => x.key === p.key)
      if (!t) fail('NOT_FOUND', 'ゴミ箱に見つかりません')
      if (!demoCanManage(me, t.sheet)) fail('FORBIDDEN', 'この操作を行う権限がありません')
      db.trash = db.trash.filter((x) => x.key !== t.key)
      if (t.sheet === 'Announcements') db.acks = db.acks.filter((a) => a.announcementId !== t.itemKey)
      return commit({ key: t.key })
    }
    case 'testDiscord':
      requirePerm(me, '*')
      fail('DEMO', 'デモモードではDiscordに送信しません（GASに接続すると送信できます）')
    case 'setErrorDigest': {
      requirePerm(me, '*')
      db.errorDigest = { ...db.errorDigest, enabled: !!p.enabled }
      return commit(db.errorDigest)
    }
    case 'setFavorites': {
      const visible = [...db.tools, ...db.links].filter((x) => canSee(me, x)).map((x) => x.id)
      const ids = list(p.ids).filter((id) => visible.includes(id)).slice(0, 100)
      const user = db.users.find((u) => u.email === me.email)
      if (user) user.favorites = ids
      return commit({ favorites: ids })
    }
    case 'track': {
      const kind = p.kind === 'doc' ? 'doc' : p.kind === 'link' ? 'link' : 'tool'
      const target = (kind === 'doc' ? db.documents : kind === 'link' ? db.links : db.tools).find((x: { id: string }) => x.id === p.id) as { visibleRoles: string[] } | undefined
      if (!target || !canSee(me, target)) return {}
      const key = `${today().slice(0, 7)}|${kind}|${String(p.id)}`
      const row = db.stats[key] ?? { month: today().slice(0, 7), kind, itemId: String(p.id), count: 0, lastAt: '' }
      row.count += 1
      row.lastAt = now()
      db.stats[key] = row
      return commit({})
    }
    case 'usageStats': {
      requirePerm(me, 'logs.view')
      const months = recentMonths(3)
      const rows: Record<string, UsageStats['rows'][number]> = {}
      Object.values(db.stats).forEach((r) => {
        const k = `${r.kind}:${r.itemId}`
        const row = (rows[k] ??= { kind: r.kind as 'tool' | 'doc' | 'link', id: r.itemId, thisMonth: 0, lastMonth: 0, last3Months: 0, total: 0, lastAt: '' })
        row.total += r.count
        if (r.month === months[0]) row.thisMonth += r.count
        if (r.month === months[1]) row.lastMonth += r.count
        if (months.includes(r.month)) row.last3Months += r.count
        if (r.lastAt > row.lastAt) row.lastAt = r.lastAt
      })
      return commit<UsageStats>({ months, rows: Object.values(rows) })
    }
    case 'saveHelp': {
      requirePerm(me, 'announcements.manage')
      const h = item as unknown as HelpContent
      db.help = {
        intro: String(h.intro ?? ''),
        contacts: (h.contacts ?? []).map((c) => ({ label: String(c.label ?? '').trim(), value: String(c.value ?? '').trim() })).filter((c) => c.label || c.value),
        faqs: (h.faqs ?? []).map((f) => ({ q: String(f.q ?? '').trim(), a: String(f.a ?? '').trim() })).filter((f) => f.q),
      }
      log('Help.update', '')
      return commit(db.help)
    }
    case 'uploadFile':
      fail('DEMO', 'デモモードではDriveへのアップロードはできません（GASに接続すると使えます）')
    case 'syncDrive':
    case 'restrictLinkSharing': {
      requirePerm(me, 'documents.manage')
      db.documents.forEach((d) => {
        if (d.driveSync && (!p.id || d.id === p.id)) d.driveSyncStatus = 'デモモードのため、Driveの共有は変更していません'
      })
      return commit({ count: db.documents.filter((d) => d.driveSync).length })
    }
    case 'bulkAddUsers': {
      requirePerm(me, '*')
      const roles = validRoles(db, p.roles)
      const added: string[] = []
      const skipped: { email: string; reason: string }[] = []
      ;((p.users ?? []) as { email: string; name: string }[]).forEach((e) => {
        const email = String(e.email ?? '').trim().toLowerCase()
        if (!/^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(email)) return skipped.push({ email: email || '(空欄)', reason: 'メールアドレスが正しくありません' })
        if (db.users.some((u) => u.email === email)) return skipped.push({ email, reason: 'すでに登録されています' })
        db.users.push({ email, name: String(e.name || email), roles, active: true, note: '一括登録', createdAt: now(), updatedAt: now(), lastLoginAt: '', favorites: [] })
        added.push(email)
      })
      if (added.length) log('Users.bulkCreate', `${added.length}件`, added.join(','))
      return commit({ added, skipped })
    }
    case 'backupNow': {
      requirePerm(me, '*')
      db.backup = { ...db.backup, lastAt: now(), lastUrl: '', lastError: 'デモモードのため、実際のバックアップは作成していません' }
      return commit(db.backup)
    }
    case 'setBackupSchedule': {
      requirePerm(me, '*')
      db.backup = { ...db.backup, enabled: !!p.enabled }
      return commit(db.backup)
    }
    case 'adminData': {
      requirePerm(me, 'any-manager')
      const data: AdminData = {
        tools: [...db.tools].sort((a, b) => a.order - b.order),
        links: [...db.links].sort((a, b) => a.order - b.order),
        documents: db.documents,
        announcements: db.announcements,
        roles: db.roles,
      }
      data.help = db.help
      data.ackCounts = db.acks.reduce<Record<string, number>>((m, a) => ({ ...m, [a.announcementId]: (m[a.announcementId] ?? 0) + 1 }), {})
      if (me.isSuper) {
        data.users = db.users
        data.settings = db.settings
        data.backup = db.backup
        data.errorDigest = db.errorDigest
        data.discord = db.discord
        data.branding = db.branding
        data.securityAlerts = db.securityAlerts
        data.uploadFolderUrl = ''
        data.uploadFolders = db.uploadFolders
      }
      return commit(data)
    }
    case 'saveTool': {
      requirePerm(me, 'tools.manage')
      const existing = p.isNew ? undefined : db.tools.find((x) => x.id === item.id)
      checkConflict(existing, p, '項目')
      const record: Tool = {
        id: existing?.id ?? newId(),
        name: required(item.name, 'ツール名'),
        description: String(item.description ?? ''),
        category: String(item.category ?? ''),
        icon: String(item.icon || 'Zap'),
        tone: String(item.tone || 'blue'),
        status: (['稼働中', '準備中', '停止中'].includes(String(item.status)) ? item.status : '準備中') as Tool['status'],
        url: url(item.url),
        iconUrl: url(item.iconUrl),
        visibleRoles: validRoles(db, item.visibleRoles),
        order: existing?.order ?? Math.max(0, ...db.tools.map((x) => x.order)) + 1,
        updatedAt: now(),
      }
      upsert(db.tools, 'id', record)
      log(existing ? 'Tools.update' : 'Tools.create', record.id, record.name)
      return commit(record)
    }
    case 'saveLink': {
      requirePerm(me, 'links.manage')
      const existing = p.isNew ? undefined : db.links.find((x) => x.id === item.id)
      checkConflict(existing, p, '項目')
      const link = url(item.url)
      if (!link) fail('BAD_REQUEST', 'URLを入力してください')
      const record: PortalLink = {
        id: existing?.id ?? newId(),
        title: required(item.title, 'リンク名'),
        url: link,
        description: String(item.description ?? ''),
        category: String(item.category ?? ''),
        visibleRoles: validRoles(db, item.visibleRoles),
        order: existing?.order ?? Math.max(0, ...db.links.map((x) => x.order)) + 1,
        updatedAt: now(),
        iconUrl: url(item.iconUrl),
      }
      upsert(db.links, 'id', record)
      log(existing ? 'Links.update' : 'Links.create', record.id, record.title)
      return commit(record)
    }
    case 'deleteLink': {
      requirePerm(me, 'links.manage')
      const removedLink = db.links.find((x) => x.id === p.id)
      if (removedLink) toTrash(db, me, 'Links', removedLink.id, removedLink.title, removedLink)
      db.links = db.links.filter((x) => x.id !== p.id)
      log('Links.delete', String(p.id))
      return commit({ id: p.id })
    }
    case 'reorderLinks': {
      requirePerm(me, 'links.manage')
      const ids = list(p.ids)
      if (p.baseIds) {
        const current = [...db.links].sort((a, b) => a.order - b.order).filter((x) => canSee(me, x)).map((x) => x.id)
        if (current.join(',') !== list(p.baseIds).join(',')) fail('CONFLICT', '並べ替えの間に他の人がリンクを変更しました。最新の並び順を読み込んだので、もう一度並べ替えてください')
      }
      db.links.sort((a, b) => (ids.indexOf(a.id) + 1 || 999 + a.order) - (ids.indexOf(b.id) + 1 || 999 + b.order))
      db.links.forEach((x, i) => (x.order = i + 1))
      log('Links.reorder', '', ids.join(','))
      return commit(db.links)
    }
    case 'deleteTool': {
      requirePerm(me, 'tools.manage')
      const removedTool = db.tools.find((x) => x.id === p.id)
      if (removedTool) toTrash(db, me, 'Tools', removedTool.id, removedTool.name, removedTool)
      db.tools = db.tools.filter((x) => x.id !== p.id)
      log('Tools.delete', String(p.id))
      return commit({ id: p.id })
    }
    case 'reorderTools': {
      requirePerm(me, 'tools.manage')
      const ids = list(p.ids)
      if (p.baseIds) {
        const current = [...db.tools].sort((a, b) => a.order - b.order).filter((x) => canSee(me, x)).map((x) => x.id)
        if (current.join(',') !== list(p.baseIds).join(',')) fail('CONFLICT', '並べ替えの間に他の人がツールを変更しました。最新の並び順を読み込んだので、もう一度並べ替えてください')
      }
      db.tools.sort((a, b) => (ids.indexOf(a.id) + 1 || 999 + a.order) - (ids.indexOf(b.id) + 1 || 999 + b.order))
      db.tools.forEach((x, i) => (x.order = i + 1))
      log('Tools.reorder', '', ids.join(','))
      return commit(db.tools)
    }
    case 'saveDocument': {
      requirePerm(me, 'documents.manage')
      const existing = p.isNew ? undefined : db.documents.find((x) => x.id === item.id)
      checkConflict(existing, p, '項目')
      const date = String(item.date ?? '').replace(/\//g, '-')
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail('BAD_REQUEST', '日付は YYYY-MM-DD の形式で入力してください')
      const record: PortalDocument = {
        id: existing?.id ?? newId(),
        title: required(item.title, '資料名'),
        type: String(item.type || 'マニュアル'),
        tool: String(item.tool ?? ''),
        description: String(item.description ?? ''),
        keywords: String(item.keywords ?? ''),
        tags: list(item.tags),
        driveUrl: url(item.driveUrl),
        downloadUrl: url(item.downloadUrl),
        thumbnailUrl: url(item.thumbnailUrl),
        date: date || today(),
        pinned: !!item.pinned,
        visibleRoles: validRoles(db, item.visibleRoles),
        updatedAt: now(),
        driveSync: !!item.driveSync,
        driveSyncedEmails: existing?.driveSyncedEmails ?? [],
        driveSyncStatus: item.driveSync ? 'デモモードのため、Driveの共有は変更していません' : '',
      }
      upsert(db.documents, 'id', record)
      log(existing ? 'Documents.update' : 'Documents.create', record.id, record.title)
      return commit(record)
    }
    case 'deleteDocument': {
      requirePerm(me, 'documents.manage')
      const removedDoc = db.documents.find((x) => x.id === p.id)
      if (removedDoc) toTrash(db, me, 'Documents', removedDoc.id, removedDoc.title, removedDoc)
      db.documents = db.documents.filter((x) => x.id !== p.id)
      log('Documents.delete', String(p.id))
      return commit({ id: p.id })
    }
    case 'saveAnnouncement': {
      requirePerm(me, 'announcements.manage')
      const existing = p.isNew ? undefined : db.announcements.find((x) => x.id === item.id)
      checkConflict(existing, p, '項目')
      const record: Announcement = {
        id: existing?.id ?? newId(),
        title: required(item.title, 'タイトル'),
        body: String(item.body ?? ''),
        level: item.level === 'important' ? 'important' : 'info',
        active: item.active !== false,
        startDate: String(item.startDate ?? ''),
        endDate: String(item.endDate ?? ''),
        visibleRoles: validRoles(db, item.visibleRoles),
        updatedAt: now(),
        requireAck: !!item.requireAck,
      }
      upsert(db.announcements, 'id', record)
      log(existing ? 'Announcements.update' : 'Announcements.create', record.id, record.title)
      return commit(record)
    }
    case 'deleteAnnouncement': {
      requirePerm(me, 'announcements.manage')
      const removedAnn = db.announcements.find((x) => x.id === p.id)
      if (removedAnn) toTrash(db, me, 'Announcements', removedAnn.id, removedAnn.title, removedAnn)
      db.announcements = db.announcements.filter((x) => x.id !== p.id)
      log('Announcements.delete', String(p.id))
      return commit({ id: p.id })
    }
    case 'saveUser': {
      requirePerm(me, '*')
      const email = String(item.email ?? '').trim().toLowerCase()
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail('BAD_REQUEST', 'メールアドレスが正しくありません')
      const roles = validRoles(db, item.roles)
      if (email === me.email && !roles.includes(SUPER)) fail('BAD_REQUEST', '自分自身から全権管理者ロールを外すことはできません')
      if (email === me.email && item.active === false) fail('BAD_REQUEST', '自分自身を無効化することはできません')
      const existing = db.users.find((u) => u.email === email)
      checkConflict(existing, p, 'アカウント')
      const record: User = {
        email,
        name: String(item.name || existing?.name || email),
        roles,
        active: item.active !== false,
        note: String(item.note ?? ''),
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
        lastLoginAt: existing?.lastLoginAt ?? '',
      }
      upsert(db.users, 'email', record)
      log(existing ? 'Users.update' : 'Users.create', email, roles.join(','))
      return commit(record)
    }
    case 'deleteUser': {
      requirePerm(me, '*')
      if (p.email === me.email) fail('BAD_REQUEST', '自分自身は削除できません')
      const removedUser = db.users.find((u) => u.email === p.email)
      if (removedUser) toTrash(db, me, 'Users', removedUser.email, removedUser.name, removedUser)
      db.users = db.users.filter((u) => u.email !== p.email)
      log('Users.delete', String(p.email))
      return commit({ email: p.email })
    }
    case 'saveRole': {
      requirePerm(me, '*')
      const id = String(item.id ?? '').trim().toLowerCase()
      if (!/^[a-z0-9_-]{2,32}$/.test(id)) fail('BAD_REQUEST', 'ロールIDは半角英小文字・数字・-_ の2〜32文字にしてください')
      if (id === SUPER) fail('BAD_REQUEST', '全権管理者ロールは変更できません')
      const existing = db.roles.find((r) => r.id === id)
      if (p.isNew && existing) fail('CONFLICT', `ロールID「${id}」はすでに使われています`)
      const record: Role = {
        id,
        name: required(item.name, 'ロール名'),
        description: String(item.description ?? ''),
        permissions: list(item.permissions).filter((x) => x !== '*') as Permission[],
        builtin: existing?.builtin ?? false,
      }
      upsert(db.roles, 'id', record)
      log(existing ? 'Roles.update' : 'Roles.create', id, record.permissions.join(','))
      return commit(record)
    }
    case 'deleteRole': {
      requirePerm(me, '*')
      const role = db.roles.find((r) => r.id === p.id)
      if (!role) fail('NOT_FOUND', 'ロールが見つかりません')
      if (role.builtin) fail('BAD_REQUEST', '標準ロールは削除できません')
      const inUse = db.users.filter((u) => u.roles.includes(role.id)).length
      if (inUse) fail('BAD_REQUEST', `${inUse}人のユーザーに割り当てられているため削除できません`)
      db.roles = db.roles.filter((r) => r.id !== p.id)
      log('Roles.delete', role.id)
      return commit({ id: p.id })
    }
    case 'saveSettings': {
      requirePerm(me, '*')
      db.settings = {
        allowUnregistered: !!item.allowUnregistered,
        defaultRoles: validRoles(db, item.defaultRoles).filter((r) => r !== SUPER),
        allowedDomains: list(item.allowedDomains).map((d) => d.toLowerCase().replace(/^@/, '')),
      }
      log('Settings.update', '', JSON.stringify(db.settings))
      return commit(db.settings)
    }
    case 'systemCheck': {
      requirePerm(me, 'any-manager')
      const sheets = ['Users', 'Roles', 'Tools', 'Documents', 'Announcements', 'Settings', 'Logs', 'Stats', 'Acks', 'Links', 'Trash'].map((name) => ({ name, ok: true, missing: [], extra: [] }))
      return commit<SystemCheck>({ version: EXPECTED_GAS_VERSION, sheets, clientIdSet: true, superAdminCount: 1, recentErrors: [], dailyJobs: true, checkedAt: now() })
    }
    case 'listLogs': {
      requirePerm(me, 'logs.view')
      const q = String(p.q ?? '').toLowerCase()
      return commit([...db.logs].reverse().filter((l) =>
        (!p.email || l.email === p.email) &&
        (!p.kind || l.action.split('.')[0] === p.kind) &&
        (!p.from || l.timestamp.slice(0, 10) >= String(p.from)) &&
        (!p.to || l.timestamp.slice(0, 10) <= String(p.to)) &&
        (!q || `${l.target} ${l.detail} ${l.action} ${l.email}`.toLowerCase().includes(q))).slice(0, 300))
    }
    case 'markAllSeen': {
      const user = db.users.find((u) => u.email === me.email)
      const stamp = now()
      if (user) {
        user.prevLoginAt = stamp
        user.lastLoginAt = stamp
      }
      return commit({ newSince: stamp })
    }
    case 'searchContent': {
      // デモでは本文がないので、説明文とキーワードを「本文」とみなして探す
      const q = String(p.q ?? '').trim().toLowerCase()
      if (q.length < 2) return commit({ ids: [] })
      return commit({ ids: db.documents.filter((d) => canSee(me, d) && `${d.description} ${d.keywords}`.toLowerCase().includes(q)).map((d) => d.id) })
    }
    case 'selfCheck': {
      requirePerm(me, '*')
      const demo = 'デモモードのため、実際には試していません'
      return commit({
        checkedAt: now(),
        results: [
          { id: 'sheets', label: 'スプレッドシートの読み書き', ok: true, detail: demo, fix: '' },
          { id: 'cache', label: 'キャッシュ（ログインの維持・表示の高速化）', ok: true, detail: demo, fix: '' },
          { id: 'drive', label: 'Google Drive（アップロード・共有の同期）', ok: true, detail: demo, fix: '' },
          { id: 'mail', label: 'メール送信（エラー通知・権限変更の通知）', ok: true, detail: p.sendMail ? `${demo}（テストメールは送っていません）` : demo, fix: '' },
          { id: 'discord', label: 'Discordへの通知', ok: true, detail: db.discord.configured ? demo : '未設定（通知は送られません）', fix: '' },
          { id: 'triggers', label: '毎朝の自動処理・定期実行', ok: true, detail: demo, fix: '' },
          { id: 'backup', label: 'バックアップ', ok: !db.backup.lastError, detail: db.backup.lastError || demo, fix: db.backup.lastError ? '「設定 > バックアップ」で「今すぐバックアップ」を試してください' : '' },
        ],
      })
    }
    case 'renameCategory': {
      const target = ({ tools: { rows: db.tools, field: 'category', perm: 'tools.manage' }, documents: { rows: db.documents, field: 'type', perm: 'documents.manage' }, links: { rows: db.links, field: 'category', perm: 'links.manage' } } as const)[p.kind as CategoryKind]
      if (!target) fail('BAD_REQUEST', '種類が正しくありません')
      requirePerm(me, target.perm)
      const from = String(p.from ?? '').trim()
      const to = String(p.to ?? '').trim().slice(0, 40)
      if (from === to) fail('BAD_REQUEST', '変更前と変更後が同じです')
      if (p.kind === 'documents' && !to) fail('BAD_REQUEST', '資料の種類は空欄にできません')
      let count = 0
      ;(target.rows as unknown as Record<string, string>[]).forEach((row) => {
        if (String(row[target.field] ?? '').trim() === from) {
          row[target.field] = to
          count++
        }
      })
      if (!count) fail('NOT_FOUND', `「${from || '（なし）'}」の項目が見つかりません`)
      const sheet = { tools: 'Tools', documents: 'Documents', links: 'Links' }[p.kind as CategoryKind]
      log(`${sheet}.renameCategory`, `${from} → ${to}`, `${count}件`)
      return commit({ count })
    }
    default:
      fail('BAD_REQUEST', `不明な操作です: ${action}`)
  }
}
