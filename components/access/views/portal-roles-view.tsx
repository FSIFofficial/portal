"use client"

import { useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { PERMISSION_LABELS, type Permission, type Role } from "@/lib/types"
import { Callout, EmptyState, Field, PageHeader, Panel, Tag } from "../shared"
import { usePortalAccounts } from "../portal-accounts"
import { useStore } from "../store"

const ROLE_ID_RE = /^[a-z0-9_-]{2,32}$/
const emptyRole: Role = { id: "", name: "", description: "", permissions: [], builtin: false }

const permissionText = (r: Role) =>
  r.permissions.includes("*")
    ? "すべての操作（アカウント・権限管理を含む）"
    : r.permissions.length
      ? r.permissions.map((p) => PERMISSION_LABELS[p as Exclude<Permission, "*">] ?? p).join(" / ")
      : "閲覧のみ"

/** ポータルのロールと権限（ポータルの管理画面から移したもの） */
export function PortalRolesView() {
  const { data } = useStore()
  const portal = usePortalAccounts()
  const [editing, setEditing] = useState<{ role: Role; isNew: boolean } | null>(null)
  const count = (id: string) => data.members.filter((m) => m.status !== "withdrawn" && portal.accountOf(m)?.roles.includes(id)).length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="ポータルのロール"
        description="FSIF Portal のロール（権限のまとまり）と、できる操作。メンバーへの割り当ては「メンバー」の編集で行います。ツール・資料・お知らせの「公開範囲」でロールを選ぶと、そのロールを持つ人だけに表示されます（公開範囲はポータルの管理画面で設定）。"
        actions={
          <Button size="lg" onClick={() => setEditing({ role: { ...emptyRole }, isNew: true })}>
            <Plus className="size-4" />
            ロールを作成
          </Button>
        }
      />
      {portal.error && <Callout tone="danger">{portal.error}</Callout>}
      <Panel>
        {!portal.ready ? (
          <p className="p-4 text-sm text-muted-foreground">読み込み中…</p>
        ) : portal.roles.length === 0 ? (
          <EmptyState title="ロールがありません" />
        ) : (
          <ul className="divide-y" aria-label="ポータルのロール">
            {portal.roles.map((r) => (
              <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold">{r.name}</span>
                    {r.builtin && <Tag tone="outline">標準</Tag>}
                    <Tag>{count(r.id)}人</Tag>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ID: {r.id}
                    {r.description && ` ／ ${r.description}`}
                  </span>
                  <span className="text-xs">{permissionText(r)}</span>
                </div>
                {r.id === "superadmin" ? (
                  <span className="text-xs text-muted-foreground">変更不可</span>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="outline" size="lg" onClick={() => setEditing({ role: { ...r, permissions: [...r.permissions] }, isNew: false })}>
                      <Pencil className="size-4" />
                      編集
                    </Button>
                    {!r.builtin && (
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        aria-label={`${r.name}を削除`}
                        onClick={() => {
                          if (window.confirm(`ロール「${r.name}」を削除しますか？（${count(r.id)}人に割り当てられています。公開範囲にこのロールだけを選んでいる項目は、全権管理者にしか見えなくなります）`)) void portal.deleteRole(r.id)
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {editing && <RoleDialog initial={editing.role} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </div>
  )
}

function RoleDialog({ initial, isNew, onClose }: { initial: Role; isNew: boolean; onClose: () => void }) {
  const portal = usePortalAccounts()
  const [role, setRole] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const toggle = (p: Exclude<Permission, "*">) =>
    setRole((r) => ({ ...r, permissions: r.permissions.includes(p) ? r.permissions.filter((x) => x !== p) : [...r.permissions, p] }))

  const submit = async () => {
    if (!ROLE_ID_RE.test(role.id)) return setError("ロールIDは半角英小文字・数字・-_ の2〜32文字にしてください")
    if (!role.name.trim()) return setError("ロール名を入力してください")
    setError("")
    setBusy(true)
    const ok = await portal.saveRole({ ...role, name: role.name.trim(), description: role.description.trim() }, isNew)
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "ロールを作成" : "ロールを編集"}</DialogTitle>
          <DialogDescription>何もチェックしなければ「閲覧のみ」のロールになります。アカウントと権限の管理は全権管理者だけができます。</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label="ロールID" htmlFor="pr-id" hint="半角英小文字・数字・-_（例：contract, pr-team）。作成後は変更できません。">
            <Input id="pr-id" value={role.id} disabled={!isNew} onChange={(e) => setRole({ ...role, id: e.target.value.toLowerCase() })} className="h-9 font-mono" />
          </Field>
          <Field label="ロール名" htmlFor="pr-name">
            <Input id="pr-name" value={role.name} onChange={(e) => setRole({ ...role, name: e.target.value })} placeholder="例：契約担当" className="h-9" />
          </Field>
          <Field label="説明" htmlFor="pr-desc">
            <Input id="pr-desc" value={role.description} onChange={(e) => setRole({ ...role, description: e.target.value })} className="h-9" />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="pb-1.5 text-sm font-medium">できる操作</legend>
            <div className="flex flex-col gap-1.5 rounded-lg border p-3">
              {(Object.keys(PERMISSION_LABELS) as Exclude<Permission, "*">[]).map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={role.permissions.includes(p)} onChange={() => toggle(p)} />
                  {PERMISSION_LABELS[p]}
                </label>
              ))}
            </div>
          </fieldset>
          {error && <Callout tone="danger">{error}</Callout>}
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
