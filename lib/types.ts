// フロントエンドとGAS(バックエンド)の間でやり取りするデータ型。
// GASコード（リポジトリ外で管理）の SCHEMA と対応しているので、項目を増やす場合は両方を更新すること。

/** 権限キー。'*' は全権管理者（ユーザー・ロール・設定の管理を含むすべて） */
export type Permission = '*' | 'tools.manage' | 'documents.manage' | 'announcements.manage' | 'logs.view'

export const PERMISSION_LABELS: Record<Exclude<Permission, '*'>, string> = {
  'tools.manage': 'ツールの追加・編集・並べ替え',
  'documents.manage': '資料の追加・編集',
  'announcements.manage': 'お知らせの追加・編集',
  'logs.view': '変更履歴の閲覧',
}

export interface Role {
  id: string
  name: string
  description: string
  permissions: Permission[]
  builtin: boolean
}

export interface User {
  email: string
  name: string
  roles: string[]
  active: boolean
  note: string
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

export type ToolStatus = '稼働中' | '準備中' | '停止中'

export interface Tool {
  id: string
  name: string
  description: string
  category: string
  icon: string
  tone: string
  status: ToolStatus
  url: string
  /** 閲覧できるロールID。空なら全員 */
  visibleRoles: string[]
  order: number
  updatedAt: string
  /** アイコン画像のURL（Driveの共有リンクも可）。空ならアイコン＋色で表示 */
  iconUrl: string
}

export interface PortalDocument {
  id: string
  title: string
  type: string
  /** 関連ツール名（「使い方」ボタンからの絞り込みに使う） */
  tool: string
  description: string
  keywords: string
  tags: string[]
  /** Google Drive の共有リンク（ファイル / ドキュメント / フォルダ） */
  driveUrl: string
  /** 空なら driveUrl から自動生成 */
  downloadUrl: string
  /** 空なら driveUrl から自動生成 */
  thumbnailUrl: string
  date: string
  pinned: boolean
  visibleRoles: string[]
  updatedAt: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  level: 'info' | 'important'
  active: boolean
  startDate: string
  endDate: string
  visibleRoles: string[]
  updatedAt: string
}

export interface Settings {
  /** 未登録のGoogleアカウントでもログインを許可するか */
  allowUnregistered: boolean
  /** 未登録ユーザーが自動登録されるときのロール */
  defaultRoles: string[]
  /** 自動登録を許可するドメイン（空なら制限なし） */
  allowedDomains: string[]
}

export interface LogEntry {
  timestamp: string
  email: string
  action: string
  target: string
  detail: string
}

export interface Me {
  email: string
  name: string
  picture: string
  roles: string[]
  permissions: Permission[]
  isSuper: boolean
}

export interface RoleSummary {
  id: string
  name: string
}

export interface BootstrapData {
  me: Me
  tools: Tool[]
  documents: PortalDocument[]
  announcements: Announcement[]
  roles: RoleSummary[]
}

export interface AdminData {
  tools: Tool[]
  documents: PortalDocument[]
  announcements: Announcement[]
  roles: Role[]
  users?: User[]
  settings?: Settings
}

export interface SheetCheck {
  name: string
  ok: boolean
  missing: string[]
  extra: string[]
}

export interface SystemCheck {
  version: string
  sheets: SheetCheck[]
  clientIdSet: boolean
  superAdminCount: number
  checkedAt: string
}

export function can(me: Me | null | undefined, perm: Permission): boolean {
  if (!me) return false
  return me.isSuper || me.permissions.includes('*') || me.permissions.includes(perm)
}

export function isAnyManager(me: Me | null | undefined): boolean {
  return !!me && (me.isSuper || me.permissions.length > 0)
}
