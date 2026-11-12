"use client"

import { useState } from "react"
import { Check, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { cancelRequest, submitRequest } from "@/lib/access/commands"
import { formatDateTime } from "@/lib/access/format"
import { DENY_LABEL, findMember, findTool, findToolRole, getApproverCandidates, resolveEffectiveAccess } from "@/lib/access/rules"
import type { RequestType } from "@/lib/access/types"
import { cn } from "@/lib/utils"
import { Callout, EmptyState, Field, NativeSelect, PageHeader, Panel, Tag } from "../shared"
import { useStore } from "../store"
import { RequestTag } from "./requests-view"

export function MyAccessView() {
  const { data, actor, run } = useStore()
  const [requestTool, setRequestTool] = useState<string | null>(null)
  const myRequests = data.requests.filter((r) => r.requesterId === actor.id)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="自分の権限・申請" description="あなたが使えるツールと内部役割。足りない権限は承認者へ申請できます。" />
      <Panel>
        <ul className="divide-y">
          {data.tools.map((t) => {
            const ea = resolveEffectiveAccess(data, actor.id, t.id)
            const pending = myRequests.some((r) => r.toolId === t.id && r.status === "pending")
            const higher = t.roles.some((r) => r.rank > (ea.appliedRole?.rank ?? -1))
            return (
              <li key={t.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      ea.allowed ? "bg-primary-soft text-primary" : "bg-secondary text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {ea.allowed ? <Check className="size-4" /> : <Minus className="size-4" />}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-bold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {ea.allowed ? `利用可 ／ ${ea.appliedRole?.label ?? "役割未設定"}` : `利用不可（${DENY_LABEL[ea.denyReason ?? "no_grant"]}）`}
                      {ea.sources.length > 0 && ` ／ 付与元：${[...new Set(ea.sources.map((s) => s.label))].join("・")}`}
                    </span>
                  </div>
                </div>
                {pending ? (
                  <Tag tone="primary">申請中</Tag>
                ) : (
                  t.enabled &&
                  t.roles.length > 0 &&
                  (!ea.allowed || higher) && (
                    <Button variant="outline" size="lg" onClick={() => setRequestTool(t.id)}>
                      {ea.allowed ? "役割変更を申請" : "利用を申請"}
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      </Panel>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-bold">申請履歴</h2>
        <Panel>
          {myRequests.length === 0 ? (
            <EmptyState title="申請はまだありません" />
          ) : (
            <ul className="divide-y">
              {myRequests.map((r) => {
                const tool = findTool(data, r.toolId)
                return (
                  <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="font-bold">{tool?.name}</span>
                        {findToolRole(tool, r.roleKey)?.label}
                        <RequestTag status={r.status} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(r.createdAt)} ／ 承認者 {findMember(data, r.approverId)?.name}
                      </span>
                      {r.decisionReason && <span className="text-xs">コメント：{r.decisionReason}</span>}
                    </div>
                    {r.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={() => run("申請の取り下げ", (d) => cancelRequest(d, actor.id, r.id), "申請を取り下げました")}
                      >
                        取り下げ
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </section>
      {requestTool && <RequestDialog toolId={requestTool} onClose={() => setRequestTool(null)} />}
    </div>
  )
}

function RequestDialog({ toolId, onClose }: { toolId: string; onClose: () => void }) {
  const { data, actor, run } = useStore()
  const tool = findTool(data, toolId)!
  const ea = resolveEffectiveAccess(data, actor.id, toolId)
  const type: RequestType = ea.allowed ? "role_change" : "access"
  const roles = [...tool.roles].sort((a, b) => a.rank - b.rank).filter((r) => !ea.allowed || r.rank > (ea.appliedRole?.rank ?? -1))
  const [roleKey, setRoleKey] = useState(roles.find((r) => r.roleKey === tool.defaultRoleKey)?.roleKey ?? roles[0]?.roleKey ?? "")
  const [reason, setReason] = useState("")
  const candidates = roleKey ? getApproverCandidates(data, actor.id, toolId, roleKey) : []
  const [approverId, setApproverId] = useState("")
  const effectiveApprover = approverId && candidates.some((c) => c.member.id === approverId) ? approverId : (candidates[0]?.member.id ?? "")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const reasonError = touched && !reason.trim() ? "申請理由を入力してください" : undefined

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {tool.name}の{type === "access" ? "利用申請" : "役割変更申請"}
          </DialogTitle>
          <DialogDescription>承認されると即時に付与され、通知が届きます。</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setTouched(true)
            if (!reason.trim() || !effectiveApprover) return
            setBusy(true)
            const ok = await run(
              "申請の送信",
              (d) => submitRequest(d, actor.id, { toolId, type, roleKey, reason: reason.trim(), approverId: effectiveApprover }),
              "申請を送信しました",
            )
            setBusy(false)
            if (ok) onClose()
          }}
        >
          <Field label="希望する役割" htmlFor="req-role">
            <NativeSelect id="req-role" value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
              {roles.map((r) => (
                <option key={r.roleKey} value={r.roleKey}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {findToolRole(tool, roleKey)?.description && (
            <p className="-mt-1 text-xs text-muted-foreground">{findToolRole(tool, roleKey)?.description}</p>
          )}
          <Field label="承認者" htmlFor="req-approver">
            {candidates.length === 0 ? (
              <Callout tone="danger">承認できる人がいません。代表へお問い合わせください。</Callout>
            ) : (
              <NativeSelect id="req-approver" value={effectiveApprover} onChange={(e) => setApproverId(e.target.value)}>
                {candidates.map((c) => (
                  <option key={c.member.id} value={c.member.id}>
                    {c.member.name}
                    {c.viaRoute === "primary" ? "（指定の申請先）" : c.viaRoute === "alternate" ? "（代替承認者）" : ""}
                    {c.escalated ? "（代表へ回付）" : ""}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label="申請理由" htmlFor="req-reason" error={reasonError}>
            <Textarea id="req-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonError} placeholder="例：新しい案件の担当になったため" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              キャンセル
            </Button>
            <Button type="submit" disabled={busy || candidates.length === 0 || !roleKey}>
              {busy ? "送信中…" : "申請する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
