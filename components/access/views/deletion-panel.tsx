"use client"

import { useState } from "react"
import { Check, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  approveDeletion,
  cancelDeletion,
  DELETION_DELAY_DAYS,
  deletionApprovalsRequired,
  executeDeletion,
  requestDeletion,
  setDeletionApprovals,
} from "@/lib/access/commands"
import { formatDate, formatDateTime } from "@/lib/access/format"
import { findMember, hasFullAccess } from "@/lib/access/rules"
import type { DeletionRequest, Member } from "@/lib/access/types"
import { Callout, Field, NativeSelect, Panel, Tag } from "../shared"
import { useStore } from "../store"

const isActive = (r: DeletionRequest) => r.status === "pending" || r.status === "scheduled"

/** メンバー一覧の行に出す、完全削除の状態 */
export function DeletionBadge({ member }: { member: Member }) {
  const { data } = useStore()
  const r = (data.deletions ?? []).find((x) => x.memberId === member.id && isActive(x))
  if (!r) return null
  return r.status === "scheduled" ? (
    <Tag tone="danger">{formatDate(r.executeAfter)} 以降に完全削除</Tag>
  ) : (
    <Tag tone="danger">
      完全削除の承認待ち（{r.approvals.length}/{deletionApprovalsRequired(data)}）
    </Tag>
  )
}

/** 退会済みのメンバーの行に出す「完全削除を申請」 */
export function RequestDeletionButton({ member }: { member: Member }) {
  const { data, actor } = useStore()
  const [open, setOpen] = useState(false)
  if (!hasFullAccess(data, actor.id) || member.status !== "withdrawn") return null
  if ((data.deletions ?? []).some((x) => x.memberId === member.id && isActive(x))) return null
  return (
    <>
      <Button variant="ghost" size="lg" onClick={() => setOpen(true)} className="self-start text-destructive sm:self-center">
        <Trash2 className="size-4" />
        完全削除を申請
      </Button>
      {open && <RequestDialog member={member} onClose={() => setOpen(false)} />}
    </>
  )
}

function RequestDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const { data, actor, run } = useStore()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const need = deletionApprovalsRequired(data)
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{member.name} さんの完全削除を申請</DialogTitle>
          <DialogDescription>
            あなた以外の代表・全権管理者 {need}人が承認すると、その{DELETION_DELAY_DAYS}日後に削除します。それまではいつでも取り消せます。
          </DialogDescription>
        </DialogHeader>
        <Callout tone="danger">
          削除すると、メンバーの記録・所属・ツール権限・通知と、ポータルのアカウントが消えます（ポータルのアカウントはポータルのゴミ箱に30日残ります）。変更履歴に残っている名前・メールアドレスは「削除済みメンバー」に置き換えます。元に戻せません。
        </Callout>
        <Field label="理由" htmlFor="del-reason">
          <textarea
            id="del-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="例：本人からの削除依頼（2026/11/13 メール）"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            disabled={busy || !reason.trim()}
            onClick={async () => {
              setBusy(true)
              const ok = await run("完全削除の申請", (d) => requestDeletion(d, actor.id, member.id, reason), "完全削除を申請しました")
              setBusy(false)
              if (ok) onClose()
            }}
          >
            {busy ? "申請中…" : "申請する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** 完全削除の申請・予約の一覧（承認・取り消し） */
export function DeletionPanel() {
  const { data, actor, run, live } = useStore()
  const rep = hasFullAccess(data, actor.id)
  const [editingCount, setEditingCount] = useState(false)
  const need = deletionApprovalsRequired(data)
  const list = (data.deletions ?? []).filter(isActive)
  if (!rep || list.length === 0) return null
  const name = (id: string) => findMember(data, id)?.name ?? "（削除済み）"

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b p-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold">完全削除</h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            申請者以外の {need}人が承認すると、その{DELETION_DELAY_DAYS}日後に削除します（期限のあと、代表・全権管理者がこの画面を開いたときに実行）。
          </p>
        </div>
        {editingCount ? (
          <NativeSelect
            aria-label="必要な承認の人数"
            className="w-32"
            value={String(need)}
            onChange={async (e) => {
              await run("承認の人数", (d) => setDeletionApprovals(d, actor.id, Number(e.target.value)), "必要な承認の人数を変えました")
              setEditingCount(false)
            }}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                承認 {n}人
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setEditingCount(true)}>
            必要な承認：{need}人
          </Button>
        )}
      </div>
      <ul className="divide-y" aria-label="完全削除の申請">
        {list.map((r) => {
          const approvedByMe = r.approvals.some((a) => a.by === actor.id)
          const mine = r.requestedBy === actor.id
          return (
            <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{r.memberName}</span>
                  {r.status === "scheduled" ? (
                    <Tag tone="danger">{formatDate(r.executeAfter)} 以降に削除</Tag>
                  ) : (
                    <Tag tone="outline">
                      承認 {r.approvals.length}/{need}人
                    </Tag>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  申請：{name(r.requestedBy)}（{formatDateTime(r.requestedAt)}）
                  {r.approvals.length > 0 && ` ／ 承認：${r.approvals.map((a) => name(a.by)).join("、")}`}
                </span>
                <span className="text-xs">理由：{r.reason}</span>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                {r.status === "pending" && !mine && !approvedByMe && (
                  <Button size="lg" variant="destructive" onClick={() => run("完全削除の承認", (d) => approveDeletion(d, actor.id, r.id), "承認しました")}>
                    <Check className="size-4" />
                    承認
                  </Button>
                )}
                {r.status === "pending" && (mine || approvedByMe) && <span className="self-center text-xs text-muted-foreground">{mine ? "あなたの申請" : "承認済み"}</span>}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    const why = window.prompt("取り消す理由（任意）") ?? null
                    if (why !== null) void run("完全削除の取り消し", (d) => cancelDeletion(d, actor.id, r.id, why), "完全削除を取り消しました")
                  }}
                >
                  <X className="size-4" />
                  取り消す
                </Button>
                {!live && r.status === "scheduled" && (
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => run("完全削除（デモ）", (d) => executeDeletion(d, actor.id, r.id, Date.parse(r.executeAfter!)), "完全削除しました（デモ）")}
                  >
                    （デモ）期限にして実行
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
