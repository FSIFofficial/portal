// デモ用の「ポータルのアカウント」（このブラウザにだけ保存。ポータルのデモとは別）
import { createDemoDb } from "@/lib/demo-data"
import type { Role } from "@/lib/types"
import type { AppData } from "./types"

export const PORTAL_DEMO_KEY = "fsif-access-manager:portal-demo"

export interface DemoPortal {
  roles: Role[]
  /** 主なメール（小文字） → ロール */
  users: Record<string, { roles: string[]; lastLoginAt: string }>
}

export function readDemoPortal(): DemoPortal {
  try {
    const raw = window.localStorage.getItem(PORTAL_DEMO_KEY)
    if (raw) return JSON.parse(raw) as DemoPortal
  } catch {
    // 読めなければ初期状態
  }
  return { roles: createDemoDb().roles, users: {} }
}

export function writeDemoPortal(d: DemoPortal) {
  try {
    window.localStorage.setItem(PORTAL_DEMO_KEY, JSON.stringify(d))
  } catch {
    // 保存できなくても画面上は動かす
  }
}

/** デモでのメンバーのロール（保存したもの。無ければ代表は全権管理者、ほかはメンバー） */
export function demoRolesOf(data: AppData, portal: DemoPortal, memberId: string, email: string): string[] {
  const saved = portal.users[email.toLowerCase()]?.roles
  if (saved) return saved
  return data.orgRoles.some((r) => r.kind === "representative" && r.memberId === memberId) ? ["superadmin"] : ["member"]
}

/** デモで「全権管理者」のロールを持つ在籍中のメンバー（本番と同じく、代表と同じ操作ができる） */
export function demoOperatorIds(data: AppData): string[] {
  const portal = readDemoPortal()
  return data.members.filter((m) => m.status === "active" && demoRolesOf(data, portal, m.id, m.email).includes("superadmin")).map((m) => m.id)
}
