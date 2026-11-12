"use client"

import { useMemo, useState } from "react"
import { Download, Pencil, Plus, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { importMembers, previewMemberChange, saveMember, validateMemberInput, type MemberInput } from "@/lib/access/commands"
import { fetchPortalUsers } from "@/lib/access/live"
import { formatDate } from "@/lib/access/format"
import {
  canManageTarget,
  departmentPath,
  departmentTree,
  findDepartment,
  managedDepartmentIds,
  memberEmails,
  findTool,
  findToolRole,
  headDepartmentIds,
  memberDepartmentIds,
  orgRoleLabels,
  hasFullAccess,
} from "@/lib/access/rules"
import type { EmploymentStatus } from "@/lib/access/types"
import { Callout, EmptyState, Field, NativeSelect, PageHeader, Panel, StatusBadge, Tag } from "../shared"
import { useStore } from "../store"

export function MembersView() {
  const { data, actor, live, portalToken, run } = useStore()
  const [query, setQuery] = useState("")
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<MemberInput | null>(null)
  const rep = hasFullAccess(data, actor.id)
  const canAdd = rep || headDepartmentIds(data, actor.id).length > 0

  const members = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.members.filter((m) => !q || m.name.toLowerCase().includes(q) || memberEmails(m).some((e) => e.includes(q)))
  }, [data.members, query])

  /** 本番：ポータルのアカウントのうち、まだメンバーにいない人を取り込む */
  const importFromPortal = async () => {
    setImporting(true)
    try {
      const users = await fetchPortalUsers(portalToken)
      const known = new Set(data.members.flatMap(memberEmails))
      const list = users.filter((u) => !known.has(u.email.toLowerCase()))
      if (list.length === 0) {
        toast.info("取り込めるアカウントはありません（すべて登録済みです）")
        return
      }
      if (!window.confirm(`ポータルのアカウントのうち、まだメンバーにいない${list.length}人を取り込みます（所属は未設定。ポータルで無効のアカウントは「退会」になります）。よろしいですか？`)) return
      let added = 0
      await run("ポータルから取り込み", (d) => {
        const r = importMembers(d, actor.id, list.map((u) => ({ name: u.name, email: u.email, active: u.active })))
        added = r.added
        return r.data
      })
      if (added) toast.success(`${added}人を取り込みました。所属を設定してください`)
    } catch (e) {
      toast.error(`ポータルのアカウントを読み込めませんでした：${e instanceof Error ? e.message : ""}`)
    } finally {
      setImporting(false)
    }
  }

  const openEdit = (id: string) => {
    const m = data.members.find((x) => x.id === id)!
    setEditing({ id, name: m.name, email: m.email, altEmails: m.altEmails ?? [], departmentIds: memberDepartmentIds(data, id), status: m.status })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="メンバー"
        description={
          live
            ? "FSIFメンバーの管理。追加するとポータルのアカウントも作られ、ポータルに入れるようになります（退会にするとアカウントを無効化）。所属を追加するとテンプレートに従ってツール権限が自動付与されます。"
            : "所属・在籍状態の管理。所属を追加するとテンプレートに従ってツール権限が自動付与されます（既存の権限は削除されません）。"
        }
        actions={
          canAdd && (
            <>
            {live && rep && (
              <Button size="lg" variant="outline" onClick={importFromPortal} disabled={importing}>
                <Download className="size-4" />
                {importing ? "読み込み中…" : "ポータルから取り込む"}
              </Button>
            )}
            <Button
              size="lg"
              onClick={() =>
                setEditing({ name: "", email: "", altEmails: [], departmentIds: rep ? [] : headDepartmentIds(data, actor.id).slice(0, 1), status: "active" })
              }
            >
              <Plus className="size-4" />
              メンバーを追加
            </Button>
            </>
          )
        }
      />
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="氏名・メールで検索" aria-label="氏名・メールで検索" className="h-9 pl-8" />
      </div>
      <Panel>
        {members.length === 0 ? (
          <EmptyState title="該当するメンバーがいません" />
        ) : (
          <ul className="divide-y">
            {members.map((m) => {
              const perm = canManageTarget(data, actor.id, m.id, null, "edit_member")
              const roles = orgRoleLabels(data, m.id).filter((r) => r !== "メンバー")
              return (
                <li key={m.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold">{m.name}</span>
                      <StatusBadge status={m.status} />
                      {roles.map((r) => (
                        <Tag key={r} tone="primary">
                          {r}
                        </Tag>
                      ))}
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {m.email}
                      {(m.altEmails ?? []).length > 0 && `（ほか ${m.altEmails!.join("、")}）`} ／ 登録 {formatDate(m.joinedAt)}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {memberDepartmentIds(data, m.id).length === 0 ? (
                        <Tag tone="outline">所属未設定</Tag>
                      ) : (
                        memberDepartmentIds(data, m.id).map((d) => <Tag key={d}>{departmentPath(data, d)}</Tag>)
                      )}
                    </div>
                  </div>
                  {perm.ok ? (
                    <Button variant="outline" size="lg" onClick={() => openEdit(m.id)} className="self-start sm:self-center">
                      <Pencil className="size-4" />
                      編集
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground sm:max-w-56 sm:text-right">{perm.reason}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
      {editing && <MemberDialog initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function MemberDialog({ initial, onClose }: { initial: MemberInput; onClose: () => void }) {
  const { data, actor, run, live } = useStore()
  const [form, setForm] = useState<MemberInput>(initial)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const errors = validateMemberInput(data, actor.id, form)
  const preview = previewMemberChange(data, form)
  const rep = hasFullAccess(data, actor.id)
  const heads = managedDepartmentIds(data, actor.id)
  const [altText, setAltText] = useState((initial.altEmails ?? []).join("\n"))
  const prevStatus = initial.id ? data.members.find((m) => m.id === initial.id)?.status : undefined

  const toggleDept = (id: string) =>
    setForm((f) => ({ ...f, departmentIds: f.departmentIds.includes(id) ? f.departmentIds.filter((x) => x !== id) : [...f.departmentIds, id] }))

  const submit = async () => {
    setTouched(true)
    if (Object.keys(errors).length) return
    setBusy(true)
    const ok = await run("メンバーの保存", (d) => saveMember(d, actor.id, form), initial.id ? "メンバー情報を保存しました" : "メンバーを追加しました")
    setBusy(false)
    if (ok) onClose()
  }

  const show = (k: string) => (touched ? errors[k] : undefined)

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "メンバーを編集" : "メンバーを追加"}</DialogTitle>
          <DialogDescription>
            {live
              ? "保存すると変更履歴が作成されます。ポータルのアカウントも合わせて作成・更新します（ポータルのロールは変えません）。"
              : "保存すると変更履歴が作成され、本人へ通知されます。"}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="氏名" htmlFor="m-name" error={show("name")}>
              <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!show("name")} className="h-9" />
            </Field>
            <Field label="メールアドレス" htmlFor="m-email" error={show("email")}>
              <Input id="m-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-invalid={!!show("email")} className="h-9" />
            </Field>
          </div>
          <Field
            label="追加のメールアドレス（任意）"
            htmlFor="m-alt"
            error={show("altEmails")}
            hint="別の Google アカウントでもログインする場合に、1行に1つ入れます。どのアドレスでも同じ人として扱い、ポータルのアカウントもアドレスごとに作ります。"
          >
            <textarea
              id="m-alt"
              rows={2}
              value={altText}
              onChange={(e) => {
                setAltText(e.target.value)
                setForm({ ...form, altEmails: e.target.value.split(/[\s,、]+/).filter(Boolean) })
              }}
              aria-invalid={!!show("altEmails")}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="例：name@example.org"
            />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="pb-1.5 text-sm font-medium">所属（複数選択可）</legend>
            <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
              {departmentTree(data).map(({ dept: d, depth }) => {
                const disabled = !rep && !heads.includes(d.id)
                return (
                  <label
                    key={d.id}
                    style={{ marginLeft: `${depth * 1.25}rem` }}
                    className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-sm has-disabled:opacity-50"
                  >
                    <input type="checkbox" className="size-4 accent-primary" checked={form.departmentIds.includes(d.id)} disabled={disabled} onChange={() => toggleDept(d.id)} />
                    {d.name}
                  </label>
                )
              })}
            </div>
            {show("departmentIds") && <p className="text-xs text-destructive" role="alert">{errors.departmentIds}</p>}
          </fieldset>
          <Field label="在籍状態" htmlFor="m-status" error={show("status")}>
            <NativeSelect id="m-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EmploymentStatus })}>
              <option value="active">在籍</option>
              <option value="suspended">休止</option>
              <option value="withdrawn">退会</option>
            </NativeSelect>
          </Field>

          {form.status === "withdrawn" && prevStatus !== "withdrawn" && initial.id && (
            <Callout tone="danger">退会にすると、すべてのツールが利用不可になります。手動ONや付与元よりも優先されます。</Callout>
          )}
          {prevStatus === "withdrawn" && form.status !== "withdrawn" && (
            <Callout tone="info">再加入：退会前の個別権限は復活せず、現在の所属テンプレートから再付与されます。</Callout>
          )}
          {(preview.grants.length > 0 || preview.removed.length > 0) && form.status !== "withdrawn" && (
            <div className="flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
              <p className="font-bold">保存時の自動処理</p>
              {preview.grants.map((g) => {
                const tool = findTool(data, g.toolId)
                return (
                  <p key={`${g.departmentId}-${g.toolId}`} className="text-xs">
                    {tool?.name}：{findToolRole(tool, g.roleKey)?.label} を付与（{findDepartment(data, g.departmentId)?.name}）
                    {g.blockedByManualOff && "※手動OFFのため利用不可のまま"}
                  </p>
                )
              })}
              {preview.removed.map((d) => (
                <p key={d} className="text-xs text-muted-foreground">
                  {findDepartment(data, d)?.name} から外れます。この所属で付与済みの権限は「異動後も保持」として残ります。
                </p>
              ))}
            </div>
          )}
          {touched && errors.form && <Callout tone="danger">{errors.form}</Callout>}
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
