"use client"

import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { markNotificationsRead } from "@/lib/access/commands"
import { formatDateTime } from "@/lib/access/format"
import { cn } from "@/lib/utils"
import { useStore } from "./store"

export function NotificationBell() {
  const { data, actor, run, setView } = useStore()
  const mine = data.notifications.filter((n) => n.recipientId === actor.id)
  const unread = mine.filter((n) => !n.read).length
  const latest = mine.slice(0, 5)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-lg" className="relative" aria-label={`通知（未読${unread}件）`}>
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-primary-foreground">
                {unread}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-bold">通知</p>
          <Button
            variant="ghost"
            size="xs"
            disabled={unread === 0}
            onClick={() => run("既読化", (d) => markNotificationsRead(d, actor.id, "all"))}
          >
            すべて既読にする
          </Button>
        </div>
        {latest.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">通知はありません</p>
        ) : (
          <ul className="flex max-h-96 flex-col overflow-y-auto">
            {latest.map((n) => (
              <li key={n.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-secondary"
                  onClick={() => {
                    if (!n.read) run("既読化", (d) => markNotificationsRead(d, actor.id, [n.id]))
                    setView("notifications")
                  }}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={cn("size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className={cn("text-sm", !n.read && "font-bold")}>{n.title}</span>
                    {!n.read && <span className="sr-only">（未読）</span>}
                  </span>
                  <span className="line-clamp-2 pl-3 text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                  <span className="pl-3 text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="w-full" onClick={() => setView("notifications")}>
            通知一覧を開く
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
