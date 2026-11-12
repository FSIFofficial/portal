"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { decideRequest } from "@/lib/access/commands"
import { REQUEST_STATUS_LABEL, formatDateTime } from "@/lib/access/format"
import { describeAccess, findMember, findTool, findToolRole, resolveEffectiveAccess, hasFullAccess } from "@/lib/access/rules"
import type { AccessRequest } from "@/lib/access/types"
import { cn } from "@/lib/utils"
import { EmptyState, Field, PageHeader, Panel, Tag } from "../shared"
import { useStore } from "../store"

export function RequestTag({ status }: { status: AccessRequest["status"] }) {
  const tone = status === "pending" ? "primary" : status === "rejected" ? "danger" : status === "approved" ? "default" : "outline"
  return <Tag tone={tone}>{REQUEST_STATUS_LABEL[status]}</Tag>
}

export function RequestsView() {
  const { data, actor } = useStore()
  const rep = hasFullAccess(data, actor.id)
  const [tab, setTab] = useState<"pending" | "done">("pending")
  const [deciding, setDeciding] = useState<{ id: string; decision: "approve" | "reject" } | null>(null)
  const mine = data.requests.filter((r) => r.approverId === actor.id || rep)
  const list = mine.filter((r) => (tab === "pending" ? r.status === "pending" : r.status !== "pending"))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="申請管理"
        description={rep ? "すべての利用申請。代表はどの申請でも承認できます。" : "あなたが承認者に指定された利用申請。"}
      />
      <div className="flex w-fit gap-1 rounded-lg bg-secondary p-1" role="tablist" aria-label="申請の状態">
        {(
          [
            ["pending", `承認待ち（${mine.filter((r) => r.status === "pending").length}）`],
            ["done", "処理済み"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={tab === v}
            onClick={() => setTab(v)}
            className={cn("h-9 rounded-md px-3 text-sm font-medium", tab === v ? "bg-card shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      <Panel>
        {list.length === 0 ? (
          <EmptyState title={tab === "pending" ? "承認待ちの申請はありません" : "処理済みの申請はありません"} />
        ) : (
          <ul className="divide-y">
            {list.map((r) => {
              const tool = findTool(data, r.toolId)
              const current = describeAccess(resolveEffectiveAccess(data, r.requesterId, r.toolId))
              return (
                <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold">{findMember(data, r.requesterId)?.name}</span>
                      <RequestTag status={r.status} />
                      <Tag tone="outline">{r.type === "access" ? "利用申請" : "役割変更"}</Tag>
                    </div>
                    <p className="text-sm">
                      {tool?.name}：<span className="font-medium">{findToolRole(tool, r.roleKey)?.label ?? r.roleKey}</span> を希望
                    </p>
                    <p className="text-xs text-muted-foreground">現在：{current}</p>
                    <p className="text-sm leading-relaxed">理由：{r.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.createdAt)} ／ 承認者 {findMember(data, r.approverId)?.name}
                      {r.decidedAt && ` ／ 処理 ${formatDateTime(r.decidedAt)}`}
                    </p>
                    {r.decisionReason && <p className="text-xs">コメント：{r.decisionReason}</p>}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="lg" onClick={() => setDeciding({ id: r.id, decision: "reject" })}>
                        却下
                      </Button>
                      <Button size="lg" onClick={() => setDeciding({ id: r.id, decision: "approve" })}>
                        承認
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
      {deciding && <DecideDialog {...deciding} onClose={() => setDeciding(null)} />}
    </div>
  )
}

function DecideDialog({ id, decision, onClose }: { id: string; decision: "approve" | "reject"; onClose: () => void }) {
  const { data, actor, run } = useStore()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const req = data.requests.find((r) => r.id === id)!
  const tool = findTool(data, req.toolId)
  const needReason = decision === "reject"
  const error = touched && needReason && !reason.trim() ? "却下理由を入力してください" : undefined

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{decision === "approve" ? "申請を承認" : "申請を却下"}</DialogTitle>
          <DialogDescription>
            {findMember(data, req.requesterId)?.name}：{tool?.name}（{findToolRole(tool, req.roleKey)?.label}）
            {decision === "approve" && "。承認すると即時に付与され、履歴と通知が作成されます。"}
          </DialogDescription>
        </DialogHeader>
        <Field label={needReason ? "却下理由" : "コメント（任意）"} htmlFor="decide-reason" error={error}>
          <Textarea id="decide-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!error} />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            variant={decision === "reject" ? "destructive" : "default"}
            disabled={busy}
            onClick={async () => {
              setTouched(true)
              if (needReason && !reason.trim()) return
              setBusy(true)
              const ok = await run(
                decision === "approve" ? "申請の承認" : "申請の却下",
                (d) => decideRequest(d, actor.id, id, decision, reason.trim()),
                decision === "approve" ? "申請を承認しました" : "申請を却下しました",
              )
              setBusy(false)
              if (ok) onClose()
            }}
          >
            {busy ? "処理中…" : decision === "approve" ? "承認する" : "却下する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
