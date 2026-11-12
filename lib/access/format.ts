import type { AuditSource, EmploymentStatus, IntegrationStatus, RequestStatus } from "./types"

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export const formatDateTime = (iso: string | null | undefined) => (iso ? dateTimeFormatter.format(new Date(iso)) : "—")
export const formatDate = (iso: string | null | undefined) => (iso ? dateFormatter.format(new Date(iso)) : "—")

/** ISO日時を日本時間の YYYY-MM-DD に変換（日付フィルター用） */
export const toJstDateKey = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export const STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: "在籍",
  suspended: "休止",
  withdrawn: "退会",
}

export const INTEGRATION_LABEL: Record<IntegrationStatus, string> = {
  linked: "連携済み",
  unsupported: "連携未対応",
  pending_roles: "権限定義待ち",
  sync_error: "同期エラー",
}

export const AUDIT_SOURCE_LABEL: Record<AuditSource, string> = {
  manual: "手動",
  auto: "自動付与",
  bulk: "一括",
  request: "申請",
  appointment: "任命・解除",
  transfer: "譲渡",
  sync: "同期",
  member: "メンバー管理",
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "申請中",
  approved: "承認",
  rejected: "却下",
  cancelled: "取消",
}

let idCounter = 0
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`
