// フロントエンドとGAS(バックエンド)の間でやり取りするデータ型。
// GASコード（リポジトリ外で管理）の SCHEMA と対応しているので、項目を増やす場合は両方を更新すること。

/** 権限キー。'*' は全権管理者（ユーザー・ロール・設定の管理を含むすべて） */
export type Permission = '*' | 'tools.manage' | 'documents.manage' | 'announcements.manage' | 'links.manage' | 'logs.view'

export const PERMISSION_LABELS: Record<Exclude<Permission, '*'>, string> = {
  'tools.manage': 'ツールの追加・編集・並べ替え',
  'documents.manage': '資料の追加・編集',
  'announcements.manage': 'お知らせの追加・編集',
  'links.manage': 'リンク集の追加・編集・並べ替え',
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
  /** お気に入りツールのID（本人だけが変更する） */
  favorites?: string[]
  prevLoginAt?: string
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
  /** Drive の共有をポータルの公開範囲に合わせるか */
  driveSync?: boolean
  /** ポータルが共有したアカウント（全権管理者にだけ返る） */
  driveSyncedEmails?: string[]
  /** 共有の同期結果（管理画面にだけ返る） */
  driveSyncStatus?: string
}

export interface PortalLink {
  id: string
  title: string
  url: string
  description: string
  category: string
  visibleRoles: string[]
  order: number
  updatedAt: string
  /** 自分で設定したアイコン画像（空ならサイトのアイコンを自動で取得） */
  iconUrl?: string
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
  /** 「確認しました」ボタンを出して、誰が確認したかを記録する */
  requireAck?: boolean
  /** Discordに通知した日時（'skip' は通知しない） */
  notifiedAt?: string
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
  favorites?: string[]
  /** この日時より後に追加・更新されたものを「NEW」と表示する（前回ログイン） */
  newSince?: string
  /** 確認済みのお知らせID */
  acks?: string[]
  /** 開いたもの（ID → 開いた時点の更新日時）。このブラウザにだけ保存し、NEWを消すのに使う */
  seen?: Record<string, string>
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
  /** 動いているGASの版名（古いGASでは無い） */
  gasVersion?: string
  help?: HelpContent
  /** 直近3か月の利用回数（"tool:ID" / "doc:ID" → 回数） */
  popularity?: Record<string, number>
  /** login のときだけ返る */
  session?: string
  sessionExpiresAt?: string
  branding?: Branding
  links?: PortalLink[]
  /** お知らせ一覧用（閉じたもの・掲載が終わったものも含む） */
  announcementArchive?: Announcement[]
}

export interface AdminData {
  tools: Tool[]
  documents: PortalDocument[]
  announcements: Announcement[]
  roles: Role[]
  users?: User[]
  settings?: Settings
  help?: HelpContent
  backup?: BackupStatus
  uploadFolderUrl?: string
  errorDigest?: ErrorDigestStatus
  /** お知らせID → 確認済み人数 */
  ackCounts?: Record<string, number>
  discord?: DiscordStatus
  branding?: Branding
  links?: PortalLink[]
  securityAlerts?: { enabled: boolean; recipients: number }
  /** アップロードの保存先（GAS 2.7.0 以降） */
  uploadFolders?: UploadFolders
}

export interface HelpContent {
  intro: string
  contacts: { label: string; value: string }[]
  faqs: { q: string; a: string }[]
}

export interface BackupStatus {
  enabled: boolean
  lastAt: string
  lastUrl: string
  lastError: string
  keep: number
  folderUrl: string
}

export interface UsageRow {
  kind: 'tool' | 'doc' | 'link'
  id: string
  thisMonth: number
  lastMonth: number
  last3Months: number
  total: number
  lastAt: string
}

export interface UsageStats {
  months: string[]
  rows: UsageRow[]
}

export interface UploadFolder {
  url: string
  name: string
  /** 管理者が指定したフォルダか（false は既定：資料は自動で作るフォルダ、アイコンは資料と同じ） */
  custom: boolean
}

export interface UploadFolders {
  document: UploadFolder
  icon: UploadFolder
}

export interface UploadResult {
  id: string
  name: string
  url: string
  warning: string
}

export interface BulkAddResult {
  added: string[]
  skipped: { email: string; reason: string }[]
}

export interface Branding {
  portalName: string
  tagline: string
  logoUrl: string
  primaryColor: string
}

export const DEFAULT_BRANDING: Branding = { portalName: 'FSIF Portal', tagline: 'CONNECT THE DOTS', logoUrl: '', primaryColor: '#1f6fba' }

export interface TrashItem {
  key: string
  sheet: 'Tools' | 'Documents' | 'Announcements' | 'Links' | 'Users'
  itemKey: string
  title: string
  deletedAt: string
  deletedBy: string
}

export interface DiscordStatus {
  configured: boolean
  /** Webhook URL の末尾だけ（URLを知っていれば誰でも投稿できるため、全体は返さない） */
  webhookHint: string
  notifyDocuments: boolean
  notifyAnnouncements: boolean
  portalUrl: string
}

export interface ErrorDigestStatus {
  enabled: boolean
  lastSentAt: string
  recipients: number
}

export interface AckStatus {
  acked: { email: string; name: string; ackAt: string }[]
  pending: { email: string; name: string }[]
}

/** 前回ログイン以降に追加・更新されたか */
/** 前回ログイン以降に追加・更新されていて、まだ開いていないもの */
export function isNew(item: { id?: string; updatedAt: string }, me: Me | null | undefined): boolean {
  if (!me?.newSince || !item.updatedAt || item.updatedAt <= me.newSince) return false
  return !(item.id && me.seen?.[item.id] === item.updatedAt)
}

export interface SelfCheckResult {
  id: string
  label: string
  ok: boolean
  detail: string
  fix: string
}

export interface LogFilter {
  q?: string
  email?: string
  kind?: string
  from?: string
  to?: string
  includeArchive?: boolean
}

export type CategoryKind = 'tools' | 'documents' | 'links'

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
  recentErrors?: { timestamp: string; code: string; message: string }[]
  /** 毎朝の自動処理（掲載開始日のお知らせの通知・ゴミ箱の整理）が登録されているか */
  dailyJobs?: boolean
}

export function can(me: Me | null | undefined, perm: Permission): boolean {
  if (!me) return false
  return me.isSuper || me.permissions.includes('*') || me.permissions.includes(perm)
}

export function isAnyManager(me: Me | null | undefined): boolean {
  return !!me && (me.isSuper || me.permissions.length > 0)
}
