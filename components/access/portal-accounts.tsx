"use client"

// ポータルのアカウントとロール（ポータルの管理画面から Access Manager に移したもの）。
// 正本はこれまでどおりポータルの GAS（ログインの判定・公開範囲の出し分けはポータルが行う）。
// - 本番：ポータルの API（adminData / saveRole / deleteRole）を、ログイン中の全権管理者のセッションで呼ぶ。
//   アカウントの作成・ロールの変更は、保存のあとに store の syncPortalAccounts がまとめて行う
// - デモ：このブラウザにだけ保存する（ポータルのデモとは別）

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ApiError, api } from "@/lib/api"
import { createDemoDb } from "@/lib/demo-data"
import { memberEmails } from "@/lib/access/rules"
import type { Member } from "@/lib/access/types"
import type { Role, User } from "@/lib/types"
import { PORTAL_UPDATED_EVENT, useStore } from "./store"

const DEMO_KEY = "fsif-access-manager:portal-demo"

interface DemoPortal {
  roles: Role[]
  /** メール → ロール */
  users: Record<string, { roles: string[]; lastLoginAt: string }>
}

function readDemo(): DemoPortal {
  try {
    const raw = window.localStorage.getItem(DEMO_KEY)
    if (raw) return JSON.parse(raw) as DemoPortal
  } catch {
    // 読めなければ初期状態
  }
  return { roles: createDemoDb().roles, users: {} }
}

function writeDemo(d: DemoPortal) {
  try {
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(d))
  } catch {
    // 保存できなくても画面上は動かす
  }
}

interface PortalAccountsValue {
  ready: boolean
  error: string
  roles: Role[]
  /** 新しいアカウントに付けるロール（ポータルの「自動登録のロール」。無ければ member） */
  defaultRoles: string[]
  /** メンバーの主なメールのアカウント（無ければ undefined） */
  accountOf: (m: Member) => User | undefined
  reload: () => Promise<void>
  saveRole: (role: Role, isNew: boolean) => Promise<boolean>
  deleteRole: (id: string) => Promise<boolean>
  /** デモ用：アカウントのロールをこのブラウザに保存する（本番は store の run / syncPortalRoles で行う） */
  setDemoRoles: (email: string, roles: string[]) => void
}

const Ctx = createContext<PortalAccountsValue | null>(null)

export function usePortalAccounts() {
  const v = useContext(Ctx)
  if (!v) throw new Error("usePortalAccounts は PortalAccountsProvider の内側で使ってください")
  return v
}

const message = (e: unknown) => (e instanceof ApiError ? e.message : e instanceof Error ? e.message : "ポータルとの通信に失敗しました")

export function PortalAccountsProvider({ children }: { children: ReactNode }) {
  const { live, portalToken, data } = useStore()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [defaultRoles, setDefaultRoles] = useState<string[]>(["member"])
  const [demo, setDemo] = useState<DemoPortal | null>(null)

  const reload = useCallback(async () => {
    if (!live) {
      const d = readDemo()
      setDemo(d)
      setRoles(d.roles)
      setReady(true)
      return
    }
    try {
      const admin = await api.adminData(portalToken)
      setRoles(admin.roles)
      setUsers(admin.users ?? [])
      const def = admin.settings?.defaultRoles ?? []
      setDefaultRoles(def.length ? def : admin.roles.some((r) => r.id === "member") ? ["member"] : [])
      setError("")
    } catch (e) {
      setError(`ポータルのアカウントを読み込めませんでした：${message(e)}`)
    } finally {
      setReady(true)
    }
  }, [live, portalToken])

  useEffect(() => {
    void reload()
    const handler = () => void reload()
    window.addEventListener(PORTAL_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PORTAL_UPDATED_EVENT, handler)
  }, [reload])

  // デモ：アカウントの一覧はメンバーから作る（ロールは保存したもの。無ければ member、代表は全権管理者）
  const demoUsers = useMemo<User[]>(() => {
    if (live || !demo) return []
    const repIds = new Set(data.orgRoles.filter((r) => r.kind === "representative").map((r) => r.memberId))
    return data.members.flatMap((m) =>
      memberEmails(m).map((email) => ({
        email,
        name: m.name,
        roles: demo.users[m.email.toLowerCase()]?.roles ?? (repIds.has(m.id) ? ["superadmin"] : ["member"]),
        active: m.status !== "withdrawn",
        note: "",
        createdAt: m.joinedAt,
        updatedAt: m.joinedAt,
        lastLoginAt: demo.users[m.email.toLowerCase()]?.lastLoginAt ?? "",
      })),
    )
  }, [live, demo, data.members, data.orgRoles])

  const byEmail = useMemo(() => new Map((live ? users : demoUsers).map((u) => [u.email.toLowerCase(), u])), [live, users, demoUsers])
  const accountOf = useCallback((m: Member) => byEmail.get(m.email.toLowerCase()), [byEmail])

  const saveRole = useCallback(
    async (role: Role, isNew: boolean) => {
      if (!live) {
        const d = readDemo()
        if (isNew && d.roles.some((r) => r.id === role.id)) {
          toast.error("同じIDのロールがあります")
          return false
        }
        d.roles = isNew ? [...d.roles, role] : d.roles.map((r) => (r.id === role.id ? role : r))
        writeDemo(d)
        await reload()
        toast.success(isNew ? "ロールを作成しました" : "ロールを更新しました")
        return true
      }
      try {
        await api.saveRole(portalToken, role, isNew)
        await reload()
        toast.success(isNew ? "ロールを作成しました" : "ロールを更新しました")
        return true
      } catch (e) {
        toast.error(message(e))
        return false
      }
    },
    [live, portalToken, reload],
  )

  const deleteRole = useCallback(
    async (id: string) => {
      if (!live) {
        const d = readDemo()
        d.roles = d.roles.filter((r) => r.id !== id)
        for (const u of Object.values(d.users)) u.roles = u.roles.filter((r) => r !== id)
        writeDemo(d)
        await reload()
        toast.success("ロールを削除しました")
        return true
      }
      try {
        await api.deleteRole(portalToken, id)
        await reload()
        toast.success("ロールを削除しました")
        return true
      } catch (e) {
        toast.error(message(e))
        return false
      }
    },
    [live, portalToken, reload],
  )

  const setDemoRoles = useCallback(
    (email: string, next: string[]) => {
      const d = readDemo()
      const key = email.trim().toLowerCase()
      d.users[key] = { roles: next, lastLoginAt: d.users[key]?.lastLoginAt ?? "" }
      writeDemo(d)
      void reload()
    },
    [reload],
  )

  const value: PortalAccountsValue = { ready, error, roles, defaultRoles, accountOf, reload, saveRole, deleteRole, setDemoRoles }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
