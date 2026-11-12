export type EmploymentStatus = "active" | "suspended" | "withdrawn"

export interface Member {
  id: string
  name: string
  /** 主なメールアドレス（通知・表示に使う） */
  email: string
  /** 追加のメールアドレス（別の Google アカウントなど）。どれでログインしても同じ人として扱う */
  altEmails?: string[]
  status: EmploymentStatus
  joinedAt: string
}

export interface Department {
  id: string
  name: string
  description: string
  /** 親の部署（階層）。null・未設定は最上位 */
  parentId?: string | null
}

export interface Membership {
  memberId: string
  departmentId: string
  since: string
}

/**
 * 組織上の役割。ツール内部の役割（ToolRole）とは別の型として扱う。
 * org_account（団体垢）は、個人ではなく団体・部署で共用するアカウントの印。
 * ツール権限は付与できるが、代表・事業部長・申請の承認者にはなれない。
 */
export type OrganizationRoleKind = "representative" | "division_head" | "org_account"

export interface OrganizationRole {
  id: string
  memberId: string
  kind: OrganizationRoleKind
  /** division_head のときのみ対象部署を持つ */
  departmentId?: string
  assignedAt: string
}

export type ScopeAction = "toggle_access" | "change_role"

/** 代表が事業部長に与える、他部署の追加管理範囲 */
export interface ManagementScope {
  id: string
  grantedTo: string
  departmentId: string
  /** "all" はすべてのツール */
  toolIds: string[] | "all"
  actions: ScopeAction[]
  grantedBy: string
  grantedAt: string
}

/** ツール内部役割を付与できる組織上の最低ライン */
export type RoleAssignableBy = "division_head" | "representative"

export interface ToolRole {
  toolId: string
  roleKey: string
  label: string
  rank: number
  description: string
  assignableBy: RoleAssignableBy
}

export type IntegrationStatus = "linked" | "unsupported" | "pending_roles" | "sync_error"

export interface Tool {
  /** FSIFポータル側の固定ID */
  id: string
  name: string
  description: string
  url: string
  enabled: boolean
  integration: Exclude<IntegrationStatus, "sync_error" | "pending_roles">
  roles: ToolRole[]
  defaultRoleKey?: string
  demoRoleDefinition?: boolean
  lastSyncedAt: string
  lastSyncFailed?: boolean
}

export type TemplatePosition = "member" | "division_head"

export interface DepartmentRoleTemplate {
  departmentId: string
  position: TemplatePosition
  toolId: string
  roleKey: string
}

export type GrantSource = "department" | "position" | "request"

export interface Grant {
  id: string
  memberId: string
  toolId: string
  roleKey: string
  source: GrantSource
  departmentId?: string
  position?: TemplatePosition
  grantedAt: string
  /** 所属解除・異動後も保持されている付与 */
  retainedAfterTransfer: boolean
  /** 退会・再加入により無効化された付与（記録として保持） */
  revoked?: boolean
}

export type ManualAccess = "on" | "off" | null

export interface ManualAccessOverride {
  memberId: string
  toolId: string
  access: ManualAccess
  /** 管理者が手動で指定した内部役割 */
  roleKey: string | null
  updatedBy: string
  updatedAt: string
}

export type RequestType = "access" | "role_change"
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled"

export interface AccessRequest {
  id: string
  requesterId: string
  toolId: string
  type: RequestType
  roleKey: string
  reason: string
  approverId: string
  status: RequestStatus
  createdAt: string
  decidedAt?: string
  decisionReason?: string
}

export interface ApprovalRoute {
  id: string
  /** null はすべての部署 */
  departmentId: string | null
  /** null はすべてのツール */
  toolId: string | null
  /** null はすべての役割 */
  roleKey: string | null
  approverId: string
  alternateId: string | null
}

export interface TransferRecord {
  id: string
  kind: OrganizationRoleKind
  departmentId?: string
  fromId: string
  toId: string
  at: string
}

export type AuditSource = "manual" | "auto" | "bulk" | "request" | "appointment" | "transfer" | "sync" | "member"

export interface ChangeItem {
  memberId?: string
  toolId?: string
  label: string
  before: string
  after: string
}

export interface AuditLog {
  id: string
  at: string
  actorId: string | null
  source: AuditSource
  summary: string
  memberIds: string[]
  toolIds: string[]
  items: ChangeItem[]
  reason?: string
}

export type NotificationKind = "access" | "role" | "org" | "scope" | "request_in" | "request_result" | "transfer" | "member"

export interface AppNotification {
  id: string
  recipientId: string
  kind: NotificationKind
  title: string
  body: string
  items: ChangeItem[]
  actorId: string | null
  reason?: string
  createdAt: string
  read: boolean
}

export interface PortalTool {
  id: string
  name: string
  description: string
  url: string
  enabled: boolean
  integration: Tool["integration"]
  roles: Omit<ToolRole, "toolId">[]
  defaultRoleKey?: string
  demoRoleDefinition?: boolean
}

export interface SyncMeta {
  lastStatus: "success" | "error" | "never"
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  message?: string
}

export interface AppData {
  version: number
  members: Member[]
  departments: Department[]
  memberships: Membership[]
  orgRoles: OrganizationRole[]
  scopes: ManagementScope[]
  tools: Tool[]
  templates: DepartmentRoleTemplate[]
  grants: Grant[]
  overrides: ManualAccessOverride[]
  requests: AccessRequest[]
  routes: ApprovalRoute[]
  transfers: TransferRecord[]
  audit: AuditLog[]
  notifications: AppNotification[]
  /** モックのFSIFポータル側データ（正本の代わり） */
  portalCatalog: PortalTool[]
  sync: SyncMeta
  /**
   * 代表と同じ管理操作ができるメンバー（本番：ログイン中のポータル全権管理者）。
   * 画面が読み込み時に付けるだけで、保存はしない。
   */
  operators?: string[]
}

export interface DraftCell {
  access: ManualAccess
  roleKey: string | null
}

/** key = `${memberId}::${toolId}` */
export type Draft = Record<string, DraftCell>
