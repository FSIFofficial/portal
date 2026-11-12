"use client"

import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { formatDate } from "@/lib/access/format"
import {
  canAssignToolRole,
  canManageTarget,
  describeAccess,
  findMember,
  findTool,
  getCellLock,
  resolveEffectiveAccess,
  savedCell,
  sameCell,
} from "@/lib/access/rules"
import type { ManualAccess } from "@/lib/access/types"
import { cn } from "@/lib/utils"
import { Callout, Field, IntegrationBadge, NativeSelect, Tag } from "../../shared"
import { useStore } from "../../store"
import { toolStatus } from "@/lib/access/rules"

const SOURCE_TONE = { department: "default", position: "primary", request: "primary", manual: "outline", retained: "outline" } as const

export function CellDetailSheet({ cell, onClose }: { cell: { memberId: string; toolId: string } | null; onClose: () => void }) {
  const { data, actor, getCell, setCell, isDirty } = useStore()
  const member = cell ? findMember(data, cell.memberId) : undefined
  const tool = cell ? findTool(data, cell.toolId) : undefined

  return (
    <Sheet open={!!cell} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
        {cell && member && tool && (
          <CellDetailBody
            key={`${cell.memberId}-${cell.toolId}`}
            memberId={cell.memberId}
            toolId={cell.toolId}
            actorId={actor.id}
            getCell={getCell}
            setCell={setCell}
            dirty={isDirty(cell.memberId, cell.toolId)}
            onClose={onClose}
          />
        )}
        {cell && (!member || !tool) && <p className="p-4 text-sm">データが見つかりません</p>}
      </SheetContent>
    </Sheet>
  )
}

function CellDetailBody({
  memberId,
  toolId,
  actorId,
  getCell,
  setCell,
  dirty,
  onClose,
}: {
  memberId: string
  toolId: string
  actorId: string
  getCell: ReturnType<typeof useStore>["getCell"]
  setCell: ReturnType<typeof useStore>["setCell"]
  dirty: boolean
  onClose: () => void
}) {
  const { data } = useStore()
  const member = findMember(data, memberId)!
  const tool = findTool(data, toolId)!
  const current = getCell(memberId, toolId)
  const saved = savedCell(data, memberId, toolId)
  const draftEa = resolveEffectiveAccess(data, memberId, toolId, current)
  const savedEa = resolveEffectiveAccess(data, memberId, toolId)
  const lock = getCellLock(data, actorId, memberId, toolId)
  const roleChangeAllowed = canManageTarget(data, actorId, memberId, toolId, "change_role")

  const setAccess = (access: ManualAccess) => setCell(memberId, toolId, { ...current, access })
  const setRole = (roleKey: string | null) => setCell(memberId, toolId, { ...current, roleKey })

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {member.name}
          <span className="text-muted-foreground">/</span>
          {tool.name}
        </SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-1.5">
          <IntegrationBadge status={toolStatus(tool)} />
          <span>{tool.description}</span>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1 rounded-lg bg-secondary p-3">
            <span className="text-xs text-muted-foreground">保存済み</span>
            <span className="text-sm font-bold">{describeAccess(savedEa)}</span>
          </div>
          <div className={cn("flex flex-col gap-1 rounded-lg p-3", dirty ? "bg-primary-soft" : "bg-secondary")}>
            <span className="text-xs text-muted-foreground">{dirty ? "変更後（未保存）" : "現在の適用"}</span>
            <span className="text-sm font-bold">{describeAccess(draftEa)}</span>
          </div>
        </div>

        {draftEa.manualRoleSuperseded && (
          <Callout tone="neutral">
            手動指定の役割より上位の役割が他の付与元にあるため、上位の「{draftEa.heldRole?.label}」が適用されます。
          </Callout>
        )}
        {draftEa.manual.access === "off" && draftEa.autoAllowed && (
          <Callout tone="neutral">所属・役職などで自動付与されていますが、手動OFFが優先されるため利用できません。</Callout>
        )}

        <section className="flex flex-col gap-2" aria-labelledby="sources-heading">
          <h3 id="sources-heading" className="text-sm font-bold">
            付与元
          </h3>
          {draftEa.sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">付与元はありません</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {draftEa.sources.map((s, i) => (
                <li key={i} className="flex items-start gap-2 rounded-lg border p-2.5">
                  <Tag tone={SOURCE_TONE[s.kind]}>{s.label}</Tag>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm">{s.detail}</span>
                    <span className="text-xs text-muted-foreground">
                      役割：{s.role?.label ?? "—"}
                      {s.grantedAt && ` ／ ${formatDate(s.grantedAt)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="edit-heading">
          <h3 id="edit-heading" className="text-sm font-bold">
            手動設定
          </h3>
          {lock ? (
            <div className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="leading-relaxed">{lock.reason}</span>
            </div>
          ) : (
            <>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="pb-1.5 text-sm font-medium">利用可否</legend>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary p-1" role="radiogroup">
                  {(
                    [
                      [null, "自動"],
                      ["on", "手動ON"],
                      ["off", "手動OFF"],
                    ] as const
                  ).map(([v, label]) => (
                    <button
                      key={label}
                      type="button"
                      role="radio"
                      aria-checked={current.access === v}
                      onClick={() => setAccess(v)}
                      className={cn(
                        "h-9 rounded-md text-sm font-medium transition-colors",
                        current.access === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  「自動」は所属・役職・申請による付与に従います。手動ON/OFFは自動付与より優先されます。
                </p>
              </fieldset>
              <Field
                label="内部役割の手動指定"
                htmlFor="role-select"
                hint={!roleChangeAllowed.ok ? roleChangeAllowed.reason : "より上位の付与元がある場合は上位の役割が適用されます"}
              >
                <NativeSelect
                  id="role-select"
                  value={current.roleKey ?? ""}
                  disabled={!roleChangeAllowed.ok}
                  onChange={(e) => setRole(e.target.value || null)}
                >
                  <option value="">指定なし（付与元に従う）</option>
                  {[...tool.roles]
                    .sort((a, b) => a.rank - b.rank)
                    .map((r) => {
                      const can = canAssignToolRole(data, actorId, toolId, r.roleKey)
                      return (
                        <option key={r.roleKey} value={r.roleKey} disabled={!can.ok}>
                          {r.label}
                          {!can.ok ? "（代表のみ）" : ""}
                        </option>
                      )
                    })}
                </NativeSelect>
              </Field>
            </>
          )}
        </section>
      </div>

      <SheetFooter className="flex-row justify-between border-t">
        <Button
          variant="ghost"
          disabled={!dirty}
          onClick={() => setCell(memberId, toolId, saved)}
        >
          このセルの変更を戻す
        </Button>
        <Button onClick={onClose}>{sameCell(current, saved) ? "閉じる" : "下書きに反映"}</Button>
      </SheetFooter>
    </>
  )
}
