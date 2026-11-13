"use client"

import { useState } from "react"
import { Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  appointDivisionHead,
  appointRepresentative,
  dismissDivisionHead,
  dismissRepresentative,
  setOrgAccount,
  previewPositionGrants,
  previewTransfer,
  removeRoute,
  removeScope,
  saveRoute,
  saveScope,
  transferOrganizationRole,
} from "@/lib/access/commands"
import { DISMISS_NOTICE, TRANSFER_WARNING } from "@/lib/access/assumptions"
import { formatDate } from "@/lib/access/format"
import { departmentPath, departmentTree, findDepartment, findMember, findTool, findToolRole, hasFullAccess, isDivisionHead, isOrgAccount, isRepresentative } from "@/lib/access/rules"
import type { ScopeAction } from "@/lib/access/types"
import { Callout, EmptyState, Field, NativeSelect, PageHeader, Panel, Tag } from "../shared"
import { useStore } from "../store"

const ACTION_LABEL: Record<ScopeAction, string> = { toggle_access: "利用可否", change_role: "内部役割" }

function SectionHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold">{title}</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}

export function ManagementView() {
  const { data, actor } = useStore()
  const rep = hasFullAccess(data, actor.id)
  const [transferRoleId, setTransferRoleId] = useState<string | null>(null)
  const [appointDept, setAppointDept] = useState<string | null>(null)
  const [dismissRoleId, setDismissRoleId] = useState<string | null>(null)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const [repOpen, setRepOpen] = useState(false)
  const [orgOpen, setOrgOpen] = useState(false)
  const { run, live } = useStore()
  const orgAccounts = data.orgRoles.filter((r) => r.kind === "org_account")

  const repRole = data.orgRoles.find((r) => r.kind === "representative")
  const visibleScopes = rep ? data.scopes : data.scopes.filter((s) => s.grantedTo === actor.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="管理権限設定" description="代表・事業部長の任命と譲渡、団体垢、他部署への管理範囲の拡張、申請先の設定。" />

      <Panel>
        <SectionHeader title="組織上の役割" description="代表と各部署の事業部長。譲渡すると管理範囲も後任へ移ります。" />
        <ul className="divide-y">
          <li className="flex flex-wrap items-center gap-3 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-bold">
                代表 <Tag tone="primary">全体管理</Tag>
              </span>
              <span className="text-xs text-muted-foreground">
                {repRole ? `${findMember(data, repRole.memberId)?.name} ／ ${formatDate(repRole.assignedAt)}〜` : "未任命"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {repRole && (rep || repRole.memberId === actor.id) && (
                <Button variant="outline" size="lg" onClick={() => setTransferRoleId(repRole.id)}>
                  {repRole.memberId === actor.id ? "代表を譲渡" : "代表を変更"}
                </Button>
              )}
              {repRole && rep && live && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    if (window.confirm(`${findMember(data, repRole.memberId)?.name} さんの代表を解除しますか？（ツール権限はそのまま残ります）`))
                      run("代表の解除", (d) => dismissRepresentative(d, actor.id), "代表を解除しました")
                  }}
                >
                  解除
                </Button>
              )}
              {!repRole && rep && (
                <Button size="lg" onClick={() => setRepOpen(true)}>
                  任命
                </Button>
              )}
            </div>
          </li>
          {departmentTree(data).map(({ dept: d }) => {
            const role = data.orgRoles.find((r) => r.kind === "division_head" && r.departmentId === d.id)
            const holder = role ? findMember(data, role.memberId) : undefined
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-bold">{departmentPath(data, d.id)} 事業部長</span>
                  <span className="text-xs text-muted-foreground">
                    {holder ? `${holder.name} ／ ${formatDate(role!.assignedAt)}〜` : "未任命"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {role && (rep || role.memberId === actor.id) && (
                    <Button variant="outline" size="lg" onClick={() => setTransferRoleId(role.id)}>
                      譲渡
                    </Button>
                  )}
                  {rep && role && (
                    <Button variant="outline" size="lg" onClick={() => setDismissRoleId(role.id)}>
                      解除
                    </Button>
                  )}
                  {rep && !role && (
                    <Button size="lg" onClick={() => setAppointDept(d.id)}>
                      任命
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel>
        <SectionHeader
          title="団体垢"
          description="団体・部署で共用するアカウント（例：広報用の共用アカウント）。ツール権限は付与できますが、代表・事業部長・申請の承認者にはなれません。"
          action={
            rep && (
              <Button size="lg" onClick={() => setOrgOpen(true)}>
                <Plus className="size-4" />
                追加
              </Button>
            )
          }
        />
        {orgAccounts.length === 0 ? (
          <EmptyState title="団体垢はありません" icon={<Users className="size-5" aria-hidden />} />
        ) : (
          <ul className="divide-y">
            {orgAccounts.map((r) => {
              const m = findMember(data, r.memberId)
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-bold">{m?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {m?.email} ／ {formatDate(r.assignedAt)}〜
                    </span>
                  </div>
                  {rep && (
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => run("団体垢の解除", (d) => setOrgAccount(d, actor.id, r.memberId, false), "個人のアカウントに戻しました")}
                    >
                      個人に戻す
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          title="管理範囲の拡張"
          description="事業部長に、自部署以外のメンバーの権限操作を許可します。"
          action={
            rep && (
              <Button size="lg" onClick={() => setScopeOpen(true)}>
                <Plus className="size-4" />
                追加
              </Button>
            )
          }
        />
        {visibleScopes.length === 0 ? (
          <EmptyState title="拡張された管理範囲はありません" />
        ) : (
          <ul className="divide-y">
            {visibleScopes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm">
                    <span className="font-bold">{findMember(data, s.grantedTo)?.name}</span> → {findDepartment(data, s.departmentId)?.name}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {s.actions.map((a) => (
                      <Tag key={a}>{ACTION_LABEL[a]}</Tag>
                    ))}
                    <Tag tone="outline">{s.toolIds === "all" ? "全ツール" : s.toolIds.map((t) => findTool(data, t)?.name).join("・")}</Tag>
                  </div>
                </div>
                {rep && (
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    aria-label="この管理範囲を削除"
                    onClick={() => run("管理範囲の削除", (d) => removeScope(d, actor.id, s.id), "管理範囲を削除しました")}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <SectionHeader
          title="申請先の設定"
          description="利用申請の承認者。条件に合う申請の候補として優先表示されます。不在時は代替承認者、それもいなければ代表が承認します。"
          action={
            rep && (
              <Button size="lg" onClick={() => setRouteOpen(true)}>
                <Plus className="size-4" />
                追加
              </Button>
            )
          }
        />
        {data.routes.length === 0 ? (
          <EmptyState title="申請先は未設定です" description="未設定の場合は管理権限を持つ人が候補になります。" />
        ) : (
          <ul className="divide-y">
            {data.routes.map((r) => {
              const tool = r.toolId ? findTool(data, r.toolId) : undefined
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                    <span>
                      {r.departmentId ? findDepartment(data, r.departmentId)?.name : "全部署"} ／ {tool?.name ?? "全ツール"} ／{" "}
                      {r.roleKey ? findToolRole(tool, r.roleKey)?.label : "全役割"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      承認者 {findMember(data, r.approverId)?.name}
                      {r.alternateId && ` ／ 代替 ${findMember(data, r.alternateId)?.name}`}
                    </span>
                  </div>
                  {rep && (
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label="この申請先を削除"
                      onClick={() => run("申請先の削除", (d) => removeRoute(d, actor.id, r.id), "申請先を削除しました")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {transferRoleId && <TransferDialog roleId={transferRoleId} onClose={() => setTransferRoleId(null)} />}
      {appointDept && <AppointDialog departmentId={appointDept} onClose={() => setAppointDept(null)} />}
      {dismissRoleId && <DismissDialog roleId={dismissRoleId} onClose={() => setDismissRoleId(null)} />}
      {scopeOpen && <ScopeDialog onClose={() => setScopeOpen(false)} />}
      {routeOpen && <RouteDialog onClose={() => setRouteOpen(false)} />}
      {repOpen && (
        <PickMemberDialog
          title="代表を任命"
          description="代表は全メンバー・全ツールの権限を管理できます（1人だけ）。"
          label="任命するメンバー"
          candidates={data.members.filter((m) => m.status === "active" && !isOrgAccount(data, m.id))}
          submitLabel="任命する"
          onSubmit={(memberId) => run("代表の任命", (d) => appointRepresentative(d, actor.id, memberId), "代表を任命しました")}
          onClose={() => setRepOpen(false)}
        />
      )}
      {orgOpen && (
        <PickMemberDialog
          title="団体垢を追加"
          description="団体・部署で共用しているアカウントを選びます。メンバーにいない場合は、先に「メンバー」で追加してください。"
          label="アカウント"
          candidates={data.members.filter((m) => m.status !== "withdrawn" && !isOrgAccount(data, m.id) && !isRepresentative(data, m.id) && !isDivisionHead(data, m.id))}
          submitLabel="団体垢にする"
          onSubmit={(memberId) => run("団体垢の設定", (d) => setOrgAccount(d, actor.id, memberId, true), "団体垢にしました")}
          onClose={() => setOrgOpen(false)}
        />
      )}
    </div>
  )
}

function PickMemberDialog({
  title,
  description,
  label,
  candidates,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string
  description: string
  label: string
  candidates: { id: string; name: string; email: string }[]
  submitLabel: string
  onSubmit: (memberId: string) => Promise<boolean>
  onClose: () => void
}) {
  const [memberId, setMemberId] = useState("")
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field label={label} htmlFor="pick-member">
          <NativeSelect id="pick-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">選択してください</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}（{m.email}）
              </option>
            ))}
          </NativeSelect>
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            disabled={!memberId || busy}
            onClick={async () => {
              setBusy(true)
              const ok = await onSubmit(memberId)
              setBusy(false)
              if (ok) onClose()
            }}
          >
            {busy ? "処理中…" : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function useBusyRun() {
  const { run } = useStore()
  const [busy, setBusy] = useState(false)
  const exec = async (...args: Parameters<typeof run>) => {
    setBusy(true)
    const ok = await run(...args)
    setBusy(false)
    return ok
  }
  return { busy, exec }
}

function TransferDialog({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const { data, actor } = useStore()
  const role = data.orgRoles.find((r) => r.id === roleId)!
  const candidates = data.members.filter(
    (m) =>
      m.status === "active" &&
      m.id !== role.memberId &&
      !isOrgAccount(data, m.id) &&
      (role.kind === "representative" || data.memberships.some((x) => x.memberId === m.id && x.departmentId === role.departmentId)),
  )
  const [toId, setToId] = useState("")
  const [step, setStep] = useState<"select" | "confirm">("select")
  const { busy, exec } = useBusyRun()
  const preview = toId ? previewTransfer(data, actor.id, roleId, toId) : null
  const selfTransfer = role.memberId === actor.id

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{preview?.roleLabel ?? "役割"}を譲渡</DialogTitle>
          <DialogDescription>現在：{findMember(data, role.memberId)?.name}</DialogDescription>
        </DialogHeader>
        {step === "select" ? (
          <Field label="後任" htmlFor="transfer-to" hint={role.kind === "division_head" ? "同じ部署に所属する在籍メンバーから選べます" : undefined}>
            <NativeSelect id="transfer-to" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">選択してください</option>
              {candidates.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        ) : (
          preview && (
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-1 rounded-lg border p-3">
                <p className="font-bold">{findMember(data, toId)?.name} さんへ移るもの</p>
                <p className="text-xs">・{preview.roleLabel}</p>
                {preview.scopesMoving.map((s) => (
                  <p key={s.id} className="text-xs">
                    ・管理範囲：{findDepartment(data, s.departmentId)?.name}
                  </p>
                ))}
                {preview.successorGrants.map((g) => {
                  const tool = findTool(data, g.toolId)
                  return (
                    <p key={g.toolId} className="text-xs">
                      ・{tool?.name}：{findToolRole(tool, g.roleKey)?.label} を付与
                    </p>
                  )
                })}
              </div>
              {preview.youLose.length > 0 && (
                <div className="flex flex-col gap-1 rounded-lg border p-3">
                  <p className="font-bold">{selfTransfer ? "あなた" : findMember(data, role.memberId)?.name}が失うもの</p>
                  {preview.youLose.map((l) => (
                    <p key={l} className="text-xs">
                      ・{l}
                    </p>
                  ))}
                  <p className="text-xs text-muted-foreground">ツール権限は保持されます。</p>
                </div>
              )}
              {selfTransfer && <Callout tone="danger">{TRANSFER_WARNING}</Callout>}
            </div>
          )
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => (step === "confirm" ? setStep("select") : onClose())} disabled={busy}>
            {step === "confirm" ? "戻る" : "キャンセル"}
          </Button>
          {step === "select" ? (
            <Button disabled={!toId} onClick={() => setStep("confirm")}>
              影響を確認
            </Button>
          ) : (
            <Button
              variant={selfTransfer ? "destructive" : "default"}
              disabled={busy}
              onClick={async () => {
                if (await exec("役割の譲渡", (d) => transferOrganizationRole(d, actor.id, roleId, toId), "役割を譲渡しました")) onClose()
              }}
            >
              {busy ? "処理中…" : "譲渡する"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AppointDialog({ departmentId, onClose }: { departmentId: string; onClose: () => void }) {
  const { data, actor } = useStore()
  const [memberId, setMemberId] = useState("")
  const { busy, exec } = useBusyRun()
  const candidates = data.members.filter(
    (m) => m.status === "active" && !isOrgAccount(data, m.id) && data.memberships.some((x) => x.memberId === m.id && x.departmentId === departmentId),
  )
  const grants = memberId ? previewPositionGrants(data, memberId, departmentId) : []
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{findDepartment(data, departmentId)?.name} 事業部長を任命</DialogTitle>
          <DialogDescription>任命すると事業部長テンプレートのツール権限が付与されます。</DialogDescription>
        </DialogHeader>
        <Field label="任命するメンバー" htmlFor="appoint-member">
          <NativeSelect id="appoint-member" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="">選択してください</option>
            {candidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {memberId && (
          <div className="flex flex-col gap-1 rounded-lg border p-3 text-xs">
            {grants.length === 0 ? (
              <p className="text-muted-foreground">追加付与はありません</p>
            ) : (
              grants.map((g) => {
                const tool = findTool(data, g.toolId)
                return (
                  <p key={g.toolId}>
                    {tool?.name}：{findToolRole(tool, g.roleKey)?.label} を付与{g.blockedByManualOff && "（手動OFFのため利用不可のまま）"}
                  </p>
                )
              })
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            disabled={!memberId || busy}
            onClick={async () => {
              if (await exec("事業部長の任命", (d) => appointDivisionHead(d, actor.id, memberId, departmentId), "事業部長を任命しました")) onClose()
            }}
          >
            {busy ? "処理中…" : "任命する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DismissDialog({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const { data, actor } = useStore()
  const { busy, exec } = useBusyRun()
  const role = data.orgRoles.find((r) => r.id === roleId)!
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>事業部長を解除</DialogTitle>
          <DialogDescription>
            {findMember(data, role.memberId)?.name}（{findDepartment(data, role.departmentId ?? "")?.name}）
          </DialogDescription>
        </DialogHeader>
        <Callout tone="neutral">{DISMISS_NOTICE}</Callout>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              if (await exec("事業部長の解除", (d) => dismissDivisionHead(d, actor.id, roleId), "事業部長を解除しました")) onClose()
            }}
          >
            {busy ? "処理中…" : "解除する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ScopeDialog({ onClose }: { onClose: () => void }) {
  const { data, actor } = useStore()
  const { busy, exec } = useBusyRun()
  const heads = data.orgRoles.filter((r) => r.kind === "division_head")
  const [grantedTo, setGrantedTo] = useState(heads[0]?.memberId ?? "")
  const [departmentId, setDepartmentId] = useState("")
  const [toolIds, setToolIds] = useState<string[] | "all">("all")
  const [actions, setActions] = useState<ScopeAction[]>(["toggle_access", "change_role"])
  const ownDept = heads.filter((h) => h.memberId === grantedTo).map((h) => h.departmentId)
  const valid = grantedTo && departmentId && actions.length > 0 && (toolIds === "all" || toolIds.length > 0)

  const toggleAction = (a: ScopeAction) => setActions((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))
  const toggleTool = (id: string) =>
    setToolIds((p) => (p === "all" ? [id] : p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>管理範囲を追加</DialogTitle>
          <DialogDescription>事業部長が他部署のメンバーを操作できるようにします。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="事業部長" htmlFor="scope-to">
            <NativeSelect id="scope-to" value={grantedTo} onChange={(e) => setGrantedTo(e.target.value)}>
              {[...new Set(heads.map((h) => h.memberId))].map((id) => (
                <option key={id} value={id}>
                  {findMember(data, id)?.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="対象部署" htmlFor="scope-dept">
            <NativeSelect id="scope-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">選択してください</option>
              {departmentTree(data)
                .filter(({ dept: d }) => !ownDept.includes(d.id))
                .map(({ dept: d, depth }) => (
                  <option key={d.id} value={d.id}>
                    {"　".repeat(depth)}
                    {d.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </div>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1.5 text-sm font-medium">許可する操作</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(ACTION_LABEL) as ScopeAction[]).map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={actions.includes(a)} onChange={() => toggleAction(a)} />
                {ACTION_LABEL[a]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="pb-1.5 text-sm font-medium">対象ツール</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={toolIds === "all"} onChange={(e) => setToolIds(e.target.checked ? "all" : [])} />
            すべてのツール
          </label>
          {toolIds !== "all" && (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {data.tools.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="size-4 accent-primary" checked={toolIds.includes(t.id)} onChange={() => toggleTool(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              if (await exec("管理範囲の追加", (d) => saveScope(d, actor.id, { grantedTo, departmentId, toolIds, actions }), "管理範囲を追加しました")) onClose()
            }}
          >
            {busy ? "保存中…" : "追加する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RouteDialog({ onClose }: { onClose: () => void }) {
  const { data, actor } = useStore()
  const { busy, exec } = useBusyRun()
  const [departmentId, setDepartmentId] = useState("")
  const [toolId, setToolId] = useState("")
  const [roleKey, setRoleKey] = useState("")
  const [approverId, setApproverId] = useState("")
  const [alternateId, setAlternateId] = useState("")
  const tool = toolId ? findTool(data, toolId) : undefined
  const managers = data.members.filter(
    (m) => m.status === "active" && data.orgRoles.some((r) => r.memberId === m.id && r.kind !== "org_account"),
  )
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>申請先を追加</DialogTitle>
          <DialogDescription>条件を空欄にすると「すべて」が対象になります。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="部署" htmlFor="route-dept">
            <NativeSelect id="route-dept" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">全部署</option>
              {departmentTree(data).map(({ dept: d, depth }) => (
                <option key={d.id} value={d.id}>
                  {"　".repeat(depth)}
                  {d.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="ツール" htmlFor="route-tool">
            <NativeSelect
              id="route-tool"
              value={toolId}
              onChange={(e) => {
                setToolId(e.target.value)
                setRoleKey("")
              }}
            >
              <option value="">全ツール</option>
              {data.tools.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="役割" htmlFor="route-role">
            <NativeSelect id="route-role" value={roleKey} disabled={!tool} onChange={(e) => setRoleKey(e.target.value)}>
              <option value="">全役割</option>
              {tool?.roles.map((r) => (
                <option key={r.roleKey} value={r.roleKey}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="承認者" htmlFor="route-approver">
            <NativeSelect id="route-approver" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
              <option value="">選択してください</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="代替承認者（任意）" htmlFor="route-alt">
            <NativeSelect id="route-alt" value={alternateId} onChange={(e) => setAlternateId(e.target.value)}>
              <option value="">なし</option>
              {managers
                .filter((m) => m.id !== approverId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            disabled={!approverId || busy}
            onClick={async () => {
              const ok = await exec(
                "申請先の追加",
                (d) =>
                  saveRoute(d, actor.id, {
                    departmentId: departmentId || null,
                    toolId: toolId || null,
                    roleKey: roleKey || null,
                    approverId,
                    alternateId: alternateId || null,
                  }),
                "申請先を追加しました",
              )
              if (ok) onClose()
            }}
          >
            {busy ? "保存中…" : "追加する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
