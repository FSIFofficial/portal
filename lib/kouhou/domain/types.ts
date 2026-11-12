/**
 * 日時はすべて日本時間の壁時計文字列 "YYYY-MM-DDTHH:mm" で保持する（例: 2026-11-10T19:00）。
 * API接続時はこの層でISO 8601（+09:00）へ変換する想定。
 */
export type JstDateTime = string
export type JstDate = string

export type Platform = 'x' | 'instagram' | 'discord'
export type Level = 1 | 2 | 3

export interface Brand {
  id: string
  name: string
  code: string
  color: string
}

export interface Account {
  id: string
  brandId: string
  platform: Platform
  name: string
  code: string
  connection: 'connected_mock' | 'disconnected_mock'
  defaultApproverId: string | null
  /** Discordの場合のみ */
  serverId?: string
}

export interface DiscordServer {
  id: string
  brandId: string
  name: string
}

export interface DiscordChannel {
  id: string
  serverId: string
  name: string
  postable: boolean
}

export interface User {
  id: string
  name: string
  email: string
  isAdmin: boolean
  level: Level
  status: 'active' | 'invited' | 'suspended'
  publishSuccessCount: number
}

export interface AccountPermission {
  userId: string
  accountId: string
  view: boolean
  create: boolean
  edit: boolean
  approve: boolean
  levelOverride: Level | null
}

export interface PostType {
  id: string
  name: string
  /** 承認上の分類。繰り返し予約とは無関係 */
  routine: boolean
  important: boolean
}

export type ContentApprovalState =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'auto_approved'
  | 'rejected'
  | 'manual_record'

export interface ContentApproval {
  state: ContentApprovalState
  requestedAt?: JstDateTime
  decidedBy?: string
  decidedAt?: JstDateTime
  decidedVersion?: number
  reason?: string
}

export type ScheduleApprovalState = 'unset' | 'candidates' | 'pending' | 'approved' | 'rejected' | 'manual_record'

export interface ScheduleCandidate {
  at: JstDateTime
  proposedBy: string
  proposedAt: JstDateTime
}

export interface ScheduleApproval {
  state: ScheduleApprovalState
  candidates: ScheduleCandidate[]
  approvedFor?: JstDateTime
  decidedBy?: string
  decidedAt?: JstDateTime
  /** 候補選択で成立したか、承認者の直接承認か */
  via?: 'candidate' | 'direct'
  reason?: string
}

export type PublishStatus =
  | 'draft'
  | 'review'
  | 'rejected'
  | 'scheduled'
  | 'held'
  | 'published'
  | 'failed'
  | 'cancelled'

export type DeliveryState = 'none' | 'queued' | 'sent_mock' | 'error' | 'stopped'

export interface Hold {
  kind: 'pending_change' | 'late_approval' | 'emergency' | 'reschedule'
  reason: string
  at: JstDateTime
}

export interface PendingChange {
  kind: 'edit' | 'cancel'
  requestedBy: string
  requestedAt: JstDateTime
  reason: string
  fromVersion: number
}

export type AnalyticsMode = 'standard' | 'custom' | 'interval'

export interface AnalyticsSetting {
  mode: AnalyticsMode
  customOffsetsHours: number[]
  interval: { value: number; unit: 'minute' | 'hour' | 'day' }
  end: { durationHours: number | null; endAt: JstDateTime | null; maxCount: number | null }
}

export type MetricPointStatus = 'fetched' | 'pending' | 'missing' | 'failed'

export interface MetricPoint {
  offsetHours: number
  plannedAt: JstDateTime
  fetchedAt: JstDateTime | null
  status: MetricPointStatus
  values: Record<string, number | null>
}

export interface Post {
  id: string
  draftGroupId: string
  title: string
  brandId: string
  accountId: string
  channelId: string | null
  typeId: string
  importantManual: boolean
  body: string
  assetIds: string[]
  planId: string | null
  authorId: string
  assigneeId: string
  lastEditorId: string
  /** 最後の承認以降に公開内容を編集した人 */
  contentEditorsSinceApproval: string[]
  version: number
  editOpen: boolean
  draftDue: JstDateTime | null
  approvalDue: JstDateTime | null
  scheduledAt: JstDateTime | null
  publishedAt: JstDateTime | null
  publicUrl: string | null
  mode: 'scheduled' | 'manual'
  designatedApproverId: string | null
  content: ContentApproval
  schedule: ScheduleApproval
  queued: boolean
  hold: Hold | null
  pendingChange: PendingChange | null
  status: PublishStatus
  delivery: DeliveryState
  deliveryError: string | null
  analytics: AnalyticsSetting
  metrics: MetricPoint[]
  createdAt: JstDateTime
  updatedAt: JstDateTime
}

export type CommentTarget = 'post' | 'plan' | 'asset'

export interface Comment {
  id: string
  targetType: CommentTarget
  targetId: string
  parentId: string | null
  authorId: string
  body: string
  createdAt: JstDateTime
  resolved: boolean
  category: 'content' | 'schedule' | null
}

export type HistoryKind =
  | 'created'
  | 'saved'
  | 'body_changed'
  | 'asset_changed'
  | 'schedule_changed'
  | 'editor_handover'
  | 'edit_open_changed'
  | 'content_completed'
  | 'content_approved'
  | 'content_auto_approved'
  | 'content_rejected'
  | 'candidates_proposed'
  | 'schedule_selected'
  | 'schedule_requested'
  | 'schedule_approved'
  | 'schedule_rejected'
  | 'scheduled'
  | 'held'
  | 'cancel_requested'
  | 'cancelled'
  | 'change_rejected'
  | 'published'
  | 'failed'
  | 'manual_recorded'

export interface HistoryEntry {
  id: string
  postId: string
  at: JstDateTime
  actorId: string | 'system'
  kind: HistoryKind
  summary: string
  version: number
  before?: string
  after?: string
}

export type PlanStatus = 'idea' | 'review' | 'production' | 'done'

export interface Plan {
  id: string
  title: string
  brandId: string
  description: string
  status: PlanStatus
  ownerId: string
  dueDate: JstDate | null
  links: { id: string; label: string; url: string }[]
}

export interface CalendarEvent {
  id: string
  title: string
  brandId: string
  at: JstDateTime
}

export type AssetKind = 'image' | 'video' | 'logo' | 'background' | 'text'

export interface TextLayer {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  color: string
  font: 'sans' | 'serif' | 'mono'
  align: 'left' | 'center' | 'right'
  weight: 400 | 700
}

export interface TemplateEdit {
  backgroundAssetId: string
  layers: TextLayer[]
}

export interface Asset {
  id: string
  kind: AssetKind
  name: string
  brandId: string
  purpose: string
  src: string | null
  text: string | null
  edit: TemplateEdit | null
  sourceAssetId: string | null
  updatedBy: string
  updatedAt: JstDateTime
}

export interface Recurrence {
  id: string
  name: string
  accountIds: string[]
  channelId: string | null
  typeId: string
  weekdays: number[]
  time: string
  startDate: JstDate
  endDate: JstDate | null
  count: number | null
  mode: 'individual' | 'template'
  templateText: string
  generatedPostIds: string[]
}

export interface EmergencyStop {
  id: string
  scope: 'all' | 'brand' | 'account'
  targetId: string | null
  reason: string
  at: JstDateTime
  by: string
}

export interface NotificationLog {
  id: string
  at: JstDateTime
  channelId: string
  mentions: string[]
  text: string
  postId: string | null
}

export interface Settings {
  notifyChannelId: string
  notifyMentions: string[]
  promotionThreshold: number
}

export interface DemoFlags {
  conflictOnNextSave: boolean
  failNextDelivery: boolean
}

export interface AppState {
  now: JstDateTime
  currentUserId: string | null
  brands: Brand[]
  accounts: Account[]
  servers: DiscordServer[]
  channels: DiscordChannel[]
  users: User[]
  permissions: AccountPermission[]
  postTypes: PostType[]
  posts: Post[]
  comments: Comment[]
  history: HistoryEntry[]
  plans: Plan[]
  events: CalendarEvent[]
  assets: Asset[]
  recurrences: Recurrence[]
  stops: EmergencyStop[]
  notifications: NotificationLog[]
  settings: Settings
  demo: DemoFlags
  seq: number
}
