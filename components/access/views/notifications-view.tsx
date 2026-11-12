"use client"

import { Button } from "@/components/ui/button"
import { markNotificationsRead } from "@/lib/access/commands"
import { formatDateTime } from "@/lib/access/format"
import { findMember } from "@/lib/access/rules"
import { cn } from "@/lib/utils"
import { EmptyState, PageHeader, Panel } from "../shared"
import { useStore } from "../store"

export function NotificationsView() {
  const { data, actor, run } = useStore()
  const mine = data.notifications.filter((n) => n.recipientId === actor.id)
  const unread = mine.filter((n) => !n.read).length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="通知"
        description={`${actor.name} さん宛ての通知（未読 ${unread}件）`}
        actions={
          <Button variant="outline" size="lg" disabled={unread === 0} onClick={() => run("既読化", (d) => markNotificationsRead(d, actor.id, "all"))}>
            すべて既読にする
          </Button>
        }
      />
      <Panel>
        {mine.length === 0 ? (
          <EmptyState title="通知はありません" />
        ) : (
          <ul className="divide-y">
            {mine.map((n) => (
              <li key={n.id} className={cn("flex flex-col gap-1.5 p-4", !n.read && "bg-primary-soft/40")}>
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("text-sm", !n.read && "font-bold")}>
                    {!n.read && <span className="sr-only">未読：</span>}
                    {n.title}
                  </p>
                  {!n.read && (
                    <Button variant="ghost" size="xs" onClick={() => run("既読化", (d) => markNotificationsRead(d, actor.id, [n.id]))}>
                      既読にする
                    </Button>
                  )}
                </div>
                <p className="text-sm leading-relaxed">{n.body}</p>
                {n.items.length > 0 && (
                  <ul className="flex flex-col gap-0.5 rounded-md bg-secondary px-3 py-2">
                    {n.items.map((it, i) => (
                      <li key={i} className="text-xs">
                        {it.label}：<span className="text-muted-foreground">{it.before}</span> → <span className="font-medium">{it.after}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {n.reason && <p className="text-xs">理由：{n.reason}</p>}
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt)} ／ {n.actorId ? findMember(data, n.actorId)?.name : "システム"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
