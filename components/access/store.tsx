"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { CommandError, commitChanges, dueDeletions, ensureOperatorMember, executeDeletion, simulateExternalChange } from "@/lib/access/commands"
import {
  ACCESS_NOT_CONFIGURED,
  AccessApiError,
  deletePortalAccounts,
  LIVE_MODE,
  liveRepository,
  loadLive,
  readPortalSession,
  syncPortalAccounts,
  type LiveMe,
  type PortalRolesByEmail,
} from "@/lib/access/live"
import { DEMO_USER_IDS, createEmptyData } from "@/lib/access/mock-data"
import { demoOperatorIds } from "@/lib/access/portal-demo"
import { localRepository, writeExternal, type AccessRepository } from "@/lib/access/repository"
import { actorLevel, cellKey, findMember, memberEmails, parseCellKey, savedCell, sameCell, type ActorLevel } from "@/lib/access/rules"
import type { AppData, Draft, DraftCell, Member } from "@/lib/access/types"

export type ViewKey =
  | "matrix"
  | "members"
  | "departments"
  | "management"
  | "requests"
  | "portalRoles"
  | "tools"
  | "history"
  | "me"
  | "notifications"

export const VIEW_ACCESS: Record<ViewKey, ActorLevel[]> = {
  matrix: ["representative", "division_head"],
  members: ["representative", "division_head"],
  departments: ["representative", "division_head"],
  management: ["representative", "division_head"],
  requests: ["representative", "division_head"],
  portalRoles: ["representative"],
  tools: ["representative", "division_head"],
  history: ["representative", "division_head"],
  me: ["representative", "division_head", "member"],
  notifications: ["representative", "division_head", "member"],
}

export interface DemoFlags {
  failNextSave: boolean
  conflictNextSave: boolean
  failNextSync: boolean
  emptyMatrix: boolean
}

type SaveOutcome = "ok" | "conflict" | "error" | "nochange"

interface PendingGuard {
  label: string
  proceed: () => void
}

/** 本番で、画面を開けないときの状態 */
export type GateState =
  | { kind: "signedOut" }
  | { kind: "forbidden"; message: string }
  | { kind: "error"; message: string }

interface StoreValue {
  /** 本番（ポータルのログイン・GAS に保存）なら true。false はブラウザ内のデモ */
  live: boolean
  /** 本番でログインしている人（ポータルのアカウント） */
  me: LiveMe | null
  /** 本番のポータルのセッション（ポータルの API を呼ぶときに使う） */
  portalToken: string
  data: AppData
  actor: Member
  level: ActorLevel
  view: ViewKey
  setView: (v: ViewKey) => void
  switchActor: (id: string) => void
  draft: Draft
  draftCount: number
  bulkKeys: Set<string>
  getCell: (memberId: string, toolId: string) => DraftCell
  isDirty: (memberId: string, toolId: string) => boolean
  setCell: (memberId: string, toolId: string, cell: DraftCell, via?: "manual" | "bulk") => void
  discardDraft: () => void
  saveDraft: (reason: string) => Promise<SaveOutcome>
  saving: boolean
  conflict: AppData | null
  resolveConflict: () => void
  dismissConflict: () => void
  lastSaveError: string | null
  /**
   * 独立した状態変更コマンドを実行・保存する。
   * portalRoles を渡すと、保存のあとでポータルのアカウントのロールも変える（本番。キーはメンバーの主なメール）
   */
  run: (label: string, fn: (data: AppData) => AppData, success?: string, opts?: { portalRoles?: PortalRolesByEmail }) => Promise<boolean>
  /** 権限管理のデータは変えず、ポータルのアカウントのロールだけ変える（本番） */
  syncPortalRoles: (portalRoles: PortalRolesByEmail) => Promise<void>
  /** 未保存の下書きがあれば「保存／破棄／戻る」を確認してから実行する */
  guard: (label: string, proceed: () => void) => void
  pendingGuard: PendingGuard | null
  resolveGuard: (choice: "save" | "discard" | "back") => Promise<void>
  flags: DemoFlags
  setFlags: (f: Partial<DemoFlags>) => void
  simulateLoading: () => void
  resetDemo: () => Promise<void>
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within AccessStoreProvider")
  return ctx
}

const VIEW_KEYS = Object.keys(VIEW_ACCESS) as ViewKey[]

/** ポータルのアカウントを書き換えたときに出すイベント（ポータルのアカウント一覧を読み直す） */
export const PORTAL_UPDATED_EVENT = "access:portal-updated"
const ACTOR_KEY = "fsif-access-manager:actor"

export function AccessStoreProvider({ children, fallback, gate }: { children: ReactNode; fallback: ReactNode; gate: (g: GateState) => ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actorId, setActorId] = useState<string>(DEMO_USER_IDS.representative)
  const [view, setViewState] = useState<ViewKey>("matrix")
  const [draft, setDraft] = useState<Draft>({})
  const [bulkKeys, setBulkKeys] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState<AppData | null>(null)
  const [lastSaveError, setLastSaveError] = useState<string | null>(null)
  const [pendingGuard, setPendingGuard] = useState<PendingGuard | null>(null)
  const [flags, setFlagsState] = useState<DemoFlags>({ failNextSave: false, conflictNextSave: false, failNextSync: false, emptyMatrix: false })
  const busy = useRef(false)
  const [gateState, setGateState] = useState<GateState | null>(null)
  const [me, setMe] = useState<LiveMe | null>(null)
  const [portalToken, setPortalToken] = useState("")
  const repoRef = useRef<AccessRepository>(localRepository)

  useEffect(() => {
    let alive = true
    const hash = window.location.hash.replace("#", "") as ViewKey
    if (ACCESS_NOT_CONFIGURED) {
      setGateState({ kind: "error", message: "アクセス権限管理の保存先（GitHub の Variables の ACCESS_GAS_URL）が設定されていません。管理者に連絡してください。" })
      setLoading(false)
      return
    }
    if (!LIVE_MODE) {
      localRepository.load().then((d) => {
        if (!alive) return
        // デモ：ポータルのロールが「全権管理者」の人は、本番と同じく代表と同じ操作ができる
        setData({ ...d, operators: demoOperatorIds(d) })
        const storedActor = window.localStorage.getItem(ACTOR_KEY)
        if (storedActor && d.members.some((m) => m.id === storedActor)) setActorId(storedActor)
        if (VIEW_KEYS.includes(hash)) setViewState(hash)
        setLoading(false)
      })
      return () => {
        alive = false
      }
    }
    // 本番：ポータルのセッションで GAS から読み込む。ログインした全権管理者を「代表と同じ」操作者にする
    const token = readPortalSession()
    if (!token) {
      setGateState({ kind: "signedOut" })
      setLoading(false)
      return
    }
    ;(async () => {
      try {
        const r = await loadLive(token)
        if (!alive) return
        const base = r.data ?? createEmptyData()
        const ensured = ensureOperatorMember(base, r.me)
        const repo = liveRepository(token, [ensured.memberId])
        let loaded: AppData = { ...ensured.data, operators: [ensured.memberId] }
        if (ensured.created) {
          const saved = await repo.save(loaded, base.version)
          if (!saved.ok) throw new Error(saved.reason === "conflict" ? "他の人が同時に更新しました。再読み込みしてください" : saved.message)
          loaded = saved.data
        }
        // 期限が来た完全削除を実行する（ポータルのアカウントを消してから、権限管理のデータから消す）
        for (const del of dueDeletions(loaded)) {
          const m = loaded.members.find((x) => x.id === del.memberId)
          const emails = m ? memberEmails(m) : []
          const portal = await deletePortalAccounts(token, emails, r.me.email.toLowerCase())
          if (!portal.ok) {
            toast.warning(`${del.memberName} さんの完全削除を実行できませんでした（次に開いたときにもう一度試します）`, { description: portal.warnings.join(" ／ "), duration: 15000 })
            continue
          }
          const saved = await repo.save(executeDeletion(loaded, ensured.memberId, del.id), loaded.version)
          if (!saved.ok) break
          loaded = saved.data
          toast.success(`期限が来たため、${del.memberName} さんを完全削除しました`)
        }
        if (!alive) return
        repoRef.current = repo
        setMe(r.me)
        setPortalToken(token)
        setActorId(ensured.memberId)
        setData(loaded)
        if (VIEW_KEYS.includes(hash)) setViewState(hash)
      } catch (e) {
        if (!alive) return
        if (e instanceof AccessApiError && e.code === "UNAUTHORIZED") setGateState({ kind: "signedOut" })
        else if (e instanceof AccessApiError && e.code === "FORBIDDEN") setGateState({ kind: "forbidden", message: e.message })
        else setGateState({ kind: "error", message: e instanceof Error ? e.message : "読み込みに失敗しました" })
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // デモ：ポータルのロールを変えたら、全権管理者（代表と同じ操作ができる人）を数え直す
  useEffect(() => {
    if (LIVE_MODE) return
    const handler = () => setData((d) => (d ? { ...d, operators: demoOperatorIds(d) } : d))
    window.addEventListener(PORTAL_UPDATED_EVENT, handler)
    return () => window.removeEventListener(PORTAL_UPDATED_EVENT, handler)
  }, [])

  /** 本番：メンバーの追加・退会などをポータルのアカウントに反映する（保存のあとに裏で行う） */
  const afterSave = useCallback(
    async (before: AppData, after: AppData, portalRoles?: PortalRolesByEmail) => {
      if (!LIVE_MODE || !me) return
      const r = await syncPortalAccounts(portalToken, before, after, me.email.toLowerCase(), portalRoles)
      const done = [
        r.added.length && `${r.added.length}件のアカウントを作成`,
        r.activated.length && `${r.activated.length}件を有効化`,
        r.deactivated.length && `${r.deactivated.length}件を無効化`,
        r.updated.length && `${r.updated.length}件の名前・ロールを変更`,
      ].filter(Boolean)
      if (done.length) toast.success(`ポータル：${done.join("・")}しました`)
      if (r.warnings.length) toast.warning(`ポータルのアカウントに反映できなかったものがあります`, { description: r.warnings.join(" ／ "), duration: 15000 })
      // ポータルのアカウント一覧を表示している画面に読み直してもらう
      window.dispatchEvent(new Event(PORTAL_UPDATED_EVENT))
    },
    [me, portalToken],
  )

  const draftCount = useMemo(() => {
    if (!data) return 0
    return Object.keys(draft).filter((k) => {
      const { memberId, toolId } = parseCellKey(k)
      return !sameCell(draft[k], savedCell(data, memberId, toolId))
    }).length
  }, [draft, data])

  useEffect(() => {
    if (draftCount === 0) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [draftCount])

  const level: ActorLevel = data ? actorLevel(data, actorId) : "member"

  // 役割が変わった（譲渡など）ときは表示中の画面の権限も再評価する
  useEffect(() => {
    if (!data) return
    if (!VIEW_ACCESS[view].includes(level)) {
      setViewState("me")
      window.history.replaceState(null, "", "#me")
    }
  }, [level, view, data])

  const guard = useCallback(
    (label: string, proceed: () => void) => {
      if (draftCount > 0) setPendingGuard({ label, proceed })
      else proceed()
    },
    [draftCount],
  )

  const setView = useCallback(
    (v: ViewKey) => {
      if (v === view) return
      const go = () => {
        setViewState(v)
        window.history.replaceState(null, "", `#${v}`)
      }
      // 下書きは権限一覧の画面状態。他画面へ移る際は確認する
      if (view === "matrix") guard("画面を移動", go)
      else go()
    },
    [view, guard],
  )

  const discardDraft = useCallback(() => {
    setDraft({})
    setBulkKeys(new Set())
    setLastSaveError(null)
  }, [])

  const switchActor = useCallback(
    (id: string) => {
      guard("デモユーザーを切替", () => {
        discardDraft()
        setActorId(id)
        window.localStorage.setItem(ACTOR_KEY, id)
      })
    },
    [guard, discardDraft],
  )

  const getCell = useCallback(
    (memberId: string, toolId: string): DraftCell => draft[cellKey(memberId, toolId)] ?? (data ? savedCell(data, memberId, toolId) : { access: null, roleKey: null }),
    [draft, data],
  )

  const isDirty = useCallback(
    (memberId: string, toolId: string) => {
      const k = cellKey(memberId, toolId)
      return !!data && !!draft[k] && !sameCell(draft[k], savedCell(data, memberId, toolId))
    },
    [draft, data],
  )

  const setCell = useCallback(
    (memberId: string, toolId: string, cell: DraftCell, via: "manual" | "bulk" = "manual") => {
      if (!data) return
      const k = cellKey(memberId, toolId)
      const saved = savedCell(data, memberId, toolId)
      setDraft((prev) => {
        const next = { ...prev }
        if (sameCell(cell, saved)) delete next[k]
        else next[k] = cell
        return next
      })
      setBulkKeys((prev) => {
        const next = new Set(prev)
        if (via === "bulk") next.add(k)
        else next.delete(k)
        return next
      })
    },
    [data],
  )

  const saveDraft = useCallback(
    async (reason: string): Promise<SaveOutcome> => {
      if (!data || busy.current) return "error"
      if (draftCount === 0) return "nochange"
      let next: AppData
      try {
        next = commitChanges(data, draft, { actorId, reason, bulkKeys })
      } catch (e) {
        const msg = e instanceof CommandError ? e.message : "保存に失敗しました"
        setLastSaveError(msg)
        toast.error(msg)
        return "error"
      }
      busy.current = true
      setSaving(true)
      setLastSaveError(null)
      try {
        if (!LIVE_MODE && flags.conflictNextSave) {
          writeExternal(simulateExternalChange(data))
          setFlagsState((f) => ({ ...f, conflictNextSave: false }))
        }
        const result = await repoRef.current.save(next, data.version, { fail: !LIVE_MODE && flags.failNextSave })
        if (flags.failNextSave) setFlagsState((f) => ({ ...f, failNextSave: false }))
        if (result.ok) {
          setData(result.data)
          void afterSave(data, result.data)
          setDraft({})
          setBulkKeys(new Set())
          toast.success(`${draftCount}件の変更を保存しました`)
          return "ok"
        }
        if (result.reason === "conflict") {
          setConflict(result.latest)
          return "conflict"
        }
        setLastSaveError(result.message)
        toast.error("保存に失敗しました。下書きは保持されています。")
        return "error"
      } finally {
        busy.current = false
        setSaving(false)
      }
    },
    [data, draft, draftCount, actorId, bulkKeys, flags, afterSave],
  )

  const resolveConflict = useCallback(() => {
    if (!conflict) return
    const latest = conflict
    setData(latest)
    setDraft((prev) => {
      const next: Draft = {}
      for (const [k, cell] of Object.entries(prev)) {
        const { memberId, toolId } = parseCellKey(k)
        if (!sameCell(cell, savedCell(latest, memberId, toolId))) next[k] = cell
      }
      return next
    })
    setConflict(null)
    toast.info("最新のデータを再取得しました。差分を確認して再度保存してください。")
  }, [conflict])

  const run = useCallback(
    async (label: string, fn: (d: AppData) => AppData, success?: string, opts?: { portalRoles?: PortalRolesByEmail }) => {
      if (!data || busy.current) return false
      let next: AppData
      try {
        next = fn(data)
      } catch (e) {
        toast.error(e instanceof CommandError ? e.message : `${label}に失敗しました`)
        return false
      }
      busy.current = true
      try {
        const result = await repoRef.current.save(next, data.version)
        if (!result.ok) {
          if (result.reason === "conflict") {
            setConflict(result.latest)
          } else toast.error(`${label}に失敗しました`)
          return false
        }
        setData(result.data)
        void afterSave(data, result.data, opts?.portalRoles)
        if (success) toast.success(success)
        return true
      } finally {
        busy.current = false
      }
    },
    [data, afterSave],
  )

  const syncPortalRoles = useCallback(
    async (portalRoles: PortalRolesByEmail) => {
      if (data) await afterSave(data, data, portalRoles)
    },
    [data, afterSave],
  )

  const resolveGuard = useCallback(
    async (choice: "save" | "discard" | "back") => {
      const g = pendingGuard
      if (!g) return
      if (choice === "back") {
        setPendingGuard(null)
        return
      }
      if (choice === "discard") {
        discardDraft()
        setPendingGuard(null)
        g.proceed()
        return
      }
      const outcome = await saveDraft("")
      setPendingGuard(null)
      if (outcome === "ok") g.proceed()
    },
    [pendingGuard, discardDraft, saveDraft],
  )

  const setFlags = useCallback((f: Partial<DemoFlags>) => setFlagsState((prev) => ({ ...prev, ...f })), [])

  const simulateLoading = useCallback(() => {
    setLoading(true)
    setTimeout(() => setLoading(false), 1600)
  }, [])

  const resetDemo = useCallback(async () => {
    const seed = await localRepository.reset()
    setData(seed)
    setDraft({})
    setBulkKeys(new Set())
    setConflict(null)
    setLastSaveError(null)
    setActorId(DEMO_USER_IDS.representative)
    window.localStorage.setItem(ACTOR_KEY, DEMO_USER_IDS.representative)
    setViewState("matrix")
    window.history.replaceState(null, "", "#matrix")
    setFlagsState({ failNextSave: false, conflictNextSave: false, failNextSync: false, emptyMatrix: false })
    toast.success("デモデータを初期化しました")
  }, [])

  if (loading) return <>{fallback}</>
  if (gateState) return <>{gate(gateState)}</>
  if (!data) return <>{fallback}</>
  const actor = findMember(data, actorId) ?? data.members[0]

  const value: StoreValue = {
    live: LIVE_MODE,
    me,
    portalToken,
    data,
    actor,
    level,
    view,
    setView,
    switchActor,
    draft,
    draftCount,
    bulkKeys,
    getCell,
    isDirty,
    setCell,
    discardDraft,
    saveDraft,
    saving,
    conflict,
    resolveConflict,
    dismissConflict: () => setConflict(null),
    lastSaveError,
    run,
    syncPortalRoles,
    guard,
    pendingGuard,
    resolveGuard,
    flags,
    setFlags,
    simulateLoading,
    resetDemo,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
