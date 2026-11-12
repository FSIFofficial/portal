import { INITIAL_PORTAL_CATALOG, toolFromPortal } from "./portal"
import { applyDepartmentRoleGrants } from "./rules"
import type {
  AppData,
  Department,
  DepartmentRoleTemplate,
  Grant,
  Member,
  Membership,
  OrganizationRole,
} from "./types"

export const DEMO_USER_IDS = {
  representative: "m01",
  divisionHead: "m02",
  member: "m05",
} as const

const departments: Department[] = [
  { id: "d-community", name: "コミュニティ事業本部", description: "会員コミュニティの企画・運営" },
  { id: "d-event", name: "イベント事業本部", description: "イベントの企画・運営" },
  { id: "d-think", name: "シンクタンク事業本部", description: "調査・政策提言" },
  { id: "d-planning", name: "経営企画事業本部", description: "経営計画・管理部門" },
  { id: "d-pr", name: "広報部", description: "対外広報・SNS運用" },
]

const members: Member[] = [
  { id: "m01", name: "星野 葵", email: "aoi.hoshino@example.com", status: "active", joinedAt: "2022-04-01T00:00:00Z" },
  { id: "m02", name: "天野 湊", email: "minato.amano@example.com", status: "active", joinedAt: "2022-04-01T00:00:00Z" },
  { id: "m03", name: "宮坂 理沙", email: "risa.miyasaka@example.com", status: "active", joinedAt: "2022-10-01T00:00:00Z" },
  { id: "m04", name: "北条 透", email: "toru.hojo@example.com", status: "active", joinedAt: "2023-04-01T00:00:00Z" },
  { id: "m05", name: "森下 花音", email: "kanon.morishita@example.com", status: "active", joinedAt: "2024-04-01T00:00:00Z" },
  { id: "m06", name: "一ノ瀬 蒼", email: "ao.ichinose@example.com", status: "active", joinedAt: "2024-04-01T00:00:00Z" },
  { id: "m07", name: "佐伯 陽菜", email: "hina.saeki@example.com", status: "active", joinedAt: "2024-10-01T00:00:00Z" },
  { id: "m08", name: "高村 樹", email: "itsuki.takamura@example.com", status: "active", joinedAt: "2023-10-01T00:00:00Z" },
  { id: "m09", name: "藤原 美月", email: "mizuki.fujiwara@example.com", status: "active", joinedAt: "2025-04-01T00:00:00Z" },
  { id: "m10", name: "小野寺 健", email: "ken.onodera@example.com", status: "suspended", joinedAt: "2023-04-01T00:00:00Z" },
  { id: "m11", name: "水谷 遥", email: "haruka.mizutani@example.com", status: "withdrawn", joinedAt: "2023-04-01T00:00:00Z" },
  { id: "m12", name: "桐生 朔", email: "saku.kiryu@example.com", status: "active", joinedAt: "2026-11-01T00:00:00Z" },
]

const memberships: Membership[] = [
  { memberId: "m01", departmentId: "d-planning", since: "2022-04-01T00:00:00Z" },
  { memberId: "m02", departmentId: "d-community", since: "2022-04-01T00:00:00Z" },
  { memberId: "m03", departmentId: "d-event", since: "2022-10-01T00:00:00Z" },
  { memberId: "m04", departmentId: "d-think", since: "2023-04-01T00:00:00Z" },
  { memberId: "m05", departmentId: "d-community", since: "2024-04-01T00:00:00Z" },
  { memberId: "m06", departmentId: "d-community", since: "2024-04-01T00:00:00Z" },
  { memberId: "m06", departmentId: "d-event", since: "2025-04-01T00:00:00Z" },
  { memberId: "m07", departmentId: "d-event", since: "2024-10-01T00:00:00Z" },
  { memberId: "m08", departmentId: "d-think", since: "2026-04-01T00:00:00Z" },
  { memberId: "m09", departmentId: "d-pr", since: "2025-04-01T00:00:00Z" },
  { memberId: "m10", departmentId: "d-planning", since: "2023-04-01T00:00:00Z" },
  { memberId: "m11", departmentId: "d-event", since: "2023-04-01T00:00:00Z" },
]

const orgRoles: OrganizationRole[] = [
  { id: "or-rep", memberId: "m01", kind: "representative", assignedAt: "2024-06-01T00:00:00Z" },
  { id: "or-community", memberId: "m02", kind: "division_head", departmentId: "d-community", assignedAt: "2024-06-01T00:00:00Z" },
  { id: "or-event", memberId: "m03", kind: "division_head", departmentId: "d-event", assignedAt: "2024-06-01T00:00:00Z" },
  { id: "or-think", memberId: "m04", kind: "division_head", departmentId: "d-think", assignedAt: "2025-04-01T00:00:00Z" },
]

const t = (departmentId: string, position: "member" | "division_head", toolId: string, roleKey: string): DepartmentRoleTemplate => ({
  departmentId,
  position,
  toolId,
  roleKey,
})

const templates: DepartmentRoleTemplate[] = [
  t("d-community", "member", "portal-ohsumi", "editor"),
  t("d-community", "member", "portal-kodama", "viewer"),
  t("d-community", "division_head", "portal-ohsumi", "editor"),
  t("d-community", "division_head", "portal-kodama", "editor"),
  t("d-community", "division_head", "portal-kpi", "viewer"),
  t("d-event", "member", "portal-event-page", "editor"),
  t("d-event", "member", "portal-event-db", "editor"),
  t("d-event", "member", "portal-kodama", "viewer"),
  t("d-event", "division_head", "portal-kpi", "viewer"),
  t("d-event", "division_head", "portal-quiz", "editor"),
  t("d-think", "member", "portal-quiz", "editor"),
  t("d-think", "member", "portal-kpi", "viewer"),
  t("d-think", "division_head", "portal-kpi", "editor"),
  t("d-planning", "member", "portal-kpi", "viewer"),
  t("d-planning", "division_head", "portal-kpi", "editor"),
  t("d-pr", "member", "portal-pr", "level1"),
  t("d-pr", "member", "portal-kodama", "editor"),
  t("d-pr", "member", "portal-sns-scheduler", "viewer"),
]

export function createSeedData(): AppData {
  const syncedAt = "2026-11-12T00:30:00Z"
  const base: AppData = {
    version: 1,
    members,
    departments,
    memberships,
    orgRoles,
    scopes: [
      {
        id: "sc-01",
        grantedTo: "m04",
        departmentId: "d-pr",
        toolIds: ["portal-pr"],
        actions: ["toggle_access", "change_role"],
        grantedBy: "m01",
        grantedAt: "2026-09-01T01:00:00Z",
      },
    ],
    tools: INITIAL_PORTAL_CATALOG.map((p) => toolFromPortal(p, syncedAt)),
    templates,
    grants: [],
    overrides: [],
    requests: [],
    routes: [
      { id: "rt-01", departmentId: "d-community", toolId: null, roleKey: null, approverId: "m02", alternateId: "m01" },
      { id: "rt-02", departmentId: "d-pr", toolId: "portal-pr", roleKey: null, approverId: "m04", alternateId: "m01" },
    ],
    transfers: [],
    audit: [],
    notifications: [],
    portalCatalog: INITIAL_PORTAL_CATALOG.map((p) => ({ ...p, roles: [...p.roles] })),
    sync: { lastStatus: "success", lastAttemptAt: syncedAt, lastSuccessAt: syncedAt },
  }

  const grants: Grant[] = []
  let n = 0
  const push = (g: Omit<Grant, "id">) => grants.push({ id: `g-${(n++).toString().padStart(3, "0")}`, ...g })

  for (const ms of memberships) {
    for (const item of applyDepartmentRoleGrants({ ...base, grants }, ms.memberId, ms.departmentId, "member")) {
      push({
        memberId: item.memberId,
        toolId: item.toolId,
        roleKey: item.roleKey,
        source: "department",
        departmentId: item.departmentId,
        position: "member",
        grantedAt: ms.since,
        retainedAfterTransfer: false,
      })
    }
  }
  for (const r of orgRoles) {
    if (r.kind !== "division_head" || !r.departmentId) continue
    for (const item of applyDepartmentRoleGrants({ ...base, grants }, r.memberId, r.departmentId, "division_head")) {
      push({
        memberId: item.memberId,
        toolId: item.toolId,
        roleKey: item.roleKey,
        source: "position",
        departmentId: item.departmentId,
        position: "division_head",
        grantedAt: r.assignedAt,
        retainedAfterTransfer: false,
      })
    }
  }

  // 高村 樹：イベント事業本部からシンクタンク事業本部へ異動。旧所属の権限を保持
  push({ memberId: "m08", toolId: "portal-event-page", roleKey: "editor", source: "department", departmentId: "d-event", position: "member", grantedAt: "2023-10-01T00:00:00Z", retainedAfterTransfer: true })
  push({ memberId: "m08", toolId: "portal-event-db", roleKey: "editor", source: "department", departmentId: "d-event", position: "member", grantedAt: "2023-10-01T00:00:00Z", retainedAfterTransfer: true })
  // 藤原 美月：申請承認により広報管理レベル2（所属のレベル1より上位が適用）
  push({ memberId: "m09", toolId: "portal-pr", roleKey: "level2", source: "request", grantedAt: "2026-10-20T02:10:00Z", retainedAfterTransfer: false })

  return {
    ...base,
    grants,
    overrides: [
      // 佐伯 陽菜：所属で自動ONだが、手動OFFが優先
      { memberId: "m07", toolId: "portal-event-page", access: "off", roleKey: null, updatedBy: "m03", updatedAt: "2026-10-05T05:00:00Z" },
      // 代表：KPI Dashboard のみ手動で管理者（代表でも自動で全ツール管理者にはならない）
      { memberId: "m01", toolId: "portal-kpi", access: "on", roleKey: "admin", updatedBy: "m01", updatedAt: "2026-06-01T00:00:00Z" },
    ],
    requests: [
      { id: "rq-01", requesterId: "m05", toolId: "portal-kodama", type: "role_change", roleKey: "editor", reason: "会員向けお知らせの原稿作成を担当するため", approverId: "m02", status: "pending", createdAt: "2026-11-10T01:20:00Z" },
      { id: "rq-02", requesterId: "m09", toolId: "portal-pr", type: "role_change", roleKey: "level2", reason: "公開予約の運用を担当するため", approverId: "m04", status: "approved", createdAt: "2026-10-19T08:00:00Z", decidedAt: "2026-10-20T02:10:00Z", decisionReason: "担当業務に必要なため承認" },
      { id: "rq-03", requesterId: "m06", toolId: "portal-quiz", type: "access", roleKey: "editor", reason: "イベント内クイズの作問補助", approverId: "m03", status: "rejected", createdAt: "2026-10-28T03:00:00Z", decidedAt: "2026-10-29T00:30:00Z", decisionReason: "作問はシンクタンク事業本部で対応するため、現時点では不要" },
      { id: "rq-04", requesterId: "m12", toolId: "portal-ohsumi", type: "access", roleKey: "viewer", reason: "入会後の研修でコミュニティ内容を確認するため", approverId: "m01", status: "pending", createdAt: "2026-11-11T06:40:00Z" },
    ],
    audit: [
      { id: "a-01", at: "2026-10-05T05:00:00Z", actorId: "m03", source: "manual", summary: "佐伯 陽菜 の イベント特設ページ作成 を手動OFF", memberIds: ["m07"], toolIds: ["portal-event-page"], items: [{ memberId: "m07", toolId: "portal-event-page", label: "イベント特設ページ作成", before: "利用可（編集者）", after: "利用不可（手動OFF）" }], reason: "担当イベント変更のため" },
      { id: "a-02", at: "2026-04-01T00:00:00Z", actorId: "m01", source: "member", summary: "高村 樹 の所属をイベント事業本部からシンクタンク事業本部へ変更", memberIds: ["m08"], toolIds: ["portal-quiz", "portal-kpi"], items: [{ memberId: "m08", label: "所属", before: "イベント事業本部", after: "シンクタンク事業本部" }, { memberId: "m08", toolId: "portal-quiz", label: "Quiz Manager", before: "利用不可（付与なし）", after: "利用可（編集者）" }], reason: "4月の組織異動" },
      { id: "a-03", at: "2026-09-01T01:00:00Z", actorId: "m01", source: "appointment", summary: "北条 透 に広報部・広報管理の管理範囲を追加", memberIds: ["m04"], toolIds: ["portal-pr"], items: [{ memberId: "m04", label: "管理範囲", before: "なし", after: "広報部／広報管理（利用ON/OFF・役割変更）" }] },
      { id: "a-04", at: "2026-10-20T02:10:00Z", actorId: "m04", source: "request", summary: "藤原 美月 の 広報管理 役割変更申請を承認", memberIds: ["m09"], toolIds: ["portal-pr"], items: [{ memberId: "m09", toolId: "portal-pr", label: "広報管理", before: "利用可（レベル1）", after: "利用可（レベル2）" }], reason: "担当業務に必要なため承認" },
      { id: "a-05", at: "2026-10-29T00:30:00Z", actorId: "m03", source: "request", summary: "一ノ瀬 蒼 の Quiz Manager 利用申請を却下", memberIds: ["m06"], toolIds: ["portal-quiz"], items: [], reason: "作問はシンクタンク事業本部で対応するため、現時点では不要" },
      { id: "a-06", at: "2026-10-31T09:00:00Z", actorId: "m01", source: "member", summary: "水谷 遥 を退会に変更（全ツール利用不可）", memberIds: ["m11"], toolIds: [], items: [{ memberId: "m11", label: "在籍状態", before: "在籍", after: "退会" }] },
      { id: "a-07", at: "2026-11-12T00:30:00Z", actorId: null, source: "sync", summary: "ポータルからツール一覧を同期（変更なし）", memberIds: [], toolIds: [], items: [] },
    ],
    notifications: [
      { id: "n-01", recipientId: "m02", kind: "request_in", title: "新しい申請が届きました", body: "森下 花音 さんから kodama の役割変更（編集者）の申請です。", items: [], actorId: "m05", createdAt: "2026-11-10T01:20:00Z", read: false },
      { id: "n-02", recipientId: "m01", kind: "request_in", title: "新しい申請が届きました", body: "桐生 朔 さんから Ohsumi の利用申請（閲覧者）です。申請先がないため代表へ回付されました。", items: [], actorId: "m12", createdAt: "2026-11-11T06:40:00Z", read: false },
      { id: "n-03", recipientId: "m09", kind: "request_result", title: "申請が承認されました", body: "広報管理 の役割変更（レベル2）が承認されました。", items: [{ memberId: "m09", toolId: "portal-pr", label: "広報管理", before: "利用可（レベル1）", after: "利用可（レベル2）" }], actorId: "m04", reason: "担当業務に必要なため承認", createdAt: "2026-10-20T02:10:00Z", read: true },
      { id: "n-04", recipientId: "m06", kind: "request_result", title: "申請が却下されました", body: "Quiz Manager の利用申請は却下されました。", items: [], actorId: "m03", reason: "作問はシンクタンク事業本部で対応するため、現時点では不要", createdAt: "2026-10-29T00:30:00Z", read: false },
      { id: "n-05", recipientId: "m07", kind: "access", title: "ツール権限が変更されました", body: "イベント特設ページ作成 が利用不可になりました。", items: [{ memberId: "m07", toolId: "portal-event-page", label: "イベント特設ページ作成", before: "利用可（編集者）", after: "利用不可（手動OFF）" }], actorId: "m03", reason: "担当イベント変更のため", createdAt: "2026-10-05T05:00:00Z", read: true },
      { id: "n-06", recipientId: "m04", kind: "scope", title: "管理範囲が追加されました", body: "広報部／広報管理 の利用ON/OFF・役割変更を管理できるようになりました。", items: [], actorId: "m01", createdAt: "2026-09-01T01:00:00Z", read: true },
      { id: "n-07", recipientId: "m05", kind: "request_in", title: "申請を送信しました", body: "kodama の役割変更（編集者）を 天野 湊 さんへ申請しました。", items: [], actorId: "m05", createdAt: "2026-11-10T01:20:00Z", read: true },
    ],
  }
}

/** 本番の初回（GAS にまだデータが無いとき）の空のデータ */
export function createEmptyData(): AppData {
  return {
    version: 0,
    members: [],
    departments: [],
    memberships: [],
    orgRoles: [],
    scopes: [],
    tools: [],
    templates: [],
    grants: [],
    overrides: [],
    requests: [],
    routes: [],
    transfers: [],
    audit: [],
    notifications: [],
    portalCatalog: [],
    sync: { lastStatus: "never", lastAttemptAt: null, lastSuccessAt: null },
  }
}
