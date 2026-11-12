"use client"

import { useState } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { saveToolSettings } from "@/lib/access/commands"
import type { RoleAssignableBy, Tool, ToolRole } from "@/lib/access/types"
import { Callout, Field, NativeSelect } from "../shared"
import { useStore } from "../store"

type RoleRow = Omit<ToolRole, "toolId" | "rank">

/** よく使う役割の組み合わせ（ひな形）。選ぶと役割の一覧を置き換える */
const PRESETS: { label: string; roles: RoleRow[] }[] = [
  {
    label: "利用者／管理者",
    roles: [
      { roleKey: "user", label: "利用者", description: "ツールの利用", assignableBy: "division_head" },
      { roleKey: "admin", label: "管理者", description: "設定の変更・削除を含むすべての操作", assignableBy: "representative" },
    ],
  },
  {
    label: "閲覧者／編集者／管理者",
    roles: [
      { roleKey: "viewer", label: "閲覧者", description: "内容の閲覧のみ", assignableBy: "division_head" },
      { roleKey: "editor", label: "編集者", description: "コンテンツの作成・編集", assignableBy: "division_head" },
      { roleKey: "admin", label: "管理者", description: "設定・メンバー管理を含むすべての操作", assignableBy: "representative" },
    ],
  },
  {
    label: "閲覧者／編集者／承認者／管理者",
    roles: [
      { roleKey: "viewer", label: "閲覧者", description: "内容の閲覧のみ", assignableBy: "division_head" },
      { roleKey: "editor", label: "編集者", description: "作成・編集", assignableBy: "division_head" },
      { roleKey: "approver", label: "承認者", description: "公開・承認", assignableBy: "representative" },
      { roleKey: "admin", label: "管理者", description: "設定を含むすべての操作", assignableBy: "representative" },
    ],
  },
  { label: "役割なし（利用ON/OFFのみ）", roles: [{ roleKey: "user", label: "利用者", description: "ツールの利用", assignableBy: "division_head" }] },
]

/** ツールの連携状態と内部役割の定義（上ほど下位の役割） */
export function ToolSettingsDialog({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const { actor, run } = useStore()
  const [integration, setIntegration] = useState<Tool["integration"]>(tool.integration)
  const [roles, setRoles] = useState<RoleRow[]>(
    [...tool.roles].sort((a, b) => a.rank - b.rank).map(({ roleKey, label, description, assignableBy }) => ({ roleKey, label, description, assignableBy })),
  )
  const [defaultRoleKey, setDefaultRoleKey] = useState(tool.defaultRoleKey ?? "")
  const [busy, setBusy] = useState(false)
  const existingKeys = new Set(tool.roles.map((r) => r.roleKey))

  const update = (i: number, patch: Partial<RoleRow>) => setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const move = (i: number, delta: number) =>
    setRoles((rs) => {
      const next = [...rs]
      const [r] = next.splice(i, 1)
      next.splice(i + delta, 0, r)
      return next
    })

  const submit = async () => {
    setBusy(true)
    const ok = await run(
      "役割の定義",
      (d) =>
        saveToolSettings(d, actor.id, tool.id, {
          integration,
          roles: roles.map((r, i) => ({ ...r, rank: i + 1 })),
          defaultRoleKey: defaultRoleKey || undefined,
        }),
      `${tool.name} の設定を保存しました`,
    )
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tool.name} の役割・連携</DialogTitle>
          <DialogDescription>
            役割は上ほど下位、下ほど上位です。複数の付与元があるときは最も上位の役割が適用されます。役割キーはツール側の判定に使うので、付与したあとは変えないでください。
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="連携状態" htmlFor="t-integration" hint="「連携済み」は、ツールがこの権限管理に問い合わせて利用可否を決めている状態です。未対応のツールでも権限の記録・付与はできます。">
            <NativeSelect id="t-integration" value={integration} onChange={(e) => setIntegration(e.target.value as Tool["integration"])}>
              <option value="linked">連携済み</option>
              <option value="unsupported">連携未対応</option>
            </NativeSelect>
          </Field>

          <fieldset className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-sm font-medium">役割</legend>
              <NativeSelect
                aria-label="ひな形から入れる"
                className="w-56"
                value=""
                onChange={(e) => {
                  const p = PRESETS[Number(e.target.value)]
                  if (p) setRoles(p.roles.map((r) => ({ ...r })))
                }}
              >
                <option value="">ひな形から入れる…</option>
                {PRESETS.map((p, i) => (
                  <option key={p.label} value={i}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {roles.length === 0 && <p className="text-xs text-muted-foreground">役割がありません。役割が無いツールは「権限定義待ち」になり、付与できません。</p>}
            <ol className="flex flex-col gap-2">
              {roles.map((r, i) => (
                <li key={i} className="flex flex-col gap-2 rounded-lg border p-2.5">
                  <div className="grid gap-2 sm:grid-cols-[7rem_1fr_11rem]">
                    <Input
                      aria-label={`${i + 1}番目の役割キー`}
                      placeholder="キー（例 editor）"
                      value={r.roleKey}
                      onChange={(e) => update(i, { roleKey: e.target.value })}
                      className="h-9 font-mono"
                    />
                    <Input aria-label={`${i + 1}番目の表示名`} placeholder="表示名（例 編集者）" value={r.label} onChange={(e) => update(i, { label: e.target.value })} className="h-9" />
                    <NativeSelect aria-label={`${i + 1}番目の付与できる人`} value={r.assignableBy} onChange={(e) => update(i, { assignableBy: e.target.value as RoleAssignableBy })}>
                      <option value="division_head">事業部長から付与可</option>
                      <option value="representative">代表のみ付与可</option>
                    </NativeSelect>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input aria-label={`${i + 1}番目の説明`} placeholder="説明" value={r.description} onChange={(e) => update(i, { description: e.target.value })} className="h-8 flex-1 text-xs" />
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="上へ（下位へ）" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="下へ（上位へ）" disabled={i === roles.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="この役割を削除" onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                  {existingKeys.has(r.roleKey) || !r.roleKey ? null : <p className="text-[11px] text-muted-foreground">新しい役割</p>}
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setRoles((rs) => [...rs, { roleKey: "", label: "", description: "", assignableBy: "division_head" }])}
            >
              <Plus className="size-3.5" />
              役割を追加
            </Button>
          </fieldset>

          <Field label="手動ONにしたときの役割" htmlFor="t-default" hint="付与元が無いまま「手動ON」にしたときに使う役割です。">
            <NativeSelect id="t-default" value={defaultRoleKey} onChange={(e) => setDefaultRoleKey(e.target.value)}>
              <option value="">指定しない</option>
              {roles
                .filter((r) => r.roleKey.trim())
                .map((r) => (
                  <option key={r.roleKey} value={r.roleKey.trim()}>
                    {r.label || r.roleKey}
                  </option>
                ))}
            </NativeSelect>
          </Field>
          <Callout tone="neutral">付与・テンプレート・申請で使われている役割は削除できません。</Callout>
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
