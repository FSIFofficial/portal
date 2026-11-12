import type {
  AppData,
  Department,
  DraftCell,
  Grant,
  ManualAccess,
  Member,
  ScopeAction,
  TemplatePosition,
  Tool,
  ToolRole,
} from "./types"

/* ---------- 基本参照 ---------- */

export const cellKey = (memberId: string, toolId: string) => `${memberId}::${toolId}`
export const parseCellKey = (key: string) => {
  const [memberId, toolId] = key.split("::")
  return { memberId, toolId }
}

export const findMember = (data: AppData, id: string): Member | undefined => data.members.find((m) => m.id === id)
export const findTool = (data: AppData, id: string): Tool | undefined => data.tools.find((t) => t.id === id)
export const findDepartment = (data: AppData, id: string): Department | undefined =>
  data.departments.find((d) => d.id === id)

export const memberDepartmentIds = (data: AppData, memberId: string) =>
  data.memberships.filter((ms) => ms.memberId === memberId).map((ms) => ms.departmentId)

export const isRepresentative = (data: AppData, memberId: string) =>
  data.orgRoles.some((r) => r.memberId === memberId && r.kind === "representative")

/**
 * 代表と同じ（すべての）管理操作ができるか。組織上の代表に加え、
 * 本番ではポータルの全権管理者としてログインしている本人（data.operators）も含む。
 * 「対象が代表かどうか」の判定には使わない（そちらは isRepresentative）。
 */
export const hasFullAccess = (data: AppData, memberId: string) =>
  isRepresentative(data, memberId) || (data.operators ?? []).includes(memberId)

export const headDepartmentIds = (data: AppData, memberId: string) =>
  data.orgRoles
    .filter((r) => r.memberId === memberId && r.kind === "division_head" && r.departmentId)
    .map((r) => r.departmentId as string)

export const isDivisionHead = (data: AppData, memberId: string) => headDepartmentIds(data, memberId).length > 0

export const currentRepresentative = (data: AppData) => {
  const role = data.orgRoles.find((r) => r.kind === "representative")
  return role ? findMember(data, role.memberId) : undefined
}

export const departmentHead = (data: AppData, departmentId: string) => {
  const role = data.orgRoles.find((r) => r.kind === "division_head" && r.departmentId === departmentId)
  return role ? findMember(data, role.memberId) : undefined
}

export type ActorLevel = "representative" | "division_head" | "member"

export const actorLevel = (data: AppData, memberId: string): ActorLevel =>
  hasFullAccess(data, memberId) ? "representative" : isDivisionHead(data, memberId) ? "division_head" : "member"

export const orgRoleLabels = (data: AppData, memberId: string): string[] => {
  const labels: string[] = []
  if (isRepresentative(data, memberId)) labels.push("代表")
  for (const d of headDepartmentIds(data, memberId)) labels.push(`${findDepartment(data, d)?.name ?? ""} 事業部長`)
  return labels.length ? labels : ["メンバー"]
}

/* ---------- ツール内部役割 ---------- */

export const findToolRole = (tool: Tool | undefined, roleKey: string | null | undefined): ToolRole | null =>
  (tool && roleKey && tool.roles.find((r) => r.roleKey === roleKey)) || null

/** 複数の内部役割から、そのツール内で順位が最も高いものを返す */
export function resolveHighestToolRole(tool: Tool, roleKeys: (string | null | undefined)[]): ToolRole | null {
  let best: ToolRole | null = null
  for (const key of roleKeys) {
    const role = findToolRole(tool, key)
    if (role && (!best || role.rank > best.rank)) best = role
  }
  return best
}

export const toolStatus = (tool: Tool) => {
  if (tool.lastSyncFailed) return "sync_error" as const
  if (tool.roles.length === 0) return "pending_roles" as const
  return tool.integration
}

/* ---------- 実効アクセス ---------- */

export type AccessSourceKind = "department" | "position" | "request" | "manual" | "retained"

export interface AccessSourceInfo {
  kind: AccessSourceKind
  label: string
  detail: string
  role: ToolRole | null
  grantedAt?: string
}

export type DenyReason = "withdrawn" | "tool_disabled" | "manual_off" | "no_grant"

export interface EffectiveAccess {
  allowed: boolean
  denyReason?: DenyReason
  /** 最終的に適用される内部役割（利用可のときのみ） */
  appliedRole: ToolRole | null
  /** 保持している役割の最上位（利用不可でも保持） */
  heldRole: ToolRole | null
  manual: DraftCell
  autoAllowed: boolean
  sources: AccessSourceInfo[]
  /** 手動指定の役割より上位の付与元があり、そちらが適用されている */
  manualRoleSuperseded: boolean
}

export const activeGrants = (data: AppData, memberId: string, toolId: string): Grant[] =>
  data.grants.filter((g) => g.memberId === memberId && g.toolId === toolId && !g.revoked)

export function savedCell(data: AppData, memberId: string, toolId: string): DraftCell {
  const o = data.overrides.find((x) => x.memberId === memberId && x.toolId === toolId)
  return { access: o?.access ?? null, roleKey: o?.roleKey ?? null }
}

export const sameCell = (a: DraftCell, b: DraftCell) => a.access === b.access && (a.roleKey ?? null) === (b.roleKey ?? null)

function describeGrant(data: AppData, grant: Grant, tool: Tool): AccessSourceInfo {
  const dept = grant.departmentId ? findDepartment(data, grant.departmentId)?.name ?? "不明な所属" : ""
  const role = findToolRole(tool, grant.roleKey)
  const inDept = grant.departmentId ? memberDepartmentIds(data, grant.memberId).includes(grant.departmentId) : false
  if (grant.source === "request") {
    return { kind: "request", label: "申請", detail: "利用申請の承認により付与", role, grantedAt: grant.grantedAt }
  }
  if (grant.retainedAfterTransfer || (grant.departmentId && !inDept)) {
    return {
      kind: "retained",
      label: "異動後も保持",
      detail: `旧所属「${dept}」${grant.source === "position" ? "の役職" : ""}からの付与を保持`,
      role,
      grantedAt: grant.grantedAt,
    }
  }
  if (grant.source === "position") {
    const stillHead = grant.departmentId ? headDepartmentIds(data, grant.memberId).includes(grant.departmentId) : false
    return {
      kind: stillHead ? "position" : "retained",
      label: stillHead ? "役職" : "役職解除後も保持",
      detail: `${dept} 事業部長テンプレート`,
      role,
      grantedAt: grant.grantedAt,
    }
  }
  return { kind: "department", label: "所属", detail: `${dept} 一般メンバーテンプレート`, role, grantedAt: grant.grantedAt }
}

/**
 * 利用可否と内部役割の判定。表・詳細・申請・デモ切替すべてでこの関数を使う。
 * 1. 退会・ツール無効は最優先で拒否
 * 2. 手動ON/OFFが自動付与より優先
 * 3. 手動指定なしなら付与元（所属・役職・保持・申請）から判定
 */
export function resolveEffectiveAccess(
  data: AppData,
  memberId: string,
  toolId: string,
  cellOverride?: DraftCell,
): EffectiveAccess {
  const member = findMember(data, memberId)
  const tool = findTool(data, toolId)
  const manual = cellOverride ?? savedCell(data, memberId, toolId)
  const empty: EffectiveAccess = {
    allowed: false,
    denyReason: "no_grant",
    appliedRole: null,
    heldRole: null,
    manual,
    autoAllowed: false,
    sources: [],
    manualRoleSuperseded: false,
  }
  if (!member || !tool) return empty

  const grants = member.status === "withdrawn" ? [] : activeGrants(data, memberId, toolId)
  const sources = grants.map((g) => describeGrant(data, g, tool))
  const manualRole = findToolRole(tool, manual.roleKey)
  if (manual.access === "on" || manualRole) {
    sources.unshift({
      kind: "manual",
      label: "手動",
      detail:
        manual.access === "on" ? "管理者が手動で利用可に設定" : manual.access === "off" ? "管理者が手動で利用不可に設定" : "管理者が役割を手動指定",
      role: manualRole,
    })
  } else if (manual.access === "off") {
    sources.unshift({ kind: "manual", label: "手動", detail: "管理者が手動で利用不可に設定", role: null })
  }

  const autoAllowed = grants.length > 0
  const highest = resolveHighestToolRole(
    tool,
    [...grants.map((g) => g.roleKey), manual.roleKey],
  )
  const heldRole = highest ?? (manual.access === "on" ? findToolRole(tool, tool.defaultRoleKey) : null)
  const manualRoleSuperseded = !!manualRole && !!highest && highest.rank > manualRole.rank

  let allowed: boolean
  let denyReason: DenyReason | undefined
  if (member.status === "withdrawn") {
    allowed = false
    denyReason = "withdrawn"
  } else if (!tool.enabled) {
    allowed = false
    denyReason = "tool_disabled"
  } else if (manual.access === "on") {
    allowed = true
  } else if (manual.access === "off") {
    allowed = false
    denyReason = "manual_off"
  } else {
    allowed = autoAllowed
    if (!allowed) denyReason = "no_grant"
  }

  return {
    allowed,
    denyReason,
    appliedRole: allowed ? heldRole : null,
    heldRole,
    manual,
    autoAllowed,
    sources,
    manualRoleSuperseded,
  }
}

export const DENY_LABEL: Record<DenyReason, string> = {
  withdrawn: "退会済み",
  tool_disabled: "ツール無効",
  manual_off: "手動OFF",
  no_grant: "付与なし",
}

export function describeAccess(ea: EffectiveAccess) {
  if (!ea.allowed) return `利用不可（${DENY_LABEL[ea.denyReason ?? "no_grant"]}）`
  return `利用可（${ea.appliedRole?.label ?? "役割未設定"}）`
}

export function describeManual(access: ManualAccess) {
  return access === "on" ? "手動ON" : access === "off" ? "手動OFF" : "指定なし"
}

/* ---------- 管理範囲 ---------- */

export interface Permission {
  ok: boolean
  reason?: string
}

const deny = (reason: string): Permission => ({ ok: false, reason })
const allow: Permission = { ok: true }

/**
 * actor が target の（toolId の）権限を操作できるか。
 * action: toggle_access / change_role はツール権限、edit_member はメンバー情報の編集。
 */
export function canManageTarget(
  data: AppData,
  actorId: string,
  targetId: string,
  toolId: string | null,
  action: ScopeAction | "edit_member",
): Permission {
  const actor = findMember(data, actorId)
  if (!actor || actor.status === "withdrawn") return deny("操作ユーザーが無効です")
  if (hasFullAccess(data, actorId)) return allow

  const heads = headDepartmentIds(data, actorId)
  if (heads.length === 0) {
    return actorId === targetId
      ? deny("自分の権限は「自分の権限・申請」から申請してください")
      : deny("一般メンバーは他者の権限を変更できません")
  }
  if (actorId === targetId) return deny("自分自身の権限は変更できません。申請してください")
  if (isRepresentative(data, targetId) || isDivisionHead(data, targetId)) {
    return deny("代表・事業部長の権限は代表のみ変更できます")
  }

  const depts = memberDepartmentIds(data, targetId)
  if (depts.length === 0) return deny("所属未設定のメンバーは代表のみ変更できます")

  const uncovered = depts.filter((d) => {
    if (heads.includes(d)) return false
    if (action === "edit_member") return true
    return !data.scopes.some(
      (s) =>
        s.grantedTo === actorId &&
        s.departmentId === d &&
        s.actions.includes(action) &&
        (s.toolIds === "all" || (toolId !== null && s.toolIds.includes(toolId))),
    )
  })
  if (uncovered.length === 0) return allow
  const names = uncovered.map((d) => findDepartment(data, d)?.name ?? d).join("・")
  if (uncovered.length === depts.length) return deny(`他部署（${names}）のメンバーのため変更できません`)
  return deny(`兼務先（${names}）の管理範囲がないため変更できません`)
}

export function canAssignToolRole(data: AppData, actorId: string, toolId: string, roleKey: string | null): Permission {
  if (!roleKey) return allow
  const tool = findTool(data, toolId)
  const role = findToolRole(tool, roleKey)
  if (!tool || !role) return deny("役割が定義されていません")
  if (role.assignableBy === "representative" && !hasFullAccess(data, actorId)) {
    return deny(`「${role.label}」は代表のみ付与できます`)
  }
  return allow
}

export type LockKind = "withdrawn" | "tool_disabled" | "pending_roles" | "no_permission"

export interface CellLock {
  kind: LockKind
  reason: string
}

export function getCellLock(data: AppData, actorId: string, memberId: string, toolId: string): CellLock | null {
  const member = findMember(data, memberId)
  const tool = findTool(data, toolId)
  if (!member || !tool) return { kind: "no_permission", reason: "データがありません" }
  if (member.status === "withdrawn") return { kind: "withdrawn", reason: "退会済みのため利用できません" }
  if (!tool.enabled) return { kind: "tool_disabled", reason: "ポータル側でツールが無効化されています" }
  if (tool.roles.length === 0) return { kind: "pending_roles", reason: "権限定義待ち：ポータル側で役割が未定義です" }
  const p = canManageTarget(data, actorId, memberId, toolId, "toggle_access")
  if (!p.ok) return { kind: "no_permission", reason: p.reason ?? "操作権限がありません" }
  return null
}

/** 表示中（フィルター結果）のセルのうち、一括操作できるものと除外理由を返す */
export function getVisibleBulkTargets(
  data: AppData,
  actorId: string,
  cells: { memberId: string; toolId: string }[],
) {
  const targets: { memberId: string; toolId: string }[] = []
  const excluded: { memberId: string; toolId: string; reason: string }[] = []
  for (const c of cells) {
    const lock = getCellLock(data, actorId, c.memberId, c.toolId)
    if (lock) excluded.push({ ...c, reason: lock.reason })
    else targets.push(c)
  }
  return { targets, excluded }
}

/* ---------- 所属・役職テンプレート ---------- */

export interface GrantPreviewItem {
  memberId: string
  toolId: string
  roleKey: string
  departmentId: string
  position: TemplatePosition
  /** 手動OFFのため付与しても利用可にならない */
  blockedByManualOff: boolean
}

/** 所属・役職テンプレートに従った追加付与を計算する（既存付与は削除しない） */
export function applyDepartmentRoleGrants(
  data: AppData,
  memberId: string,
  departmentId: string,
  position: TemplatePosition,
): GrantPreviewItem[] {
  const items: GrantPreviewItem[] = []
  for (const tpl of data.templates) {
    if (tpl.departmentId !== departmentId || tpl.position !== position) continue
    const tool = findTool(data, tpl.toolId)
    if (!tool || !findToolRole(tool, tpl.roleKey)) continue
    const exists = data.grants.some(
      (g) =>
        !g.revoked &&
        g.memberId === memberId &&
        g.toolId === tpl.toolId &&
        g.departmentId === departmentId &&
        g.source === (position === "member" ? "department" : "position") &&
        g.roleKey === tpl.roleKey &&
        !g.retainedAfterTransfer,
    )
    if (exists) continue
    items.push({
      memberId,
      toolId: tpl.toolId,
      roleKey: tpl.roleKey,
      departmentId,
      position,
      blockedByManualOff: savedCell(data, memberId, tpl.toolId).access === "off",
    })
  }
  return items
}

/* ---------- 申請先 ---------- */

export interface ApproverCandidate {
  member: Member
  viaRoute: "primary" | "alternate" | null
  escalated: boolean
}

export function getApproverCandidates(
  data: AppData,
  requesterId: string,
  toolId: string,
  roleKey: string,
): ApproverCandidate[] {
  const depts = memberDepartmentIds(data, requesterId)
  const routes = data.routes.filter(
    (r) =>
      (r.departmentId === null || depts.includes(r.departmentId)) &&
      (r.toolId === null || r.toolId === toolId) &&
      (r.roleKey === null || r.roleKey === roleKey),
  )
  const result: ApproverCandidate[] = []
  for (const m of data.members) {
    if (m.id === requesterId || m.status !== "active") continue
    const ok =
      canManageTarget(data, m.id, requesterId, toolId, "toggle_access").ok &&
      canManageTarget(data, m.id, requesterId, toolId, "change_role").ok &&
      canAssignToolRole(data, m.id, toolId, roleKey).ok
    if (!ok) continue
    const viaRoute = routes.some((r) => r.approverId === m.id)
      ? "primary"
      : routes.some((r) => r.alternateId === m.id)
        ? "alternate"
        : null
    result.push({ member: m, viaRoute, escalated: false })
  }
  const nonRep = result.filter((c) => !isRepresentative(data, c.member.id))
  for (const c of result) {
    if (isRepresentative(data, c.member.id) && nonRep.length === 0 && c.viaRoute === null) c.escalated = true
  }
  const order = (c: ApproverCandidate) => (c.viaRoute === "primary" ? 0 : c.viaRoute === "alternate" ? 1 : 2)
  return result.sort((a, b) => order(a) - order(b))
}
