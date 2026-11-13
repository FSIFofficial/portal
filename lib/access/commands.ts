import { newId } from "./format"
import { toolFromPortal } from "./portal"
import {
  activeGrants,
  hasFullAccess,
  isOrgAccount,
  departmentAncestors,
  departmentDescendants,
  findMemberByEmail,
  managedDepartmentIds,
  memberEmails,
  applyDepartmentRoleGrants,
  canAssignToolRole,
  canManageTarget,
  cellKey,
  describeAccess,
  findDepartment,
  findMember,
  findTool,
  findToolRole,
  getApproverCandidates,
  getCellLock,
  headDepartmentIds,
  isDivisionHead,
  isRepresentative,
  memberDepartmentIds,
  parseCellKey,
  resolveEffectiveAccess,
  savedCell,
  sameCell,
  type GrantPreviewItem,
} from "./rules"
import type {
  AppData,
  DeletionRequest,
  AppNotification,
  AuditLog,
  ChangeItem,
  Draft,
  DraftCell,
  EmploymentStatus,
  Grant,
  ManagementScope,
  ApprovalRoute,
  NotificationKind,
  RequestType,
  TemplatePosition,
  Tool,
  ToolRole,
} from "./types"

export class CommandError extends Error {}

const fail = (message: string): never => {
  throw new CommandError(message)
}

const clone = (data: AppData): AppData => structuredClone(data)
const nowIso = () => new Date().toISOString()

const memberName = (d: AppData, id: string | null | undefined) => (id ? findMember(d, id)?.name ?? "不明" : "自動処理")
const toolName = (d: AppData, id: string) => findTool(d, id)?.name ?? id
const deptName = (d: AppData, id: string) => findDepartment(d, id)?.name ?? id

const describe = (d: AppData, memberId: string, toolId: string) => describeAccess(resolveEffectiveAccess(d, memberId, toolId))

function audit(d: AppData, log: Omit<AuditLog, "id" | "at"> & { at?: string }) {
  d.audit.unshift({ id: newId("a"), at: log.at ?? nowIso(), ...log })
}

function notify(
  d: AppData,
  n: { recipientId: string; kind: NotificationKind; title: string; body: string; items?: ChangeItem[]; actorId: string | null; reason?: string },
) {
  const recipient = findMember(d, n.recipientId)
  if (!recipient || recipient.status === "withdrawn") return
  const entry: AppNotification = { id: newId("n"), items: [], createdAt: nowIso(), read: false, ...n }
  d.notifications.unshift(entry)
}

function setOverride(d: AppData, memberId: string, toolId: string, cell: DraftCell, actorId: string) {
  const idx = d.overrides.findIndex((o) => o.memberId === memberId && o.toolId === toolId)
  if (cell.access === null && cell.roleKey === null) {
    if (idx >= 0) d.overrides.splice(idx, 1)
    return
  }
  const entry = { memberId, toolId, access: cell.access, roleKey: cell.roleKey, updatedBy: actorId, updatedAt: nowIso() }
  if (idx >= 0) d.overrides[idx] = entry
  else d.overrides.push(entry)
}

function addGrantsFromPreview(d: AppData, items: GrantPreviewItem[], at = nowIso()): Grant[] {
  const created: Grant[] = items.map((item) => ({
    id: newId("g"),
    memberId: item.memberId,
    toolId: item.toolId,
    roleKey: item.roleKey,
    source: item.position === "member" ? "department" : "position",
    departmentId: item.departmentId,
    ...(item.templateDepartmentId ? { templateDepartmentId: item.templateDepartmentId } : {}),
    position: item.position,
    grantedAt: at,
    retainedAfterTransfer: false,
  }))
  d.grants.push(...created)
  return created
}

/** 付与前後の差分を受信者ごとに通知用 ChangeItem へまとめる */
function diffForMembers(before: AppData, after: AppData, memberIds: string[], toolIds?: string[]) {
  const byMember = new Map<string, ChangeItem[]>()
  for (const memberId of memberIds) {
    for (const tool of after.tools) {
      if (toolIds && !toolIds.includes(tool.id)) continue
      const b = describe(before, memberId, tool.id)
      const a = describe(after, memberId, tool.id)
      if (a === b) continue
      const list = byMember.get(memberId) ?? []
      list.push({ memberId, toolId: tool.id, label: tool.name, before: b, after: a })
      byMember.set(memberId, list)
    }
  }
  return byMember
}

/* ---------- 権限マトリクスの保存 ---------- */

export interface CommitOptions {
  actorId: string
  reason: string
  bulkKeys: Set<string>
}

/** 下書きを確定状態へ反映し、履歴・通知を同じコミットで作成する */
export function commitChanges(data: AppData, draft: Draft, opts: CommitOptions): AppData {
  const keys = Object.keys(draft).filter((k) => {
    const { memberId, toolId } = parseCellKey(k)
    return !sameCell(draft[k], savedCell(data, memberId, toolId))
  })
  if (keys.length === 0) fail("変更はありません")

  for (const key of keys) {
    const { memberId, toolId } = parseCellKey(key)
    const lock = getCellLock(data, opts.actorId, memberId, toolId)
    if (lock) fail(`${memberName(data, memberId)} / ${toolName(data, toolId)}：${lock.reason}`)
    const cell = draft[key]
    const before = savedCell(data, memberId, toolId)
    if (cell.roleKey !== before.roleKey) {
      const p = canManageTarget(data, opts.actorId, memberId, toolId, "change_role")
      if (!p.ok) fail(`${memberName(data, memberId)} / ${toolName(data, toolId)}：${p.reason}`)
      const r = canAssignToolRole(data, opts.actorId, toolId, cell.roleKey)
      if (!r.ok) fail(`${memberName(data, memberId)} / ${toolName(data, toolId)}：${r.reason}`)
    }
  }

  const d = clone(data)
  const manualItems: ChangeItem[] = []
  const bulkItems: ChangeItem[] = []
  const perRecipient = new Map<string, ChangeItem[]>()

  for (const key of keys) {
    const { memberId, toolId } = parseCellKey(key)
    const beforeLabel = describe(data, memberId, toolId)
    setOverride(d, memberId, toolId, draft[key], opts.actorId)
    const afterLabel = describe(d, memberId, toolId)
    const prevCell = savedCell(data, memberId, toolId)
    const roleNote =
      prevCell.roleKey !== draft[key].roleKey
        ? `／指定役割 ${findToolRole(findTool(d, toolId), draft[key].roleKey)?.label ?? "なし"}`
        : ""
    const item: ChangeItem = {
      memberId,
      toolId,
      label: `${memberName(d, memberId)} / ${toolName(d, toolId)}`,
      before: beforeLabel,
      after: `${afterLabel}${roleNote}`,
    }
    ;(opts.bulkKeys.has(key) ? bulkItems : manualItems).push(item)
    const list = perRecipient.get(memberId) ?? []
    list.push({ ...item, label: toolName(d, toolId) })
    perRecipient.set(memberId, list)
  }

  for (const [items, source] of [
    [manualItems, "manual"],
    [bulkItems, "bulk"],
  ] as const) {
    if (items.length === 0) continue
    audit(d, {
      actorId: opts.actorId,
      source,
      summary: `${items.length}件の権限を${source === "bulk" ? "一括" : ""}変更`,
      memberIds: [...new Set(items.map((i) => i.memberId!))],
      toolIds: [...new Set(items.map((i) => i.toolId!))],
      items,
      reason: opts.reason || undefined,
    })
  }

  for (const [recipientId, items] of perRecipient) {
    notify(d, {
      recipientId,
      kind: "access",
      title: "ツール権限が変更されました",
      body: `${items.length}件の変更：${items.map((i) => i.label).join("、")}`,
      items,
      actorId: opts.actorId,
      reason: opts.reason || undefined,
    })
  }

  d.version += 1
  return d
}

/** 競合デモ：別の管理者が先に保存した状況を作る */
export function simulateExternalChange(data: AppData): AppData {
  const d = clone(data)
  const target = { memberId: "m10", toolId: "portal-kpi" }
  const before = describe(data, target.memberId, target.toolId)
  const cur = savedCell(d, target.memberId, target.toolId)
  setOverride(d, target.memberId, target.toolId, { access: cur.access === "off" ? null : "off", roleKey: null }, "m01")
  audit(d, {
    actorId: "m01",
    source: "manual",
    summary: "（競合デモ）別の管理者が 小野寺 健 / KPI Dashboard を更新",
    memberIds: [target.memberId],
    toolIds: [target.toolId],
    items: [{ ...target, label: "小野寺 健 / KPI Dashboard", before, after: describe(d, target.memberId, target.toolId) }],
    reason: "別セッションでの更新（デモ）",
  })
  d.version += 1
  return d
}

/* ---------- 組織役割：任命・解除・譲渡 ---------- */

export function previewPositionGrants(data: AppData, memberId: string, departmentId: string) {
  return applyDepartmentRoleGrants(data, memberId, departmentId, "division_head")
}

export function appointDivisionHead(data: AppData, actorId: string, memberId: string, departmentId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("事業部長の任命は代表のみ行えます")
  const m = findMember(data, memberId) ?? fail("メンバーが見つかりません")
  if (m.status !== "active") fail("在籍中のメンバーのみ任命できます")
  if (isOrgAccount(data, memberId)) fail("団体垢は事業部長にできません")
  if (!memberDepartmentIds(data, memberId).includes(departmentId)) fail("対象部署に所属しているメンバーのみ任命できます")
  if (data.orgRoles.some((r) => r.kind === "division_head" && r.departmentId === departmentId)) {
    fail("この部署には既に事業部長がいます。先に解除してください")
  }
  const d = clone(data)
  d.orgRoles.push({ id: newId("or"), memberId, kind: "division_head", departmentId, assignedAt: nowIso() })
  const created = addGrantsFromPreview(d, applyDepartmentRoleGrants(d, memberId, departmentId, "division_head"))
  const diff = diffForMembers(data, d, [memberId])
  audit(d, {
    actorId,
    source: "appointment",
    summary: `${m.name} を ${deptName(d, departmentId)} 事業部長に任命`,
    memberIds: [memberId],
    toolIds: created.map((g) => g.toolId),
    items: [{ memberId, label: "組織役割", before: "—", after: `${deptName(d, departmentId)} 事業部長` }, ...(diff.get(memberId) ?? [])],
  })
  notify(d, {
    recipientId: memberId,
    kind: "org",
    title: "事業部長に任命されました",
    body: `${deptName(d, departmentId)} の事業部長に任命されました。役職テンプレートの権限が付与されています。`,
    items: diff.get(memberId) ?? [],
    actorId,
  })
  d.version += 1
  return d
}

export function dismissDivisionHead(data: AppData, actorId: string, roleId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("事業部長の解除は代表のみ行えます")
  const role = data.orgRoles.find((r) => r.id === roleId && r.kind === "division_head") ?? fail("役割が見つかりません")
  const d = clone(data)
  d.orgRoles = d.orgRoles.filter((r) => r.id !== roleId)
  const removedScopes = isDivisionHead(d, role.memberId) ? [] : d.scopes.filter((s) => s.grantedTo === role.memberId)
  d.scopes = d.scopes.filter((s) => !removedScopes.includes(s))
  audit(d, {
    actorId,
    source: "appointment",
    summary: `${memberName(d, role.memberId)} の ${deptName(d, role.departmentId!)} 事業部長を解除`,
    memberIds: [role.memberId],
    toolIds: [],
    items: [
      { memberId: role.memberId, label: "組織役割", before: `${deptName(d, role.departmentId!)} 事業部長`, after: "—" },
      ...(removedScopes.length ? [{ memberId: role.memberId, label: "追加管理範囲", before: `${removedScopes.length}件`, after: "解除" }] : []),
    ],
  })
  notify(d, {
    recipientId: role.memberId,
    kind: "org",
    title: "事業部長が解除されました",
    body: `${deptName(d, role.departmentId!)} の事業部長が解除されました。ツール権限はそのまま保持されています。`,
    actorId,
  })
  d.version += 1
  return d
}

export interface TransferPreview {
  roleLabel: string
  scopesMoving: ManagementScope[]
  successorGrants: GrantPreviewItem[]
  youLose: string[]
}

export function previewTransfer(data: AppData, actorId: string, roleId: string, toId: string): TransferPreview {
  const role = data.orgRoles.find((r) => r.id === roleId)
  if (!role) return { roleLabel: "", scopesMoving: [], successorGrants: [], youLose: [] }
  // 失うもの・移るものは「役割を持っている人」基準（代表が他人の事業部長を譲渡する場合もある）
  const holderId = role.memberId
  const remainingHeads = headDepartmentIds(data, holderId).filter((x) => x !== role.departmentId)
  const scopesMoving = role.kind === "division_head" && remainingHeads.length === 0 ? data.scopes.filter((s) => s.grantedTo === holderId) : []
  const roleLabel = role.kind === "representative" ? "代表" : `${deptName(data, role.departmentId!)} 事業部長`
  const youLose =
    role.kind === "representative"
      ? ["全体の管理権限（全メンバー・全ツールの権限変更）", "事業部長の任命・解除", "管理範囲・申請先の設定", "代表宛て申請の承認"]
      : [
          `${deptName(data, role.departmentId!)} の一般メンバーの権限管理`,
          `${deptName(data, role.departmentId!)} の申請の承認`,
          ...scopesMoving.map((s) => `追加管理範囲：${deptName(data, s.departmentId)}`),
        ]
  return {
    roleLabel,
    scopesMoving,
    successorGrants: role.kind === "division_head" && toId ? applyDepartmentRoleGrants(data, toId, role.departmentId!, "division_head") : [],
    youLose,
  }
}

export function transferOrganizationRole(data: AppData, actorId: string, roleId: string, toId: string): AppData {
  const role = data.orgRoles.find((r) => r.id === roleId) ?? fail("役割が見つかりません")
  if (role.kind === "org_account") fail("団体垢は譲渡できません")
  if (role.memberId !== actorId && !hasFullAccess(data, actorId)) fail("役割を持つ本人か代表のみ譲渡できます")
  const fromId = role.memberId
  if (toId === fromId) fail("今の担当者には譲渡できません")
  const to = findMember(data, toId) ?? fail("後任が見つかりません")
  if (to.status !== "active") fail("在籍中のメンバーのみ後任にできます")
  if (isOrgAccount(data, toId)) fail("団体垢は後任にできません")
  if (role.kind === "division_head" && !memberDepartmentIds(data, toId).includes(role.departmentId!)) {
    fail("事業部長は自部署のメンバーにのみ譲渡できます")
  }
  const preview = previewTransfer(data, actorId, roleId, toId)
  const d = clone(data)
  const r = d.orgRoles.find((x) => x.id === roleId)!
  r.memberId = toId
  r.assignedAt = nowIso()
  for (const s of d.scopes) if (preview.scopesMoving.some((m) => m.id === s.id)) s.grantedTo = toId
  if (role.kind === "division_head") addGrantsFromPreview(d, applyDepartmentRoleGrants(d, toId, role.departmentId!, "division_head"))
  d.transfers.unshift({ id: newId("tr"), kind: role.kind, departmentId: role.departmentId, fromId, toId, at: nowIso() })
  const diff = diffForMembers(data, d, [toId])
  const byOther = fromId !== actorId
  audit(d, {
    actorId,
    source: "transfer",
    summary: `${preview.roleLabel} を ${memberName(d, fromId)} から ${to.name} へ譲渡`,
    memberIds: [fromId, toId],
    toolIds: [],
    items: [
      { memberId: fromId, label: memberName(d, fromId), before: preview.roleLabel, after: "—" },
      { memberId: toId, label: to.name, before: "—", after: preview.roleLabel },
      ...(diff.get(toId) ?? []),
    ],
  })
  notify(d, {
    recipientId: fromId,
    kind: "transfer",
    title: byOther ? `${preview.roleLabel} が ${to.name} さんへ移りました` : `${preview.roleLabel} を譲渡しました`,
    body: byOther
      ? `${memberName(d, actorId)} さんの操作で、${preview.roleLabel} が ${to.name} さんへ移りました。あなたの当該権限は解除されています。`
      : `${to.name} さんへ ${preview.roleLabel} を譲渡しました。あなたの当該権限は解除されています。`,
    actorId,
  })
  notify(d, {
    recipientId: toId,
    kind: "transfer",
    title: `${preview.roleLabel} を引き継ぎました`,
    body: `${memberName(d, fromId)} さんから ${preview.roleLabel} を引き継ぎました。`,
    items: diff.get(toId) ?? [],
    actorId,
  })
  d.version += 1
  return d
}

/* ---------- 管理範囲・申請先 ---------- */

export function saveScope(data: AppData, actorId: string, input: Omit<ManagementScope, "id" | "grantedBy" | "grantedAt"> & { id?: string }): AppData {
  if (!hasFullAccess(data, actorId)) fail("管理範囲を拡張できるのは代表のみです")
  if (input.grantedTo === actorId) fail("自分自身の管理範囲は変更できません")
  if (!isDivisionHead(data, input.grantedTo)) fail("事業部長にのみ管理範囲を追加できます")
  if (headDepartmentIds(data, input.grantedTo).includes(input.departmentId)) fail("自部署は既に管理範囲に含まれています")
  if (input.actions.length === 0) fail("許可する操作を1つ以上選択してください")
  if (input.toolIds !== "all" && input.toolIds.length === 0) fail("対象ツールを選択してください")
  const d = clone(data)
  const entry: ManagementScope = { ...input, id: input.id ?? newId("sc"), grantedBy: actorId, grantedAt: nowIso() }
  const idx = d.scopes.findIndex((s) => s.id === entry.id)
  if (idx >= 0) d.scopes[idx] = entry
  else d.scopes.push(entry)
  const toolsLabel = entry.toolIds === "all" ? "全ツール" : entry.toolIds.map((t) => toolName(d, t)).join("・")
  const actionsLabel = entry.actions.map((a) => (a === "toggle_access" ? "利用ON/OFF" : "役割変更")).join("・")
  audit(d, {
    actorId,
    source: "appointment",
    summary: `${memberName(d, entry.grantedTo)} の管理範囲を${idx >= 0 ? "更新" : "追加"}`,
    memberIds: [entry.grantedTo],
    toolIds: entry.toolIds === "all" ? [] : entry.toolIds,
    items: [{ memberId: entry.grantedTo, label: "管理範囲", before: idx >= 0 ? "変更前の設定" : "なし", after: `${deptName(d, entry.departmentId)}／${toolsLabel}（${actionsLabel}）` }],
  })
  notify(d, {
    recipientId: entry.grantedTo,
    kind: "scope",
    title: "管理範囲が変更されました",
    body: `${deptName(d, entry.departmentId)}／${toolsLabel} の ${actionsLabel} を管理できます。`,
    actorId,
  })
  d.version += 1
  return d
}

export function removeScope(data: AppData, actorId: string, scopeId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("管理範囲を変更できるのは代表のみです")
  const scope = data.scopes.find((s) => s.id === scopeId) ?? fail("管理範囲が見つかりません")
  const d = clone(data)
  d.scopes = d.scopes.filter((s) => s.id !== scopeId)
  audit(d, {
    actorId,
    source: "appointment",
    summary: `${memberName(d, scope.grantedTo)} の追加管理範囲（${deptName(d, scope.departmentId)}）を解除`,
    memberIds: [scope.grantedTo],
    toolIds: [],
    items: [{ memberId: scope.grantedTo, label: "管理範囲", before: deptName(d, scope.departmentId), after: "解除" }],
  })
  notify(d, {
    recipientId: scope.grantedTo,
    kind: "scope",
    title: "管理範囲が解除されました",
    body: `${deptName(d, scope.departmentId)} の追加管理範囲が解除されました。`,
    actorId,
  })
  d.version += 1
  return d
}

export function saveRoute(data: AppData, actorId: string, input: Omit<ApprovalRoute, "id"> & { id?: string }): AppData {
  if (!hasFullAccess(data, actorId)) fail("申請先を設定できるのは代表のみです")
  if (input.alternateId && input.alternateId === input.approverId) fail("担当者と代替担当者は別の人を選んでください")
  if (isOrgAccount(data, input.approverId) || (input.alternateId && isOrgAccount(data, input.alternateId))) fail("団体垢は申請先にできません")
  const d = clone(data)
  const entry = { ...input, id: input.id ?? newId("rt") }
  const idx = d.routes.findIndex((r) => r.id === entry.id)
  if (idx >= 0) d.routes[idx] = entry
  else d.routes.push(entry)
  d.version += 1
  return d
}

export function removeRoute(data: AppData, actorId: string, routeId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("申請先を設定できるのは代表のみです")
  const d = clone(data)
  d.routes = d.routes.filter((r) => r.id !== routeId)
  d.version += 1
  return d
}

/* ---------- メンバー ---------- */

export interface MemberInput {
  id?: string
  name: string
  email: string
  /** 追加のメールアドレス */
  altEmails?: string[]
  departmentIds: string[]
  status: EmploymentStatus
}

const cleanEmails = (list: string[] | undefined) => [...new Set((list ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean))]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateMemberInput(data: AppData, actorId: string, input: MemberInput): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!input.name.trim()) errors.name = "氏名を入力してください"
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) errors.email = "メールアドレスの形式が正しくありません"
  else if (data.members.some((m) => m.id !== input.id && memberEmails(m).includes(email))) errors.email = "このメールアドレスは既に登録されています"
  const alts = cleanEmails(input.altEmails)
  const badAlt = alts.find((e) => !EMAIL_RE.test(e))
  const dupAlt = alts.find((e) => data.members.some((m) => m.id !== input.id && memberEmails(m).includes(e)))
  if (badAlt) errors.altEmails = `「${badAlt}」はメールアドレスの形式が正しくありません`
  else if (dupAlt) errors.altEmails = `「${dupAlt}」は他のメンバーに登録されています`
  else if (alts.includes(email)) errors.altEmails = "主なメールアドレスと同じアドレスが入っています"

  const rep = hasFullAccess(data, actorId)
  if (!rep) {
    const heads = headDepartmentIds(data, actorId)
    if (heads.length === 0) errors.form = "メンバー情報を編集する権限がありません"
    else {
      if (input.id) {
        const p = canManageTarget(data, actorId, input.id, null, "edit_member")
        if (!p.ok) errors.form = p.reason ?? "このメンバーは編集できません"
      }
      if (input.departmentIds.length === 0) errors.departmentIds = "所属未設定にできるのは代表のみです"
      else if (input.departmentIds.some((x) => !managedDepartmentIds(data, actorId).includes(x))) errors.departmentIds = "管理範囲外の所属は設定できません"
    }
  }
  if (input.id) {
    const current = findMember(data, input.id)
    for (const r of data.orgRoles) {
      if (r.memberId !== input.id || r.kind !== "division_head") continue
      if (!input.departmentIds.includes(r.departmentId!)) errors.departmentIds = "事業部長を務める所属は外せません。先に解除・譲渡してください"
    }
    if (input.status === "withdrawn" && current?.status !== "withdrawn") {
      if (isRepresentative(data, input.id)) errors.status = "代表は後任へ譲渡してから退会してください"
      else if (isDivisionHead(data, input.id)) errors.status = "事業部長を解除・譲渡してから退会してください"
    }
  } else if (input.status === "withdrawn") errors.status = "新規メンバーを退会状態では登録できません"
  return errors
}

export function previewMemberChange(data: AppData, input: MemberInput) {
  const before = input.id ? memberDepartmentIds(data, input.id) : []
  const added = input.departmentIds.filter((x) => !before.includes(x))
  const removed = before.filter((x) => !input.departmentIds.includes(x))
  const memberId = input.id ?? "__new__"
  const grants = added.flatMap((dep) => applyDepartmentRoleGrants(data, memberId, dep, "member"))
  return { added, removed, grants }
}

export function saveMember(data: AppData, actorId: string, input: MemberInput): AppData {
  const errors = validateMemberInput(data, actorId, input)
  const first = Object.values(errors)[0]
  if (first) fail(first)
  const d = clone(data)
  const at = nowIso()
  const isNew = !input.id
  const id = input.id ?? newId("m")
  const prev = findMember(data, id)
  const items: ChangeItem[] = []

  if (isNew) {
    const alts = cleanEmails(input.altEmails)
    d.members.push({ id, name: input.name.trim(), email: input.email.trim().toLowerCase(), ...(alts.length ? { altEmails: alts } : {}), status: input.status, joinedAt: at })
    items.push({ memberId: id, label: "メンバー追加", before: "—", after: input.name.trim() })
  } else {
    const m = d.members.find((x) => x.id === id)!
    if (m.name !== input.name.trim()) items.push({ memberId: id, label: "氏名", before: m.name, after: input.name.trim() })
    if (m.email !== input.email.trim().toLowerCase()) items.push({ memberId: id, label: "メール", before: m.email, after: input.email.trim().toLowerCase() })
    const alts = cleanEmails(input.altEmails)
    const prevAlts = m.altEmails ?? []
    if (alts.join(",") !== prevAlts.join(",")) items.push({ memberId: id, label: "追加のメール", before: prevAlts.join("、") || "なし", after: alts.join("、") || "なし" })
    m.name = input.name.trim()
    m.email = input.email.trim().toLowerCase()
    if (alts.length) m.altEmails = alts
    else delete m.altEmails
  }

  const before = isNew ? [] : memberDepartmentIds(data, id)
  const added = input.departmentIds.filter((x) => !before.includes(x))
  const removed = before.filter((x) => !input.departmentIds.includes(x))
  if (added.length || removed.length) {
    items.push({
      memberId: id,
      label: "所属",
      before: before.map((x) => deptName(d, x)).join("・") || "未設定",
      after: input.departmentIds.map((x) => deptName(d, x)).join("・") || "未設定",
    })
  }
  d.memberships = d.memberships.filter((ms) => !(ms.memberId === id && removed.includes(ms.departmentId)))
  for (const dep of added) d.memberships.push({ memberId: id, departmentId: dep, since: at })
  for (const g of d.grants) if (g.memberId === id && g.departmentId && removed.includes(g.departmentId)) g.retainedAfterTransfer = true

  const prevStatus = prev?.status
  const m = d.members.find((x) => x.id === id)!
  if (prevStatus && prevStatus !== input.status) {
    items.push({ memberId: id, label: "在籍状態", before: statusText(prevStatus), after: statusText(input.status) })
    m.status = input.status
    if (prevStatus === "withdrawn") {
      // 退会から戻したら、完全削除の申請・予約は取り消す
      for (const del of d.deletions ?? []) {
        if (del.memberId === id && (del.status === "pending" || del.status === "scheduled")) {
          const was = del.status === "scheduled" ? "削除予約" : "承認待ち"
          cancelDeletionIn(d, del.id, actorId, "退会から戻したため")
          items.push({ memberId: id, label: "完全削除", before: was, after: "取り消し（退会から戻したため）" })
        }
      }
      // 再加入：退会前の個別権限は復活させず、現在の所属設定から再付与する
      for (const g of d.grants) if (g.memberId === id) g.revoked = true
      d.overrides = d.overrides.filter((o) => o.memberId !== id)
      for (const dep of input.departmentIds) addGrantsFromPreview(d, applyDepartmentRoleGrants(d, id, dep, "member"), at)
    }
  }
  if (m.status !== "withdrawn") {
    for (const dep of added) addGrantsFromPreview(d, applyDepartmentRoleGrants(d, id, dep, "member"), at)
  }

  if (items.length === 0) fail("変更はありません")
  const diff = isNew ? new Map<string, ChangeItem[]>() : diffForMembers(data, d, [id])
  const toolItems = diff.get(id) ?? []
  audit(d, {
    actorId,
    source: "member",
    summary: isNew
      ? `${m.name} を追加`
      : input.status === "withdrawn" && prevStatus !== "withdrawn"
        ? `${m.name} を退会に変更（全ツール利用不可）`
        : `${m.name} のメンバー情報を更新`,
    memberIds: [id],
    toolIds: toolItems.map((i) => i.toolId!),
    items: [...items, ...toolItems],
  })
  if (!isNew && m.status !== "withdrawn" && (toolItems.length || added.length || removed.length || prevStatus !== input.status)) {
    notify(d, {
      recipientId: id,
      kind: "member",
      title: "所属・在籍情報が更新されました",
      body: items.map((i) => `${i.label}：${i.after}`).join(" ／ "),
      items: toolItems,
      actorId,
    })
  }
  d.version += 1
  return d
}

const statusText = (s: EmploymentStatus) => ({ active: "在籍", suspended: "休止", withdrawn: "退会" })[s]

/* ---------- 所属テンプレート ---------- */

export interface TemplateRow {
  toolId: string
  roleKey: string | null
}

export function previewTemplateApplication(data: AppData, departmentId: string, position: TemplatePosition, rows: TemplateRow[]) {
  const temp = clone(data)
  temp.templates = [
    ...temp.templates.filter((t) => !(t.departmentId === departmentId && t.position === position)),
    ...rows.filter((r) => r.roleKey).map((r) => ({ departmentId, position, toolId: r.toolId, roleKey: r.roleKey! })),
  ]
  // 対象はこの部署と、配下の部署（テンプレートを引き継ぐ）の人
  const items = subtreeGrantItems(temp, departmentDescendants(temp, departmentId), position)
  const removedRows = data.templates.filter(
    (t) => t.departmentId === departmentId && t.position === position && !rows.some((r) => r.toolId === t.toolId && r.roleKey),
  )
  return { temp, items, removedRows }
}

/** 部署（複数）に所属する人・事業部長に、テンプレート（親からの引き継ぎを含む）どおりの付与を足すときの一覧 */
function subtreeGrantItems(data: AppData, departmentIds: string[], position: TemplatePosition): GrantPreviewItem[] {
  const pairs =
    position === "member"
      ? data.memberships.filter((ms) => departmentIds.includes(ms.departmentId)).map((ms) => [ms.memberId, ms.departmentId] as const)
      : data.orgRoles.filter((r) => r.kind === "division_head" && r.departmentId && departmentIds.includes(r.departmentId)).map((r) => [r.memberId, r.departmentId!] as const)
  return pairs.filter(([id]) => findMember(data, id)?.status !== "withdrawn").flatMap(([id, dep]) => applyDepartmentRoleGrants(data, id, dep, position))
}

export function applyTemplate(data: AppData, actorId: string, departmentId: string, position: TemplatePosition, rows: TemplateRow[]): AppData {
  if (!hasFullAccess(data, actorId)) fail("テンプレートを編集できるのは代表のみです")
  const { temp, items, removedRows } = previewTemplateApplication(data, departmentId, position, rows)
  const d = temp
  addGrantsFromPreview(d, items)
  const memberIds = [...new Set(items.map((i) => i.memberId))]
  const diff = diffForMembers(data, d, memberIds)
  audit(d, {
    actorId,
    source: "auto",
    summary: `${deptName(d, departmentId)}（${position === "member" ? "一般メンバー" : "事業部長"}）のテンプレートを更新し、${items.length}件を追加付与`,
    memberIds,
    toolIds: [...new Set(items.map((i) => i.toolId))],
    items: [
      ...items.map((i) => ({
        memberId: i.memberId,
        toolId: i.toolId,
        label: `${memberName(d, i.memberId)} / ${toolName(d, i.toolId)}`,
        before: "付与なし",
        after: `${findToolRole(findTool(d, i.toolId), i.roleKey)?.label ?? i.roleKey}を付与${i.blockedByManualOff ? "（手動OFFのため利用不可のまま）" : ""}`,
      })),
      ...removedRows.map((r) => ({ toolId: r.toolId, label: `テンプレート：${toolName(d, r.toolId)}`, before: "対象", after: "対象外（既存付与は保持）" })),
    ],
  })
  for (const [recipientId, list] of diff) {
    notify(d, {
      recipientId,
      kind: "access",
      title: "所属テンプレートにより権限が付与されました",
      body: list.map((i) => `${i.label}：${i.after}`).join("、"),
      items: list,
      actorId,
    })
  }
  d.version += 1
  return d
}

/* ---------- 申請 ---------- */

export function submitRequest(
  data: AppData,
  requesterId: string,
  input: { toolId: string; type: RequestType; roleKey: string; reason: string; approverId: string },
): AppData {
  const requester = findMember(data, requesterId) ?? fail("申請者が見つかりません")
  if (requester.status === "withdrawn") fail("退会済みのため申請できません")
  if (!input.reason.trim()) fail("申請理由を入力してください")
  const tool = findTool(data, input.toolId) ?? fail("ツールが見つかりません")
  if (!tool.enabled) fail("無効化されたツールには申請できません")
  const role = findToolRole(tool, input.roleKey) ?? fail("希望役割を選択してください")
  const dup = data.requests.some(
    (r) => r.requesterId === requesterId && r.toolId === input.toolId && r.roleKey === input.roleKey && r.type === input.type && r.status === "pending",
  )
  if (dup) fail("同じ内容の申請が既に申請中です")
  const ea = resolveEffectiveAccess(data, requesterId, input.toolId)
  if (ea.allowed && ea.appliedRole && ea.appliedRole.rank >= role.rank) fail(`既に「${ea.appliedRole.label}」以上で利用できます`)
  const candidates = getApproverCandidates(data, requesterId, input.toolId, input.roleKey)
  if (!candidates.some((c) => c.member.id === input.approverId)) fail("選択した申請先はこの申請を承認できません")
  if (input.approverId === requesterId) fail("自分自身を申請先にはできません")
  const d = clone(data)
  const id = newId("rq")
  d.requests.unshift({ id, requesterId, toolId: input.toolId, type: input.type, roleKey: input.roleKey, reason: input.reason.trim(), approverId: input.approverId, status: "pending", createdAt: nowIso() })
  notify(d, {
    recipientId: input.approverId,
    kind: "request_in",
    title: "新しい申請が届きました",
    body: `${requester.name} さんから ${tool.name} の${input.type === "access" ? "利用申請" : "役割変更申請"}（${role.label}）です。`,
    actorId: requesterId,
    reason: input.reason.trim(),
  })
  d.version += 1
  return d
}

export function cancelRequest(data: AppData, actorId: string, requestId: string): AppData {
  const req = data.requests.find((r) => r.id === requestId) ?? fail("申請が見つかりません")
  if (req.requesterId !== actorId) fail("申請者本人のみ取り消せます")
  if (req.status !== "pending") fail("申請中の案件のみ取り消せます")
  const d = clone(data)
  const r = d.requests.find((x) => x.id === requestId)!
  r.status = "cancelled"
  r.decidedAt = nowIso()
  d.version += 1
  return d
}

export function decideRequest(data: AppData, actorId: string, requestId: string, decision: "approve" | "reject", reason: string): AppData {
  const req = data.requests.find((r) => r.id === requestId) ?? fail("申請が見つかりません")
  if (req.status !== "pending") fail("この申請は既に処理されています")
  if (req.approverId !== actorId) fail("この申請の担当者ではありません")
  if (req.requesterId === actorId) fail("自分の申請は承認できません")
  if (decision === "reject" && !reason.trim()) fail("却下理由を入力してください")
  const tool = findTool(data, req.toolId)
  const requester = findMember(data, req.requesterId)
  const d = clone(data)
  const r = d.requests.find((x) => x.id === requestId)!

  if (decision === "reject") {
    r.status = "rejected"
    r.decidedAt = nowIso()
    r.decisionReason = reason.trim()
    audit(d, { actorId, source: "request", summary: `${memberName(d, req.requesterId)} の ${toolName(d, req.toolId)} 申請を却下`, memberIds: [req.requesterId], toolIds: [req.toolId], items: [], reason: reason.trim() })
    notify(d, { recipientId: req.requesterId, kind: "request_result", title: "申請が却下されました", body: `${toolName(d, req.toolId)} の申請は却下されました。`, actorId, reason: reason.trim() })
    d.version += 1
    return d
  }

  // 承認時は最新の操作権限・在籍状態を再確認する
  if (!requester || requester.status === "withdrawn") fail("申請者が退会済みのため承認できません")
  if (!tool || !tool.enabled) fail("ツールが無効化されているため承認できません")
  for (const action of ["toggle_access", "change_role"] as const) {
    const p = canManageTarget(data, actorId, req.requesterId, req.toolId, action)
    if (!p.ok) fail(`現在の管理範囲では承認できません：${p.reason}`)
  }
  const ar = canAssignToolRole(data, actorId, req.toolId, req.roleKey)
  if (!ar.ok) fail(ar.reason!)

  const before = describe(data, req.requesterId, req.toolId)
  d.grants.push({ id: newId("g"), memberId: req.requesterId, toolId: req.toolId, roleKey: req.roleKey, source: "request", grantedAt: nowIso(), retainedAfterTransfer: false })
  const cur = savedCell(d, req.requesterId, req.toolId)
  if (cur.access === "off" || cur.roleKey) {
    setOverride(d, req.requesterId, req.toolId, { access: cur.access === "off" ? "on" : cur.access, roleKey: cur.roleKey ? req.roleKey : null }, actorId)
  }
  const after = describe(d, req.requesterId, req.toolId)
  r.status = "approved"
  r.decidedAt = nowIso()
  r.decisionReason = reason.trim() || undefined
  const item: ChangeItem = { memberId: req.requesterId, toolId: req.toolId, label: toolName(d, req.toolId), before, after }
  audit(d, { actorId, source: "request", summary: `${memberName(d, req.requesterId)} の ${toolName(d, req.toolId)} 申請を承認`, memberIds: [req.requesterId], toolIds: [req.toolId], items: [{ ...item, label: `${memberName(d, req.requesterId)} / ${item.label}` }], reason: reason.trim() || undefined })
  notify(d, { recipientId: req.requesterId, kind: "request_result", title: "申請が承認されました", body: `${toolName(d, req.toolId)}：${after}`, items: [item], actorId, reason: reason.trim() || undefined })
  d.version += 1
  return d
}

/* ---------- ポータル同期 ---------- */

export interface SyncResult {
  added: string[]
  updated: string[]
  disabled: string[]
  autoGranted: number
}

export function syncFromPortal(data: AppData, opts: { fail: boolean }): { data: AppData; result: SyncResult } {
  const d = clone(data)
  const at = nowIso()
  const result: SyncResult = { added: [], updated: [], disabled: [], autoGranted: 0 }
  d.sync.lastAttemptAt = at
  if (opts.fail) {
    d.sync.lastStatus = "error"
    d.sync.message = "ポータルの応答がありませんでした（デモ）。既存のツール・権限は変更していません。"
    for (const t of d.tools) t.lastSyncFailed = true
    audit(d, { actorId: null, source: "sync", summary: "ポータル同期に失敗（既存データは保持）", memberIds: [], toolIds: [], items: [] })
    d.version += 1
    return { data: d, result }
  }
  for (const p of d.portalCatalog) {
    const existing = d.tools.find((t) => t.id === p.id)
    if (!existing) {
      d.tools.push(toolFromPortal(p, at))
      result.added.push(p.name)
      for (const ms of d.memberships) {
        if (findMember(d, ms.memberId)?.status === "withdrawn") continue
        const items = applyDepartmentRoleGrants(d, ms.memberId, ms.departmentId, "member").filter((i) => i.toolId === p.id)
        result.autoGranted += addGrantsFromPreview(d, items, at).length
      }
      for (const r of d.orgRoles) {
        if (r.kind !== "division_head") continue
        const items = applyDepartmentRoleGrants(d, r.memberId, r.departmentId!, "division_head").filter((i) => i.toolId === p.id)
        result.autoGranted += addGrantsFromPreview(d, items, at).length
      }
      continue
    }
    const next = toolFromPortal(p, at)
    const changed =
      existing.name !== next.name ||
      existing.description !== next.description ||
      existing.url !== next.url ||
      existing.enabled !== next.enabled ||
      existing.integration !== next.integration ||
      JSON.stringify(existing.roles) !== JSON.stringify(next.roles)
    if (existing.enabled && !next.enabled) result.disabled.push(p.name)
    else if (changed) result.updated.push(p.name)
    Object.assign(existing, next, { lastSyncFailed: false })
  }
  for (const t of d.tools) t.lastSyncFailed = false
  d.sync = { lastStatus: "success", lastAttemptAt: at, lastSuccessAt: at }
  const changedAny = result.added.length + result.updated.length + result.disabled.length > 0
  audit(d, {
    actorId: null,
    source: "sync",
    summary: changedAny
      ? `ポータルから同期：追加${result.added.length}件・更新${result.updated.length}件・無効化${result.disabled.length}件`
      : "ポータルからツール一覧を同期（変更なし）",
    memberIds: [],
    toolIds: [],
    items: [
      ...result.added.map((n) => ({ label: n, before: "—", after: "追加（テンプレートに従い自動付与）" })),
      ...result.updated.map((n) => ({ label: n, before: "—", after: "ポータルの内容で更新" })),
      ...result.disabled.map((n) => ({ label: n, before: "有効", after: "ポータル側で無効化（利用停止）" })),
    ],
  })
  d.version += 1
  return { data: d, result }
}

export function portalAddSample(data: AppData, sample: AppData["portalCatalog"][number]): AppData {
  const d = clone(data)
  if (!d.portalCatalog.some((p) => p.id === sample.id)) d.portalCatalog.push(structuredClone(sample))
  return d
}

export function portalToggleEnabled(data: AppData, toolId: string): AppData {
  const d = clone(data)
  const p = d.portalCatalog.find((x) => x.id === toolId)
  if (p) p.enabled = !p.enabled
  return d
}

/* ---------- 通知 ---------- */

export function markNotificationsRead(data: AppData, recipientId: string, ids: string[] | "all"): AppData {
  const d = clone(data)
  for (const n of d.notifications) {
    if (n.recipientId !== recipientId) continue
    if (ids === "all" || ids.includes(n.id)) n.read = true
  }
  return d
}

export { activeGrants, cellKey }

/* ---------- 部署 ---------- */

export interface DepartmentInput {
  id?: string
  name: string
  description: string
  /** 親の部署。null は最上位 */
  parentId?: string | null
}

export function saveDepartment(data: AppData, actorId: string, input: DepartmentInput): AppData {
  if (!hasFullAccess(data, actorId)) fail("部署を追加・編集できるのは代表のみです")
  const name = input.name.trim()
  if (!name) fail("部署名を入力してください")
  const parentId = input.parentId || null
  // 同じ親の中で名前が重ならないようにする（別の事業本部に同じ名前の部があるのはよい）
  if (data.departments.some((x) => x.name === name && (x.parentId || null) === parentId && x.id !== input.id)) fail("同じ階層に同じ名前の部署があります")
  if (parentId) {
    if (!findDepartment(data, parentId)) fail("親の部署が見つかりません")
    if (input.id && departmentDescendants(data, input.id).includes(parentId)) fail("自分自身や配下の部署を親にはできません")
  }
  const d = clone(data)
  const prev = input.id ? d.departments.find((x) => x.id === input.id) : undefined
  if (input.id && !prev) fail("部署が見つかりません")
  const parentName = (id: string | null | undefined) => (id ? deptName(d, id) : "最上位")
  if (prev) {
    if (prev.name === name && prev.description === input.description.trim() && (prev.parentId || null) === parentId) fail("変更はありません")
    const items: ChangeItem[] = []
    if (prev.name !== name) items.push({ label: "部署名", before: prev.name, after: name })
    if ((prev.parentId || null) !== parentId) items.push({ label: "親の部署", before: parentName(prev.parentId), after: parentName(parentId) })
    const before = prev.name
    const parentChanged = (prev.parentId || null) !== parentId
    prev.name = name
    prev.description = input.description.trim()
    prev.parentId = parentId
    // 親が変わったら、新しい上の部署のテンプレートを配下の人に足す（今の付与は消さない）
    let granted: Grant[] = []
    if (parentChanged) {
      const subtree = departmentDescendants(d, prev.id)
      granted = addGrantsFromPreview(d, [...subtreeGrantItems(d, subtree, "member"), ...subtreeGrantItems(d, subtree, "division_head")])
      if (granted.length) items.push({ label: "引き継いだテンプレートで追加付与", before: "—", after: `${granted.length}件` })
    }
    audit(d, { actorId, source: "member", summary: `部署「${before}」を更新`, memberIds: [...new Set(granted.map((g) => g.memberId))], toolIds: [...new Set(granted.map((g) => g.toolId))], items })
  } else {
    d.departments.push({ id: newId("d"), name, description: input.description.trim(), parentId })
    audit(d, { actorId, source: "member", summary: `部署「${name}」を追加`, memberIds: [], toolIds: [], items: [{ label: "部署", before: "—", after: parentId ? `${parentName(parentId)} / ${name}` : name }] })
  }
  d.version += 1
  return d
}

export function removeDepartment(data: AppData, actorId: string, departmentId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("部署を削除できるのは代表のみです")
  const dept = findDepartment(data, departmentId) ?? fail("部署が見つかりません")
  if (data.departments.some((x) => x.parentId === departmentId)) fail("配下に部署がある部署は削除できません。先に配下の部署を移すか削除してください")
  if (data.memberships.some((ms) => ms.departmentId === departmentId)) fail("所属メンバーがいる部署は削除できません。先にメンバーの所属を外してください")
  if (data.orgRoles.some((r) => r.departmentId === departmentId)) fail("事業部長がいる部署は削除できません。先に解除してください")
  const d = clone(data)
  d.departments = d.departments.filter((x) => x.id !== departmentId)
  d.templates = d.templates.filter((t) => t.departmentId !== departmentId)
  d.scopes = d.scopes.filter((s) => s.departmentId !== departmentId)
  d.routes = d.routes.filter((r) => r.departmentId !== departmentId)
  audit(d, { actorId, source: "member", summary: `部署「${dept.name}」を削除`, memberIds: [], toolIds: [], items: [{ label: "部署", before: dept.name, after: "削除" }] })
  d.version += 1
  return d
}

/* ---------- ツールの連携状態・内部役割 ---------- */

export interface ToolSettingsInput {
  integration: Tool["integration"]
  roles: Omit<ToolRole, "toolId">[]
  defaultRoleKey?: string
}

const ROLE_KEY_RE = /^[a-z0-9_-]{1,32}$/

/**
 * ツールの連携状態と内部役割の定義を保存する。
 * ポータルのツール情報には役割が無いので、役割はこの画面で定義する（ポータルから同期しても消えない）。
 * 付与済みの役割を定義から外すことはできない（付与・テンプレート・申請・手動指定が壊れるため）。
 */
export function saveToolSettings(data: AppData, actorId: string, toolId: string, input: ToolSettingsInput): AppData {
  if (!hasFullAccess(data, actorId)) fail("ツールの役割を定義できるのは代表のみです")
  const tool = findTool(data, toolId) ?? fail("ツールが見つかりません")
  const roles = input.roles.map((r, i) => ({ ...r, roleKey: r.roleKey.trim(), label: r.label.trim(), description: r.description.trim(), rank: i + 1 }))
  const keys = new Set<string>()
  for (const r of roles) {
    if (!ROLE_KEY_RE.test(r.roleKey)) fail(`役割キー「${r.roleKey}」は半角英小文字・数字・_・- の32文字以内にしてください`)
    if (keys.has(r.roleKey)) fail(`役割キー「${r.roleKey}」が重複しています`)
    keys.add(r.roleKey)
    if (!r.label) fail("役割の表示名を入力してください")
  }
  const used = new Set<string>([
    ...data.grants.filter((g) => g.toolId === toolId && !g.revoked).map((g) => g.roleKey),
    ...data.templates.filter((t) => t.toolId === toolId).map((t) => t.roleKey),
    ...data.overrides.filter((o) => o.toolId === toolId && o.roleKey).map((o) => o.roleKey as string),
    ...data.requests.filter((r) => r.toolId === toolId && r.status === "pending").map((r) => r.roleKey),
  ])
  for (const key of used) {
    if (!keys.has(key)) fail(`役割「${findToolRole(tool, key)?.label ?? key}」は付与・テンプレート・申請で使われているため削除できません`)
  }
  const defaultRoleKey = input.defaultRoleKey && keys.has(input.defaultRoleKey) ? input.defaultRoleKey : undefined
  const d = clone(data)
  const t = d.tools.find((x) => x.id === toolId)!
  const before = `${INTEGRATION_LABEL_TEXT[t.integration]}／${t.roles.map((r) => r.label).join("・") || "役割なし"}`
  t.integration = input.integration
  t.roles = roles.map((r) => ({ ...r, toolId }))
  t.defaultRoleKey = defaultRoleKey
  t.demoRoleDefinition = false
  const p = d.portalCatalog.find((x) => x.id === toolId)
  if (p) Object.assign(p, { integration: input.integration, roles, defaultRoleKey, demoRoleDefinition: false })
  const after = `${INTEGRATION_LABEL_TEXT[t.integration]}／${t.roles.map((r) => r.label).join("・") || "役割なし"}`
  if (before === after && tool.defaultRoleKey === defaultRoleKey && JSON.stringify(tool.roles) === JSON.stringify(t.roles)) fail("変更はありません")
  audit(d, { actorId, source: "sync", summary: `${tool.name} の連携状態・役割の定義を更新`, memberIds: [], toolIds: [toolId], items: [{ toolId, label: tool.name, before, after }] })
  d.version += 1
  return d
}

const INTEGRATION_LABEL_TEXT: Record<Tool["integration"], string> = { linked: "連携済み", unsupported: "連携未対応" }

/* ---------- ポータルのアカウントとの連動 ---------- */

export interface ImportMemberInput {
  name: string
  email: string
  active: boolean
}

/**
 * まだメンバーにいない人をまとめて追加する（所属は未設定）。
 * ポータルのアカウントからの取り込みと、一括追加（名前・メールの貼り付け）の両方で使う
 */
export function importMembers(
  data: AppData,
  actorId: string,
  list: ImportMemberInput[],
  opts: { source?: string } = {},
): { data: AppData; added: number } {
  const source = opts.source ?? "ポータルから取り込み"
  if (!hasFullAccess(data, actorId)) fail("メンバーを取り込めるのは代表のみです")
  const d = clone(data)
  const known = new Set(d.members.flatMap(memberEmails))
  const at = nowIso()
  const items: ChangeItem[] = []
  for (const u of list) {
    const email = u.email.trim().toLowerCase()
    if (!EMAIL_RE.test(email) || known.has(email)) continue
    known.add(email)
    const id = newId("m")
    const name = u.name.trim() || email
    d.members.push({ id, name, email, status: u.active ? "active" : "withdrawn", joinedAt: at })
    items.push({ memberId: id, label: "メンバー追加", before: "—", after: `${name}（${source}${u.active ? "" : "・ポータルで無効のため退会"}）` })
  }
  if (items.length === 0) fail("追加できる人はいません（すべて登録済みです）")
  audit(d, { actorId, source: "bulk", summary: `${items.length}人を追加（${source}）`, memberIds: items.map((i) => i.memberId!), toolIds: [], items })
  d.version += 1
  return { data: d, added: items.length }
}

/**
 * ログインした全権管理者がメンバーにいなければ追加する（初回の利用開始時）。
 * 追加しても所属は未設定。権限の判定上は data.operators で代表と同じ扱いになる。
 */
export function ensureOperatorMember(data: AppData, input: { name: string; email: string }): { data: AppData; memberId: string; created: boolean } {
  const email = input.email.trim().toLowerCase()
  const existing = findMemberByEmail(data, email)
  if (existing) return { data, memberId: existing.id, created: false }
  const d = clone(data)
  const id = newId("m")
  const name = input.name.trim() || email
  d.members.push({ id, name, email, status: "active", joinedAt: nowIso() })
  audit(d, { actorId: id, source: "member", summary: `${name} を追加（ポータルの全権管理者として初回ログイン）`, memberIds: [id], toolIds: [], items: [{ memberId: id, label: "メンバー追加", before: "—", after: name }] })
  d.version += 1
  return { data: d, memberId: id, created: true }
}

/* ---------- 代表の任命・解除、団体垢 ---------- */

/**
 * 代表を任命する。代表がいなければ新しく任命し、いれば任命した人へ移す（代表は1人）。
 * 本番では、ポータルの全権管理者（data.operators）が任命する。
 */
export function appointRepresentative(data: AppData, actorId: string, memberId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("代表を任命できるのは代表・全権管理者のみです")
  const m = findMember(data, memberId) ?? fail("メンバーが見つかりません")
  if (m.status !== "active") fail("在籍中のメンバーのみ任命できます")
  if (isOrgAccount(data, memberId)) fail("団体垢は代表にできません")
  const current = data.orgRoles.find((r) => r.kind === "representative")
  if (current?.memberId === memberId) fail(`${m.name} さんは既に代表です`)
  if (current) return transferOrganizationRole(data, actorId, current.id, memberId)
  const d = clone(data)
  d.orgRoles.push({ id: newId("or"), memberId, kind: "representative", assignedAt: nowIso() })
  audit(d, {
    actorId,
    source: "appointment",
    summary: `${m.name} を代表に任命`,
    memberIds: [memberId],
    toolIds: [],
    items: [{ memberId, label: "組織役割", before: "—", after: "代表" }],
  })
  notify(d, { recipientId: memberId, kind: "org", title: "代表に任命されました", body: "全メンバー・全ツールの権限を管理できるようになりました。", actorId })
  d.version += 1
  return d
}

export function dismissRepresentative(data: AppData, actorId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("代表を解除できるのは代表・全権管理者のみです")
  const role = data.orgRoles.find((r) => r.kind === "representative") ?? fail("代表は任命されていません")
  // デモ（全権管理者のいない状態）で解除すると、誰も代表を任命できなくなるため止める
  if (!(data.operators ?? []).length) fail("代表を解除すると全体を管理できる人がいなくなります。解除ではなく譲渡してください")
  const d = clone(data)
  d.orgRoles = d.orgRoles.filter((r) => r.id !== role.id)
  audit(d, {
    actorId,
    source: "appointment",
    summary: `${memberName(d, role.memberId)} の代表を解除`,
    memberIds: [role.memberId],
    toolIds: [],
    items: [{ memberId: role.memberId, label: "組織役割", before: "代表", after: "—" }],
  })
  notify(d, { recipientId: role.memberId, kind: "org", title: "代表が解除されました", body: "代表が解除されました。ツール権限はそのまま保持されています。", actorId })
  d.version += 1
  return d
}

/** 団体垢（団体・部署で共用するアカウント）にする／個人に戻す */
export function setOrgAccount(data: AppData, actorId: string, memberId: string, on: boolean): AppData {
  if (!hasFullAccess(data, actorId)) fail("団体垢を設定できるのは代表・全権管理者のみです")
  const m = findMember(data, memberId) ?? fail("メンバーが見つかりません")
  const current = data.orgRoles.find((r) => r.kind === "org_account" && r.memberId === memberId)
  if (on && current) fail(`${m.name} は既に団体垢です`)
  if (!on && !current) fail(`${m.name} は団体垢ではありません`)
  if (on && (isRepresentative(data, memberId) || isDivisionHead(data, memberId))) fail("代表・事業部長は団体垢にできません。先に譲渡・解除してください")
  if (on && data.requests.some((r) => r.approverId === memberId && r.status === "pending")) fail("承認待ちの申請の担当者になっているため、団体垢にできません")
  if (on && data.routes.some((r) => r.approverId === memberId || r.alternateId === memberId)) fail("申請先（承認者・代替承認者）に設定されているため、団体垢にできません。先に申請先を変更してください")
  const d = clone(data)
  if (on) d.orgRoles.push({ id: newId("or"), memberId, kind: "org_account", assignedAt: nowIso() })
  else d.orgRoles = d.orgRoles.filter((r) => r.id !== current!.id)
  audit(d, {
    actorId,
    source: "appointment",
    summary: on ? `${m.name} を団体垢に設定` : `${m.name} の団体垢を解除`,
    memberIds: [memberId],
    toolIds: [],
    items: [{ memberId, label: "アカウントの種類", before: on ? "個人" : "団体垢", after: on ? "団体垢" : "個人" }],
  })
  d.version += 1
  return d
}

/* ---------- 完全削除（複数人の承認のあと90日で削除） ---------- */

export const DELETION_DELAY_DAYS = 90
export const DEFAULT_DELETION_APPROVALS = 2
const DAY = 86400000

export const deletionApprovalsRequired = (data: AppData) => data.settings?.deletionApprovals ?? DEFAULT_DELETION_APPROVALS
const activeDeletion = (data: AppData, memberId: string) =>
  (data.deletions ?? []).find((x) => x.memberId === memberId && (x.status === "pending" || x.status === "scheduled"))

export function setDeletionApprovals(data: AppData, actorId: string, count: number): AppData {
  if (!hasFullAccess(data, actorId)) fail("承認の人数を変えられるのは代表・全権管理者のみです")
  if (!Number.isInteger(count) || count < 1 || count > 5) fail("承認の人数は1〜5人にしてください")
  if (count === deletionApprovalsRequired(data)) fail("変更はありません")
  const d = clone(data)
  const before = deletionApprovalsRequired(d)
  d.settings = { ...d.settings, deletionApprovals: count }
  audit(d, { actorId, source: "member", summary: `完全削除に必要な承認を${count}人に変更`, memberIds: [], toolIds: [], items: [{ label: "必要な承認", before: `${before}人`, after: `${count}人` }] })
  d.version += 1
  return d
}

/** 完全削除を申請する（退会済みのメンバーだけ） */
export function requestDeletion(data: AppData, actorId: string, memberId: string, reason: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("完全削除を申請できるのは代表・全権管理者のみです")
  const m = findMember(data, memberId) ?? fail("メンバーが見つかりません")
  if (m.status !== "withdrawn") fail("完全削除できるのは退会済みのメンバーだけです。先に退会にしてください")
  if (activeDeletion(data, memberId)) fail("このメンバーは既に完全削除の申請中です")
  if (!reason.trim()) fail("理由を入力してください")
  const d = clone(data)
  const req: DeletionRequest = { id: newId("del"), memberId, memberName: m.name, requestedBy: actorId, requestedAt: nowIso(), reason: reason.trim(), approvals: [], status: "pending" }
  d.deletions = [req, ...(d.deletions ?? [])]
  audit(d, { actorId, source: "member", summary: `${m.name} の完全削除を申請`, memberIds: [memberId], toolIds: [], items: [{ memberId, label: "完全削除", before: "—", after: `申請（承認 ${deletionApprovalsRequired(d)}人が必要）` }], reason: req.reason })
  for (const r of d.orgRoles.filter((x) => x.kind === "representative" && x.memberId !== actorId)) {
    notify(d, { recipientId: r.memberId, kind: "request_in", title: "完全削除の承認依頼", body: `${m.name} さんの完全削除が申請されました。「メンバー」で承認できます。`, actorId, reason: req.reason })
  }
  d.version += 1
  return d
}

/** 承認する。必要な人数がそろったら、90日後の削除を予約する */
export function approveDeletion(data: AppData, actorId: string, requestId: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("承認できるのは代表・全権管理者のみです")
  const req = (data.deletions ?? []).find((x) => x.id === requestId) ?? fail("申請が見つかりません")
  if (req.status !== "pending") fail("この申請は承認待ちではありません")
  if (req.requestedBy === actorId) fail("自分の申請は承認できません。ほかの代表・全権管理者に承認してもらってください")
  if (req.approvals.some((a) => a.by === actorId)) fail("既に承認しています")
  const d = clone(data)
  const r = d.deletions!.find((x) => x.id === requestId)!
  const at = nowIso()
  r.approvals.push({ by: actorId, at })
  const need = deletionApprovalsRequired(d)
  const done = r.approvals.length >= need
  if (done) {
    r.status = "scheduled"
    r.approvedAt = at
    r.executeAfter = new Date(Date.parse(at) + DELETION_DELAY_DAYS * DAY).toISOString()
  }
  audit(d, {
    actorId,
    source: "member",
    summary: done ? `${r.memberName} の完全削除を承認（${DELETION_DELAY_DAYS}日後に削除）` : `${r.memberName} の完全削除を承認（${r.approvals.length}/${need}人）`,
    memberIds: [r.memberId],
    toolIds: [],
    items: [{ memberId: r.memberId, label: "完全削除", before: `承認 ${r.approvals.length - 1}/${need}人`, after: done ? `${r.executeAfter!.slice(0, 10)} 以降に削除` : `承認 ${r.approvals.length}/${need}人` }],
  })
  if (done) notify(d, { recipientId: r.requestedBy, kind: "request_result", title: "完全削除の承認がそろいました", body: `${r.memberName} さんは ${DELETION_DELAY_DAYS}日後に完全削除されます（それまでは取り消せます）。`, actorId })
  d.version += 1
  return d
}

/** 申請・予約を取り消す（実行前ならいつでも） */
export function cancelDeletion(data: AppData, actorId: string, requestId: string, reason: string): AppData {
  if (!hasFullAccess(data, actorId)) fail("取り消せるのは代表・全権管理者のみです")
  const req = (data.deletions ?? []).find((x) => x.id === requestId) ?? fail("申請が見つかりません")
  if (req.status !== "pending" && req.status !== "scheduled") fail("この申請は取り消せません")
  const d = clone(data)
  cancelDeletionIn(d, req.id, actorId, reason.trim() || "取り消し")
  audit(d, { actorId, source: "member", summary: `${req.memberName} の完全削除を取り消し`, memberIds: [req.memberId], toolIds: [], items: [{ memberId: req.memberId, label: "完全削除", before: req.status === "scheduled" ? "削除予約" : "承認待ち", after: "取り消し" }], reason: reason.trim() || undefined })
  d.version += 1
  return d
}

function cancelDeletionIn(d: AppData, requestId: string, actorId: string | null, reason: string) {
  const r = (d.deletions ?? []).find((x) => x.id === requestId)
  if (!r) return
  r.status = "cancelled"
  r.cancelledBy = actorId ?? undefined
  r.cancelledAt = nowIso()
  r.cancelReason = reason
}

/** 期限が来た削除予約 */
export const dueDeletions = (data: AppData, now = Date.now()) =>
  (data.deletions ?? []).filter((x) => x.status === "scheduled" && x.executeAfter && Date.parse(x.executeAfter) <= now)

/**
 * 完全削除を実行する（期限が来た予約だけ）。
 * メンバー・所属・付与・手動設定・申請・通知などを消し、変更履歴の名前・メールは「削除済みメンバー」に置き換える。
 * ポータルのアカウントの削除は、呼び出し側（画面）が先に行う。
 */
export function executeDeletion(data: AppData, actorId: string | null, requestId: string, now = Date.now()): AppData {
  const req = (data.deletions ?? []).find((x) => x.id === requestId) ?? fail("申請が見つかりません")
  if (req.status !== "scheduled" || !req.executeAfter || Date.parse(req.executeAfter) > now) fail("まだ削除の期限ではありません")
  const m = findMember(data, req.memberId)
  const d = clone(data)
  const id = req.memberId
  const LABEL = "削除済みメンバー"
  if (m) {
    const secrets = [m.name, ...memberEmails(m)].filter((x) => x && x.length >= 2).sort((a, b) => b.length - a.length)
    const scrub = (text: string | undefined) => (text === undefined ? text : secrets.reduce((t, s) => t.split(s).join(LABEL), text))
    d.members = d.members.filter((x) => x.id !== id)
    d.memberships = d.memberships.filter((x) => x.memberId !== id)
    d.grants = d.grants.filter((x) => x.memberId !== id)
    d.overrides = d.overrides.filter((x) => x.memberId !== id)
    d.orgRoles = d.orgRoles.filter((x) => x.memberId !== id)
    d.scopes = d.scopes.filter((x) => x.grantedTo !== id)
    d.routes = d.routes.filter((x) => x.approverId !== id).map((x) => (x.alternateId === id ? { ...x, alternateId: null } : x))
    d.requests = d.requests.filter((x) => x.requesterId !== id && x.approverId !== id)
    d.notifications = d.notifications.filter((x) => x.recipientId !== id).map((n) => ({ ...n, body: scrub(n.body)!, items: n.items.map((i) => ({ ...i, label: scrub(i.label)!, before: scrub(i.before)!, after: scrub(i.after)! })) }))
    d.audit = d.audit.map((a) => ({
      ...a,
      summary: scrub(a.summary)!,
      reason: scrub(a.reason),
      memberIds: a.memberIds.filter((x) => x !== id),
      items: a.items.map((i) => ({ ...i, memberId: i.memberId === id ? undefined : i.memberId, label: scrub(i.label)!, before: scrub(i.before)!, after: scrub(i.after)! })),
    }))
    d.deletions = d.deletions!.map((x) => (x.memberId === id ? { ...x, memberName: LABEL, reason: scrub(x.reason)! } : x))
  }
  const r = d.deletions!.find((x) => x.id === requestId)!
  r.status = "executed"
  r.executedAt = new Date(now).toISOString()
  r.memberName = LABEL
  audit(d, { actorId, source: "member", summary: "メンバー1人を完全削除", memberIds: [], toolIds: [], items: [{ label: "完全削除", before: "削除予約", after: "削除済み（記録の名前・メールも置き換え）" }] })
  d.version += 1
  return d
}
