"use client"

import { useMemo, useState } from "react"
import { Check, Layers, Lock, Minus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  findDepartment,
  getCellLock,
  memberDepartmentIds,
  orgRoleLabels,
  resolveEffectiveAccess,
  toolStatus,
  departmentDescendants,
  departmentTree,
} from "@/lib/access/rules"
import type { EmploymentStatus } from "@/lib/access/types"
import { cn } from "@/lib/utils"
import { EmptyState, IntegrationBadge, NativeSelect, PageHeader, StatusBadge } from "../shared"
import { useStore } from "../store"
import { CellDetailSheet } from "./matrix/cell-detail-sheet"
import { BulkDialog, SaveDialog } from "./matrix/matrix-dialogs"

type AccessFilter = "all" | "allowed" | "denied"

function AccessCell({ memberId, toolId, onOpen, compact }: { memberId: string; toolId: string; onOpen: () => void; compact?: boolean }) {
  const { data, actor, getCell, isDirty } = useStore()
  const ea = resolveEffectiveAccess(data, memberId, toolId, getCell(memberId, toolId))
  const lock = getCellLock(data, actor.id, memberId, toolId)
  const dirty = isDirty(memberId, toolId)
  const manual = ea.manual.access !== null || ea.manual.roleKey !== null
  const label = ea.allowed ? (ea.appliedRole?.label ?? "利用可") : "利用不可"

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}${dirty ? "（未保存）" : ""}${manual ? "（手動）" : ""}${lock ? `（変更不可：${lock.reason}）` : ""}。詳細を開く`}
      className={cn(
        "group relative flex w-full items-center gap-1.5 rounded-md px-2 text-left text-xs transition-colors",
        compact ? "h-10" : "h-9",
        ea.allowed ? "bg-primary-soft text-accent-foreground hover:bg-primary-soft/70" : "text-muted-foreground hover:bg-secondary",
        dirty && "ring-2 ring-primary ring-inset",
      )}
    >
      {ea.allowed ? <Check className="size-3.5 shrink-0" aria-hidden /> : <Minus className="size-3.5 shrink-0" aria-hidden />}
      <span className={cn("min-w-0 flex-1 truncate", ea.allowed && "font-medium")}>{label}</span>
      {manual && <span className="shrink-0 rounded-sm bg-card px-1 text-[10px] font-medium text-foreground ring-1 ring-border">手動</span>}
      {lock && <Lock className="size-3 shrink-0 opacity-60" aria-hidden />}
    </button>
  )
}

export function MatrixView() {
  const { data, actor, draftCount, discardDraft, flags, saving, isDirty } = useStore()
  const [query, setQuery] = useState("")
  const [dept, setDept] = useState("all")
  const [status, setStatus] = useState<EmploymentStatus | "all">("all")
  const [toolFilter, setToolFilter] = useState("all")
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all")
  const [onlyDirty, setOnlyDirty] = useState(false)
  const [openCell, setOpenCell] = useState<{ memberId: string; toolId: string } | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)

  const tools = useMemo(() => data.tools.filter((t) => toolFilter === "all" || t.id === toolFilter), [data.tools, toolFilter])

  const members = useMemo(() => {
    if (flags.emptyMatrix) return []
    const q = query.trim().toLowerCase()
    return data.members.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false
      if (status !== "all" && m.status !== status) return false
      const depts = memberDepartmentIds(data, m.id)
      // 上の部署を選ぶと、配下の部署のメンバーも出す
      if (dept === "none" ? depts.length > 0 : dept !== "all" && !depts.some((d) => departmentDescendants(data, dept).includes(d))) return false
      if (accessFilter !== "all" || onlyDirty) {
        const hit = tools.some((t) => {
          if (onlyDirty && !isDirty(m.id, t.id)) return false
          if (accessFilter === "all") return true
          const allowed = resolveEffectiveAccess(data, m.id, t.id).allowed
          return accessFilter === "allowed" ? allowed : !allowed
        })
        if (!hit) return false
      }
      return true
    })
  }, [data, query, status, dept, accessFilter, onlyDirty, tools, isDirty, flags.emptyMatrix])

  const filtersActive = query || dept !== "all" || status !== "all" || toolFilter !== "all" || accessFilter !== "all" || onlyDirty
  const clearFilters = () => {
    setQuery("")
    setDept("all")
    setStatus("all")
    setToolFilter("all")
    setAccessFilter("all")
    setOnlyDirty(false)
  }

  const deptNames = (id: string) =>
    memberDepartmentIds(data, id)
      .map((d) => findDepartment(data, d)?.name ?? d)
      .join("・") || "所属未設定"

  return (
    <div className="flex flex-col gap-4 pb-20">
      <PageHeader
        title="権限一覧"
        description="メンバー × ツールの利用可否と内部役割。セルを押すと付与元と手動設定を確認できます。変更は保存するまで確定しません。"
        actions={
          <Button variant="outline" size="lg" onClick={() => setBulkOpen(true)} disabled={members.length === 0 || tools.length === 0}>
            <Layers className="size-4" />
            表示中を一括操作
          </Button>
        }
      />

      <div className="flex flex-col gap-2 rounded-lg border bg-card p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="relative col-span-2 md:col-span-3 xl:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="氏名・メールで検索"
              aria-label="氏名・メールで検索"
              className="h-9 pl-8"
            />
          </div>
          <NativeSelect aria-label="所属" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">すべての所属</option>
            {departmentTree(data).map(({ dept: d, depth }) => (
              <option key={d.id} value={d.id}>
                {"　".repeat(depth)}
                {d.name}
              </option>
            ))}
            <option value="none">所属未設定</option>
          </NativeSelect>
          <NativeSelect aria-label="在籍状態" value={status} onChange={(e) => setStatus(e.target.value as EmploymentStatus | "all")}>
            <option value="all">すべての在籍状態</option>
            <option value="active">在籍</option>
            <option value="suspended">休止</option>
            <option value="withdrawn">退会</option>
          </NativeSelect>
          <NativeSelect aria-label="ツール" value={toolFilter} onChange={(e) => setToolFilter(e.target.value)}>
            <option value="all">すべてのツール</option>
            {data.tools.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="利用状態" value={accessFilter} onChange={(e) => setAccessFilter(e.target.value as AccessFilter)}>
            <option value="all">利用可・不可すべて</option>
            <option value="allowed">利用可を含む</option>
            <option value="denied">利用不可を含む</option>
          </NativeSelect>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={onlyDirty} onChange={(e) => setOnlyDirty(e.target.checked)} />
            未保存の変更があるメンバーのみ
          </label>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {members.length}人 × {tools.length}ツール
            </span>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3.5" />
                絞り込みを解除
              </Button>
            )}
          </div>
        </div>
      </div>

      {members.length === 0 || tools.length === 0 ? (
        <div className="rounded-lg border bg-card">
          {flags.emptyMatrix ? (
            <EmptyState title="表示できるメンバーがいません" description="メンバーが登録されると、ここに権限一覧が表示されます。（デモ：データなし表示）" />
          ) : (
            <EmptyState
              title="条件に一致するメンバーがいません"
              description="検索語や絞り込み条件を変更してください。"
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  絞り込みを解除
                </Button>
              }
            />
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-auto rounded-lg border bg-card md:block md:max-h-[calc(100dvh-20rem)]">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">メンバーごとのツール権限一覧</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky top-0 left-0 z-20 w-60 min-w-60 border-r border-b bg-secondary px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    メンバー
                  </th>
                  {tools.map((t) => (
                    <th key={t.id} scope="col" className="sticky top-0 z-10 w-40 min-w-40 border-b bg-secondary px-2 py-2 text-left align-bottom">
                      <div className="flex flex-col gap-1">
                        <span className={cn("text-xs font-bold", !t.enabled && "text-muted-foreground line-through")}>{t.name}</span>
                        <IntegrationBadge status={toolStatus(t)} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className={cn(m.status === "withdrawn" && "opacity-60")}>
                    <th scope="row" className="sticky left-0 z-10 border-r border-b bg-card px-3 py-1.5 text-left font-normal">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{m.name}</span>
                          {m.id === actor.id && <span className="text-[10px] text-primary">（あなた）</span>}
                          {m.status !== "active" && <StatusBadge status={m.status} />}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {orgRoleLabels(data, m.id).filter((l) => l !== "メンバー").join("・")}
                          {orgRoleLabels(data, m.id)[0] !== "メンバー" && " ／ "}
                          {deptNames(m.id)}
                        </span>
                      </div>
                    </th>
                    {tools.map((t) => (
                      <td key={t.id} className="border-b p-1">
                        <AccessCell memberId={m.id} toolId={t.id} onOpen={() => setOpenCell({ memberId: m.id, toolId: t.id })} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {members.map((m) => (
              <li key={m.id} className={cn("flex flex-col gap-2 rounded-lg border bg-card p-3", m.status === "withdrawn" && "opacity-70")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-bold">
                      {m.name}
                      {m.id === actor.id && <span className="text-xs font-normal text-primary">（あなた）</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{deptNames(m.id)}</span>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <ul className="flex flex-col gap-1">
                  {tools.map((t) => (
                    <li key={t.id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] items-center gap-2">
                      <span className={cn("truncate text-xs", !t.enabled && "text-muted-foreground line-through")}>{t.name}</span>
                      <AccessCell compact memberId={m.id} toolId={t.id} onOpen={() => setOpenCell({ memberId: m.id, toolId: t.id })} />
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {draftCount > 0 && (
        <div
          role="region"
          aria-label="未保存の変更"
          className="fixed inset-x-3 bottom-3 z-40 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 shadow-lg md:left-auto md:w-auto md:min-w-[28rem]"
        >
          <p className="text-sm">
            <span className="font-bold">{draftCount}件</span>の未保存の変更
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="lg" onClick={discardDraft} disabled={saving}>
              破棄
            </Button>
            <Button size="lg" onClick={() => setSaveOpen(true)} disabled={saving}>
              差分を確認して保存
            </Button>
          </div>
        </div>
      )}

      <CellDetailSheet cell={openCell} onClose={() => setOpenCell(null)} />
      {bulkOpen && (
        <BulkDialog open={bulkOpen} onOpenChange={setBulkOpen} memberIds={members.map((m) => m.id)} toolIds={tools.map((t) => t.id)} />
      )}
      <SaveDialog open={saveOpen} onOpenChange={setSaveOpen} />
    </div>
  )
}
