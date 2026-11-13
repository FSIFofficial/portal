"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { applyTemplate, previewTemplateApplication, removeDepartment, saveDepartment, type DepartmentInput, type TemplateRow } from "@/lib/access/commands"
import { departmentAncestors, departmentDescendants, departmentHead, departmentPath, departmentTree, findDepartment, findMember, findTool, findToolRole, hasFullAccess } from "@/lib/access/rules"
import type { TemplatePosition } from "@/lib/access/types"
import { cn } from "@/lib/utils"
import { Callout, EmptyState, Field, NativeSelect, PageHeader, Panel, Tag } from "../shared"
import { useStore } from "../store"

export function DepartmentsView() {
  const { data, actor, run } = useStore()
  const [selected, setDeptId] = useState(data.departments[0]?.id ?? "")
  const [editing, setEditing] = useState<DepartmentInput | null>(null)
  const deptId = data.departments.some((d) => d.id === selected) ? selected : (data.departments[0]?.id ?? "")
  const [position, setPosition] = useState<TemplatePosition>("member")
  const rep = hasFullAccess(data, actor.id)
  const dept = data.departments.find((d) => d.id === deptId)
  const head = departmentHead(data, deptId)
  const memberCount = data.memberships.filter((m) => m.departmentId === deptId).length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="所属・自動付与"
        description="部署と役職ごとのテンプレート。所属・任命時に、ここで指定したツールと初期役割が付与されます。"
        actions={
          rep && (
            <Button size="lg" onClick={() => setEditing({ name: "", description: "", parentId: null })}>
              <Plus className="size-4" />
              部署を追加
            </Button>
          )
        }
      />
      {data.departments.length === 0 && (
        <Panel>
          <EmptyState title="部署がありません" description={rep ? "「部署を追加」から作成してください。" : undefined} />
        </Panel>
      )}
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Panel className="h-fit">
          <ul className="flex flex-col p-1.5" aria-label="部署">
            {departmentTree(data).map(({ dept: d, depth }) => (
              <li key={d.id} style={{ paddingLeft: `${depth * 1}rem` }}>
                <button
                  type="button"
                  onClick={() => setDeptId(d.id)}
                  aria-current={d.id === deptId ? "true" : undefined}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-md px-2.5 py-2 text-left",
                    d.id === deptId ? "bg-accent text-accent-foreground" : "hover:bg-secondary",
                  )}
                >
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {data.memberships.filter((m) => m.departmentId === d.id).length}人 ／ 事業部長 {departmentHead(data, d.id)?.name ?? "未任命"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {dept && (
          <div className="flex flex-col gap-3">
            <Panel className="flex flex-col gap-1 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-bold">{dept.name}</h2>
                {dept.parentId && <span className="text-xs text-muted-foreground">{departmentPath(data, dept.id)}</span>}
                {rep && (
                  <div className="ml-auto flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing({ id: dept.id, name: dept.name, description: dept.description, parentId: dept.parentId ?? null })}>
                      <Pencil className="size-3.5" />
                      編集
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (window.confirm(`部署「${dept.name}」を削除しますか？（この部署のテンプレート・管理範囲・申請先も消えます）`))
                          run("部署の削除", (d) => removeDepartment(d, actor.id, dept.id), "部署を削除しました")
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      削除
                    </Button>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{dept.description}</p>
              <p className="text-xs text-muted-foreground">
                所属 {memberCount}人 ／ 事業部長 {head?.name ?? "未任命"}
              </p>
            </Panel>
            <div className="flex w-fit gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="テンプレートの対象">
              {(
                [
                  ["member", "一般メンバー"],
                  ["division_head", "事業部長"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={position === v}
                  onClick={() => setPosition(v)}
                  className={cn("h-9 rounded-md px-3 text-sm font-medium", position === v ? "bg-card shadow-sm" : "text-muted-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
            <InheritedTemplates departmentId={deptId} position={position} />
            <TemplateEditor key={`${deptId}-${position}-${data.version}`} departmentId={deptId} position={position} editable={rep} />
          </div>
        )}
      </div>
      {editing && <DepartmentDialog initial={editing} onClose={() => setEditing(null)} onSaved={(id) => id && setDeptId(id)} />}
    </div>
  )
}

/** 上の部署から引き継ぐテンプレート（この部署の人にも付与される） */
function InheritedTemplates({ departmentId, position }: { departmentId: string; position: TemplatePosition }) {
  const { data } = useStore()
  const ancestors = departmentAncestors(data, departmentId)
  const rows = data.templates.filter((t) => t.position === position && ancestors.includes(t.departmentId))
  if (ancestors.length === 0) return null
  return (
    <Panel className="flex flex-col gap-1.5 p-4">
      <h3 className="text-sm font-bold">上の部署から引き継ぐもの</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">上の部署のテンプレートはありません。</p>
      ) : (
        <ul className="flex flex-col gap-1" aria-label="上の部署から引き継ぐテンプレート">
          {rows.map((t) => {
            const tool = findTool(data, t.toolId)
            return (
              <li key={`${t.departmentId}-${t.toolId}`} className="flex flex-wrap items-center gap-1.5 text-xs">
                <Tag tone="outline">{findDepartment(data, t.departmentId)?.name}</Tag>
                {tool?.name}：{findToolRole(tool, t.roleKey)?.label ?? t.roleKey}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs leading-relaxed text-muted-foreground">
        この部署の{position === "member" ? "メンバー" : "事業部長"}にも付与されます。同じツールをこの部署でも指定すると、上位の役割が使われます。変えるときは上の部署のテンプレートを編集します。
      </p>
    </Panel>
  )
}

function DepartmentDialog({ initial, onClose, onSaved }: { initial: DepartmentInput; onClose: () => void; onSaved: (id?: string) => void }) {
  const { data, actor, run } = useStore()
  const [form, setForm] = useState(initial)
  // 自分自身と配下は親にできない
  const blocked = initial.id ? departmentDescendants(data, initial.id) : []
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    let newId: string | undefined
    const ok = await run(
      "部署の保存",
      (d) => {
        const next = saveDepartment(d, actor.id, form)
        newId = initial.id ?? next.departments[next.departments.length - 1]?.id
        return next
      },
      initial.id ? "部署を更新しました" : "部署を追加しました",
    )
    setBusy(false)
    if (ok) {
      onSaved(newId)
      onClose()
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial.id ? "部署を編集" : "部署を追加"}</DialogTitle>
          <DialogDescription>部署ごとに、所属したメンバーへ自動で付与するツールと役割（テンプレート）を設定できます。</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="部署名" htmlFor="d-name">
            <Input id="d-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9" required />
          </Field>
          <Field label="親の部署" htmlFor="d-parent" hint="事業部長は、自分の部署の配下の部署のメンバーも管理できます。">
            <NativeSelect id="d-parent" value={form.parentId ?? ""} onChange={(e) => setForm({ ...form, parentId: e.target.value || null })}>
              <option value="">なし（最上位）</option>
              {departmentTree(data)
                .filter(({ dept }) => !blocked.includes(dept.id))
                .map(({ dept, depth }) => (
                  <option key={dept.id} value={dept.id}>
                    {"　".repeat(depth)}
                    {dept.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Field label="説明" htmlFor="d-desc">
            <Input id="d-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-9" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              キャンセル
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "保存中…" : "保存する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TemplateEditor({ departmentId, position, editable }: { departmentId: string; position: TemplatePosition; editable: boolean }) {
  const { data, actor, run } = useStore()
  const initial: TemplateRow[] = data.tools.map((t) => ({
    toolId: t.id,
    roleKey: data.templates.find((x) => x.departmentId === departmentId && x.position === position && x.toolId === t.id)?.roleKey ?? null,
  }))
  const [rows, setRows] = useState(initial)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const dirty = rows.some((r, i) => r.roleKey !== initial[i].roleKey)
  const preview = confirm ? previewTemplateApplication(data, departmentId, position, rows) : null

  return (
    <Panel>
      {!editable && (
        <div className="border-b p-3">
          <Callout tone="neutral">テンプレートの編集は代表のみ行えます。閲覧のみ可能です。</Callout>
        </div>
      )}
      <ul className="divide-y">
        {data.tools.map((t, i) => (
          <li key={t.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {t.name}
                {!t.enabled && <Tag tone="danger">無効</Tag>}
                {t.roles.length === 0 && <Tag tone="outline">権限定義待ち</Tag>}
              </span>
              <span className="truncate text-xs text-muted-foreground">{t.description}</span>
            </div>
            <NativeSelect
              aria-label={`${t.name} の初期役割`}
              className="sm:w-48"
              value={rows[i].roleKey ?? ""}
              disabled={!editable || t.roles.length === 0}
              onChange={(e) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, roleKey: e.target.value || null } : r)))}
            >
              <option value="">付与しない</option>
              {t.roles.map((r) => (
                <option key={r.roleKey} value={r.roleKey}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </li>
        ))}
      </ul>
      {editable && (
        <div className="flex justify-end gap-2 border-t p-3">
          <Button variant="outline" size="lg" disabled={!dirty} onClick={() => setRows(initial)}>
            元に戻す
          </Button>
          <Button size="lg" disabled={!dirty} onClick={() => setConfirm(true)}>
            影響を確認して保存
          </Button>
        </div>
      )}
      <Dialog open={confirm} onOpenChange={(o) => !busy && setConfirm(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>テンプレートを保存</DialogTitle>
            <DialogDescription>現在の対象者へ追加付与されます。テンプレートから外したツールの既存付与は削除されません。</DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-lg border p-3 text-sm">
              {preview.items.length === 0 && preview.removedRows.length === 0 && <p className="text-muted-foreground">追加付与はありません</p>}
              {preview.items.map((it) => {
                const tool = findTool(data, it.toolId)
                return (
                  <p key={`${it.memberId}-${it.toolId}`} className="text-xs">
                    <span className="font-medium">{findMember(data, it.memberId)?.name}</span>：{tool?.name} に {findToolRole(tool, it.roleKey)?.label} を付与
                    {it.blockedByManualOff && <span className="text-muted-foreground">（手動OFFのため利用不可のまま）</span>}
                  </p>
                )
              })}
              {preview.removedRows.map((r) => (
                <p key={r.toolId} className="text-xs text-muted-foreground">
                  {findTool(data, r.toolId)?.name}：テンプレート対象外に（既存付与は保持）
                </p>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>
              キャンセル
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const ok = await run("テンプレートの保存", (d) => applyTemplate(d, actor.id, departmentId, position, rows), "テンプレートを保存しました")
                setBusy(false)
                if (ok) setConfirm(false)
              }}
            >
              {busy ? "保存中…" : "保存する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  )
}
