import type { PortalTool, Tool, ToolRole } from "./types"

const standardRoles = (adminDescription = "設定・メンバー管理を含むすべての操作"): Omit<ToolRole, "toolId">[] => [
  { roleKey: "viewer", label: "閲覧者", rank: 1, description: "内容の閲覧のみ", assignableBy: "division_head" },
  { roleKey: "editor", label: "編集者", rank: 2, description: "コンテンツの作成・編集", assignableBy: "division_head" },
  { roleKey: "admin", label: "管理者", rank: 3, description: adminDescription, assignableBy: "representative" },
]

/** モックのFSIFポータル（ツール一覧の正本の代わり） */
export const INITIAL_PORTAL_CATALOG: PortalTool[] = [
  {
    id: "portal-ohsumi",
    name: "Ohsumi",
    description: "会員コミュニティの運営基盤",
    url: "https://ohsumi.example.com",
    enabled: true,
    integration: "linked",
    roles: standardRoles(),
    defaultRoleKey: "viewer",
  },
  {
    id: "portal-kodama",
    name: "kodama",
    description: "会員向けのお知らせ配信",
    url: "https://kodama.example.com",
    enabled: true,
    integration: "linked",
    roles: standardRoles(),
    defaultRoleKey: "viewer",
  },
  {
    id: "portal-quiz",
    name: "Quiz Manager",
    description: "クイズ企画の作問・出題管理",
    url: "https://quiz.example.com",
    enabled: true,
    integration: "linked",
    roles: standardRoles(),
    defaultRoleKey: "viewer",
  },
  {
    id: "portal-kpi",
    name: "KPI Dashboard",
    description: "事業KPIの集計・閲覧",
    url: "https://kpi.example.com",
    enabled: true,
    integration: "linked",
    roles: standardRoles("指標定義・閲覧範囲の設定"),
    defaultRoleKey: "viewer",
  },
  {
    id: "portal-event-page",
    name: "イベント特設ページ作成",
    description: "イベント告知ページの作成・公開",
    url: "https://event-page.example.com",
    enabled: true,
    integration: "linked",
    roles: standardRoles("公開設定・テンプレート管理"),
    defaultRoleKey: "editor",
  },
  {
    id: "portal-ohsumi-contract",
    name: "Ohsumi契約管理",
    description: "Ohsumi利用契約の管理",
    url: "https://ohsumi-contract.example.com",
    enabled: true,
    integration: "linked",
    roles: [],
  },
  {
    id: "portal-event-db",
    name: "イベントDB登録",
    description: "開催イベントの記録登録",
    url: "https://event-db.example.com",
    enabled: true,
    integration: "unsupported",
    roles: standardRoles(),
  },
  {
    id: "portal-pr",
    name: "広報管理",
    description: "プレスリリース・SNS原稿の管理",
    url: "https://admin.fsif.jp/kouhou/",
    enabled: true,
    integration: "linked",
    // 役割キーは広報管理の GAS が読み替える（lib/kouhou/domain/commands.ts の ACCESS_ROLES と同じにする）
    roles: [
      { roleKey: "level1", label: "レベル①", rank: 1, description: "原稿の作成。内容は承認が必要", assignableBy: "division_head" },
      { roleKey: "level2", label: "レベル②", rank: 2, description: "定期投稿の内容は自動承認", assignableBy: "division_head" },
      { roleKey: "level3", label: "レベル③", rank: 3, description: "内容は自動承認。承認者になれる", assignableBy: "division_head" },
      { roleKey: "admin", label: "管理者", rank: 4, description: "レベル③＋管理者設定（アカウント接続・権限・緊急停止）", assignableBy: "representative" },
    ],
    defaultRoleKey: "level1",
  },
]

/** デモ操作「ポータルにサンプルツールを追加」で追加されるツール */
export const SAMPLE_PORTAL_TOOL: PortalTool = {
  id: "portal-sns-scheduler",
  name: "SNS投稿予約",
  description: "公式SNSアカウントへの投稿予約（サンプル）",
  url: "https://sns.example.com",
  enabled: true,
  integration: "linked",
  roles: standardRoles(),
  defaultRoleKey: "viewer",
}

export function toolFromPortal(p: PortalTool, syncedAt: string): Tool {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    url: p.url,
    enabled: p.enabled,
    integration: p.integration,
    roles: p.roles.map((r) => ({ ...r, toolId: p.id })),
    defaultRoleKey: p.defaultRoleKey,
    demoRoleDefinition: p.demoRoleDefinition,
    lastSyncedAt: syncedAt,
  }
}
