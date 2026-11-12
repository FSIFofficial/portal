"use client"

import { useMemo, useState } from "react"
import { AUDIT_SOURCE_LABEL, formatDateTime } from "@/lib/access/format"
import { findMember, memberDepartmentIds, headDepartmentIds, hasFullAccess } from "@/lib/access/rules"
import type { AuditSource } from "@/lib/access/types"
import { EmptyState, NativeSelect, PageHeader, Panel, Tag } from "../shared"
import { useStore } from "../store"

export function HistoryView() {
  const { data, actor } = useStore()
  const [source, setSource] = useState<AuditSource | "all">("all")
  const [memberId, setMemberId] = useState("all")
  const rep = hasFullAccess(data, actor.id)
  const heads = headDepartmentIds(data, actor.id)

  const logs = useMemo(
    () =>
      data.audit.filter((l) => {
        if (!rep) {
          const related = l.actorId === actor.id || l.memberIds.some((m) => m === actor.id || memberDepartmentIds(data, m).some((d) => heads.includes(d)))
          if (!related) return false
        }
        if (source !== "all" && l.source !== source) return false
        if (memberId !== "all" && !l.memberIds.includes(memberId)) return false
        return true
      }),
    [data, rep, actor.id, heads, source, memberId],
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="変更履歴" description={rep ? "すべての権限・組織の変更記録。" : "あなたの管理範囲に関係する変更記録。"} />
      <div className="grid max-w-xl grid-cols-2 gap-2">
        <NativeSelect aria-label="操作の種類" value={source} onChange={(e) => setSource(e.target.value as AuditSource | "all")}>
          <option value="all">すべての種類</option>
          {(Object.keys(AUDIT_SOURCE_LABEL) as AuditSource[]).map((s) => (
            <option key={s} value={s}>
              {AUDIT_SOURCE_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="対象メンバー" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="all">すべてのメンバー</option>
          {data.members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Panel>
        {logs.length === 0 ? (
          <EmptyState title="該当する履歴はありません" />
        ) : (
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-col gap-1 p-4 hover:bg-secondary sm:flex-row sm:items-center sm:gap-3">
                    <span className="w-36 shrink-0 text-xs text-muted-foreground">{formatDateTime(l.at)}</span>
                    <Tag tone={l.source === "sync" || l.source === "auto" ? "outline" : "default"}>{AUDIT_SOURCE_LABEL[l.source]}</Tag>
                    <span className="min-w-0 flex-1 text-sm">{l.summary}</span>
                    <span className="text-xs text-muted-foreground">
                      {l.actorId ? findMember(data, l.actorId)?.name : "システム"} ／ {l.items.length}件
                    </span>
                  </summary>
                  <div className="flex flex-col gap-1 border-t bg-secondary/50 px-4 py-3">
                    {l.reason && <p className="text-xs">理由：{l.reason}</p>}
                    {l.items.map((it, i) => (
                      <p key={i} className="text-xs leading-relaxed">
                        {it.label}：<span className="text-muted-foreground">{it.before}</span> → <span className="font-medium">{it.after}</span>
                      </p>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
