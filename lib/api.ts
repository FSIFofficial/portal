// バックエンド呼び出し。GAS_URL が設定されていれば GAS へ、なければブラウザ内のデモバックエンドへ送る。
// デモバックエンドはGASと同じルール（権限・閲覧範囲）を再現している。

import { DEMO_MODE, EXPECTED_GAS_VERSION, GAS_URL } from './config'
import { createDemoDb, type DemoDb } from './demo-data'
import type {
  AdminData, Announcement, BackupStatus, BootstrapData, BulkAddResult, HelpContent, LogEntry, Me, Permission, PortalDocument, Role,
  Settings, SystemCheck, Tool, UploadResult, UsageStats, User,
} from './types'

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
  track: (token: string, kind: 'tool' | 'doc', id: string) => call('track', token, { kind, id }),
  adminData: (token: string) => call<AdminData>('adminData', token),
  // isNew=false のときは item.updatedAt（編集開始時点の値）で同時編集の衝突を検出する
  saveTool: (token: string, item: Partial<Tool>, isNew: boolean) => call<Tool>('saveTool', token, { item, isNew }),
  deleteTool: (token: string, id: string) => call('deleteTool', token, { id }),
  reorderTools: (token: string, ids: string[], baseIds: string[]) => call<Tool[]>('reorderTools', token, { ids, baseIds }),
  saveDocument: (token: string, item: Partial<PortalDocument>, isNew: boolean) => call<PortalDocument>('saveDocument', token, { item, isNew }),
  deleteDocument: (token: string, id: string) => call('deleteDocument', token, { id }),
  saveAnnouncement: (token: string, item: Partial<Announcement>, isNew: boolean) => call<Announcement>('saveAnnouncement', token, { item, isNew }),
  deleteAnnouncement: (token: string, id: string) => call('deleteAnnouncement', token, { id }),
  saveUser: (token: string, item: Partial<User>, isNew: boolean) => call<User>('saveUser', token, { item, isNew }),
  deleteUser: (token: string, email: string) => call('deleteUser', token, { email }),
  saveRole: (token: string, item: Partial<Role>, isNew: boolean) => call<Role>('saveRole', token, { item, isNew }),
  deleteRole: (token: string, id: string) => call('deleteRole', token, { id }),
  saveSettings: (token: string, item: Settings) => call<Settings>('saveSettings', token, { item }),
  listLogs: (token: string) => call<LogEntry[]>('listLogs', token, { limit: 300 }),
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

const DEMO_KEY = 'fsif-portal-demo-db-v3'
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

function upsert<T>(rows: T[], key: keyof T, record: T) {
  const i = rows.findIndex((r) => r[key] === record[key])
  if (i >= 0) rows[i] = record
  else rows.push(record)
}

function demoCall(action: string, token: string, p: Payload): unknown {
  const db = loadDb()
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
      if (user) user.lastLoginAt = now()
      const d = today()
      return commit<BootstrapData>({
        me,
        tools: db.tools.filter((x) => canSee(me, x)).sort((a, b) => a.order - b.order),
        documents: db.documents.filter((x) => canSee(me, x)),
        announcements: db.announcements.filter((a) => a.active && canSee(me, a) && (!a.startDate || a.startDate <= d) && (!a.endDate || a.endDate >= d)),
        roles: db.roles.map((r) => ({ id: r.id, name: r.name })),
        gasVersion: EXPECTED_GAS_VERSION,
        help: db.help,
        popularity: demoPopularity(db),
      })
    }
    case 'logout':
      return {}
    case 'setFavorites': {
      const visible = db.tools.filter((x) => canSee(me, x)).map((x) => x.id)
      const ids = list(p.ids).filter((id) => visible.includes(id)).slice(0, 50)
      const user = db.users.find((u) => u.email === me.email)
      if (user) user.favorites = ids
      return commit({ favorites: ids })
    }
    case 'track': {
      const kind = p.kind === 'doc' ? 'doc' : 'tool'
      const target = (kind === 'doc' ? db.documents : db.tools).find((x) => x.id === p.id)
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
        const row = (rows[k] ??= { kind: r.kind as 'tool' | 'doc', id: r.itemId, thisMonth: 0, lastMonth: 0, last3Months: 0, total: 0, lastAt: '' })
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
        documents: db.documents,
        announcements: db.announcements,
        roles: db.roles,
      }
      data.help = db.help
      if (me.isSuper) {
        data.users = db.users
        data.settings = db.settings
        data.backup = db.backup
        data.uploadFolderUrl = ''
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
    case 'deleteTool': {
      requirePerm(me, 'tools.manage')
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
      }
      upsert(db.announcements, 'id', record)
      log(existing ? 'Announcements.update' : 'Announcements.create', record.id, record.title)
      return commit(record)
    }
    case 'deleteAnnouncement': {
      requirePerm(me, 'announcements.manage')
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
      const sheets = ['Users', 'Roles', 'Tools', 'Documents', 'Announcements', 'Settings', 'Logs'].map((name) => ({ name, ok: true, missing: [], extra: [] }))
      return commit<SystemCheck>({ version: EXPECTED_GAS_VERSION, sheets, clientIdSet: true, superAdminCount: 1, checkedAt: now() })
    }
    case 'listLogs': {
      requirePerm(me, 'logs.view')
      return commit([...db.logs].reverse().slice(0, 300))
    }
    default:
      fail('BAD_REQUEST', `不明な操作です: ${action}`)
  }
}
