"use client"

import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DEMO_USER_IDS } from "@/lib/access/mock-data"
import { findDepartment, memberDepartmentIds, orgRoleLabels } from "@/lib/access/rules"
import { STATUS_LABEL } from "@/lib/access/format"
import { useStore } from "./store"

const RECOMMENDED = [
  { id: DEMO_USER_IDS.representative, note: "全体管理" },
  { id: DEMO_USER_IDS.divisionHead, note: "自部署を管理" },
  { id: DEMO_USER_IDS.member, note: "本人確認・申請" },
]

export function UserSwitcher() {
  const { data, actor, switchActor } = useStore()
  const roles = orgRoleLabels(data, actor.id)
  const depts = memberDepartmentIds(data, actor.id).map((d) => findDepartment(data, d)?.name ?? d)
  const others = data.members.filter((m) => !RECOMMENDED.some((r) => r.id === m.id))

  const label = (id: string) => {
    const r = orgRoleLabels(data, id)
    return r.length ? r.join("・") : "一般メンバー"
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 min-w-0 items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="デモユーザーを切り替える"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
          {actor.name.slice(0, 1)}
        </span>
        <span className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="truncate text-sm font-bold">{actor.name}</span>
          <span className="truncate text-[11px] text-muted-foreground">
            {roles.length ? roles.join("・") : "一般メンバー"}
            {depts.length > 0 && ` ／ ${depts.join("・")}`}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>デモユーザー（推奨）</DropdownMenuLabel>
          {RECOMMENDED.map((r) => {
            const m = data.members.find((x) => x.id === r.id)
            if (!m) return null
            return (
              <DropdownMenuItem key={r.id} onClick={() => switchActor(r.id)} className="flex items-start gap-2 py-2">
                <Check className={actor.id === r.id ? "mt-0.5 size-4" : "mt-0.5 size-4 opacity-0"} aria-hidden />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {label(m.id)} ／ {r.note}
                  </span>
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>その他のメンバー</DropdownMenuLabel>
          <div className="max-h-64 overflow-y-auto">
            {others.map((m) => (
              <DropdownMenuItem key={m.id} onClick={() => switchActor(m.id)} className="flex items-center gap-2">
                <Check className={actor.id === m.id ? "size-4" : "size-4 opacity-0"} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {m.status === "active" ? label(m.id) : STATUS_LABEL[m.status]}
                </span>
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
