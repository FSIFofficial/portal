"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  canAssignToolRole,
  canManageTarget,
  describeAccess,
  findMember,
  findTool,
  getVisibleBulkTargets,
  parseCellKey,
  resolveEffectiveAccess,
  savedCell,
  sameCell,
} from "@/lib/access/rules"
import type { DraftCell } from "@/lib/access/types"
import { Callout, Field, NativeSelect, Tag } from "../../shared"
import { useStore } from "../../store"

export function SaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data, draft, bulkKeys, saveDraft, saving, lastSaveError } = useStore()
  const [reason, setReason] = useState("")
  const rows = useMemo(
    () =>
      Object.entries(draft)
        .map(([k, cell]) => {
          const { memberId, toolId } = parseCellKey(k)
          if (sameCell(cell, savedCell(data, memberId, toolId))) return null
          return {
            key: k,
            member: findMember(data, memberId)?.name ?? memberId,
            tool: findTool(data, toolId)?.name ?? toolId,
            before: describeAccess(resolveEffectiveAccess(data, memberId, toolId)),
            after: describeAccess(resolveEffectiveAccess(data, memberId, toolId, cell)),
            bulk: bulkKeys.has(k),
          }
        })
        .filter((x): x is NonNullable<typeof x> => !!x),
    [draft, data, bulkKeys],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{rows.length}件の変更を保存</DialogTitle>
          <DialogDescription>保存すると変更履歴と、対象メンバーへの通知が作成されます。</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">保存する変更の一覧</caption>
            <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">対象</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">変更前 → 変更後</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{r.member}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {r.tool}
                        {r.bulk && <Tag>一括</Tag>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs leading-relaxed">
                    <span className="text-muted-foreground">{r.before}</span>
                    <span aria-hidden>{" → "}</span>
                    <span className="sr-only">から</span>
                    <span className="font-medium">{r.after}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Field label="変更理由（任意）" htmlFor="save-reason">
          <Textarea id="save-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例：担当業務の変更のため" rows={2} />
        </Field>
        {lastSaveError && (
          <Callout tone="danger" title="保存に失敗しました">
            {lastSaveError} 下書きは保持されているため、再試行できます。
          </Callout>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button
            disabled={saving || rows.length === 0}
            onClick={async () => {
              const outcome = await saveDraft(reason.trim())
              if (outcome === "ok" || outcome === "conflict") {
                setReason("")
                onOpenChange(false)
              }
            }}
          >
            {saving ? "保存中…" : lastSaveError ? "再試行" : "保存する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type BulkAction = "on" | "off" | "auto" | "role"

export function BulkDialog({
  open,
  onOpenChange,
  memberIds,
  toolIds,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  memberIds: string[]
  toolIds: string[]
}) {
  const { data, actor, getCell, setCell } = useStore()
  const [toolId, setToolId] = useState(toolIds[0] ?? "")
  const [action, setAction] = useState<BulkAction>("on")
  const [roleKey, setRoleKey] = useState("")
  const tool = findTool(data, toolId) ?? findTool(data, toolIds[0] ?? "")
  const effectiveToolId = tool?.id ?? ""

  const preview = useMemo(() => {
    if (!tool) return { targets: [], excluded: [] }
    const base = getVisibleBulkTargets(
      data,
      actor.id,
      memberIds.map((m) => ({ memberId: m, toolId: tool.id })),
    )
    if (action !== "role") return base
    const targets: typeof base.targets = []
    const excluded = [...base.excluded]
    for (const t of base.targets) {
      const p = canManageTarget(data, actor.id, t.memberId, t.toolId, "change_role")
      const r = canAssignToolRole(data, actor.id, t.toolId, roleKey || null)
      if (!p.ok) excluded.push({ ...t, reason: p.reason! })
      else if (!r.ok) excluded.push({ ...t, reason: r.reason! })
      else targets.push(t)
    }
    return { targets, excluded }
  }, [data, actor.id, memberIds, tool, action, roleKey])

  const nextCell = (memberId: string): DraftCell => {
    const cur = getCell(memberId, effectiveToolId)
    if (action === "role") return { access: cur.access, roleKey: roleKey || null }
    return { access: action === "auto" ? null : action, roleKey: cur.roleKey }
  }

  const apply = () => {
    for (const t of preview.targets) setCell(t.memberId, t.toolId, nextCell(t.memberId), "bulk")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>表示中のメンバーへ一括操作</DialogTitle>
          <DialogDescription>
            現在の絞り込み結果（{memberIds.length}人）が対象です。下書きに反映され、保存するまで確定しません。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="ツール" htmlFor="bulk-tool">
            <NativeSelect id="bulk-tool" value={effectiveToolId} onChange={(e) => setToolId(e.target.value)}>
              {toolIds.map((id) => (
                <option key={id} value={id}>
                  {findTool(data, id)?.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="操作" htmlFor="bulk-action">
            <NativeSelect id="bulk-action" value={action} onChange={(e) => setAction(e.target.value as BulkAction)}>
              <option value="on">手動ONにする</option>
              <option value="off">手動OFFにする</option>
              <option value="auto">手動指定を解除（自動に戻す）</option>
              <option value="role">内部役割を指定</option>
            </NativeSelect>
          </Field>
          {action === "role" && (
            <Field label="内部役割" htmlFor="bulk-role">
              <NativeSelect id="bulk-role" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
                <option value="">指定なし（付与元に従う）</option>
                {tool?.roles.map((r) => (
                  <option key={r.roleKey} value={r.roleKey}>
                    {r.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
          <p>
            <span className="font-bold">{preview.targets.length}人</span>に適用
            {preview.excluded.length > 0 && <span className="text-muted-foreground">／{preview.excluded.length}人は除外</span>}
          </p>
          {preview.excluded.length > 0 && (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto text-xs text-muted-foreground">
              {preview.excluded.map((e) => (
                <li key={e.memberId}>
                  <span className="font-medium text-foreground">{findMember(data, e.memberId)?.name}</span>：{e.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={apply} disabled={preview.targets.length === 0}>
            下書きに反映
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
