"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import {
  Bell,
  Boxes,
  Building2,
  History,
  Inbox,
  KeyRound,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Table2,
  UserRound,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { VIEW_ACCESS, useStore, type ViewKey } from "./store"
import { NotificationBell } from "./notification-bell"
import { UserSwitcher } from "./user-switcher"
import { DemoStateMenu } from "./demo-state-menu"
import { LiveUserMenu } from "./live-user-menu"

interface NavItem {
  key: ViewKey
  label: string
  icon: typeof Table2
}

const ADMIN_NAV: NavItem[] = [
  { key: "matrix", label: "権限一覧", icon: Table2 },
  { key: "members", label: "メンバー", icon: Users },
  { key: "departments", label: "所属・自動付与", icon: Building2 },
  { key: "management", label: "管理権限設定", icon: ShieldCheck },
  { key: "portalRoles", label: "ポータルのロール", icon: KeyRound },
  { key: "requests", label: "申請管理", icon: Inbox },
  { key: "tools", label: "ツール・同期", icon: Boxes },
  { key: "history", label: "変更履歴", icon: History },
]

const SELF_NAV: NavItem[] = [
  { key: "me", label: "自分の権限・申請", icon: UserRound },
  { key: "notifications", label: "通知", icon: Bell },
]

function NavList({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { view, setView, level, data, actor } = useStore()
  const pendingForMe = data.requests.filter((r) => r.status === "pending" && r.approverId === actor.id).length
  const unread = data.notifications.filter((n) => n.recipientId === actor.id && !n.read).length
  const groups = [
    { label: "管理", items: ADMIN_NAV.filter((i) => VIEW_ACCESS[i.key].includes(level)) },
    { label: "本人", items: SELF_NAV },
  ].filter((g) => g.items.length > 0)

  return (
    <nav aria-label="メインナビゲーション" className="flex flex-col gap-4">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-0.5">
          {!collapsed && <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">{g.label}</p>}
          {g.items.map((item) => {
            const Icon = item.icon
            const active = view === item.key
            const count = item.key === "requests" ? pendingForMe : item.key === "notifications" ? unread : 0
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setView(item.key)
                  onNavigate?.()
                }}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "relative flex h-10 items-center gap-2.5 rounded-md px-3 text-sm font-medium transition-colors md:h-9",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {count > 0 && (
                  <span
                    className={cn(
                      "flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground",
                      collapsed ? "absolute top-1 right-1" : "ml-auto",
                    )}
                  >
                    {count}
                    <span className="sr-only">件</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ShieldCheck className="size-4" aria-hidden />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold">FSIF Access Manager</span>
        </div>
      )}
    </div>
  )
}

const DEMO_NOTE = "デモ環境：実際のツール権限には反映されません"

export function AppShell({ children }: { children: ReactNode }) {
  const { live } = useStore()
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col gap-4 border-r bg-sidebar py-3 transition-[width] md:flex",
          collapsed ? "w-16 px-2" : "w-56 px-3",
        )}
      >
        <div className={cn("flex h-9 items-center", collapsed ? "justify-center" : "justify-between px-1")}>
          <Brand collapsed={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList collapsed={collapsed} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn("justify-start gap-2 text-muted-foreground", collapsed && "justify-center")}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "サイドバーを展開" : "サイドバーを折り畳む"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "折り畳む"}
        </Button>
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetHeader className="border-b">
            <SheetTitle>
              <Brand />
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3">
            <NavList collapsed={false} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-col border-b bg-card">
          <div className="flex h-14 items-center gap-2 px-3 md:px-5">
            <Button variant="ghost" size="icon-lg" className="md:hidden" onClick={() => setDrawerOpen(true)} aria-label="メニューを開く">
              <Menu className="size-5" />
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="truncate text-sm font-bold md:hidden">FSIF Access Manager</span>
              {!live && (
                <p className="hidden items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground lg:inline-flex">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                  {DEMO_NOTE}
                </p>
              )}
            </div>
            {!live && <DemoStateMenu />}
            <NotificationBell />
            {live ? <LiveUserMenu /> : <UserSwitcher />}
          </div>
          {!live && (
            <p className="flex items-center gap-1.5 border-t bg-secondary px-3 py-1 text-[11px] text-muted-foreground lg:hidden">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {DEMO_NOTE}
            </p>
          )}
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-4 p-3 md:p-5">{children}</main>
      </div>
    </div>
  )
}
