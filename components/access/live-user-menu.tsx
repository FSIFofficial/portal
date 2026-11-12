"use client"

import { ArrowLeft, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { portalHomeUrl } from "@/lib/access/live"
import { findDepartment, memberDepartmentIds } from "@/lib/access/rules"
import { useStore } from "./store"

/** 本番のヘッダー右上：ログイン中の全権管理者（ポータルのアカウント）。ログアウトはポータルで行う */
export function LiveUserMenu() {
  const { data, actor, me } = useStore()
  const depts = memberDepartmentIds(data, actor.id).map((d) => findDepartment(data, d)?.name ?? d)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 min-w-0 items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="ログイン中のアカウント"
      >
        {me?.picture ? (
          <img src={me.picture} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full" />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{actor.name.slice(0, 1)}</span>
        )}
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-sm font-bold">{actor.name}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            全権管理者{depts.length > 0 && ` ／ ${depts.join("・")}`}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{actor.name}</span>
            <span className="truncate text-xs">{me?.email ?? actor.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => (window.location.href = portalHomeUrl())}>
          <ArrowLeft className="size-4" aria-hidden />
          ポータルに戻る
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
