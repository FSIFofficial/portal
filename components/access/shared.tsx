"use client"

import type { ReactNode, SelectHTMLAttributes } from "react"
import { ChevronDown, Inbox } from "lucide-react"
import { cn } from "@/lib/utils"
import { INTEGRATION_LABEL, STATUS_LABEL } from "@/lib/access/format"
import type { EmploymentStatus, IntegrationStatus } from "@/lib/access/types"

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-balance">{title}</h1>
        {description && <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>{children}</section>
}

const STATUS_STYLE: Record<EmploymentStatus, string> = {
  active: "bg-secondary text-secondary-foreground",
  suspended: "bg-accent text-accent-foreground",
  withdrawn: "bg-destructive-soft text-destructive",
}

export function StatusBadge({ status }: { status: EmploymentStatus }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-xs font-medium", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  )
}

const INTEGRATION_STYLE: Record<IntegrationStatus, string> = {
  linked: "bg-primary-soft text-primary",
  unsupported: "bg-secondary text-muted-foreground",
  pending_roles: "bg-secondary text-foreground ring-1 ring-inset ring-border",
  sync_error: "bg-destructive-soft text-destructive",
}

export function IntegrationBadge({ status }: { status: IntegrationStatus }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded px-1.5 text-[11px] font-medium", INTEGRATION_STYLE[status])}>
      {INTEGRATION_LABEL[status]}
    </span>
  )
}

export function Tag({ children, tone = "default", className }: { children: ReactNode; tone?: "default" | "primary" | "danger" | "outline"; className?: string }) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary-soft text-primary",
    danger: "bg-destructive-soft text-destructive",
    outline: "ring-1 ring-inset ring-border text-muted-foreground",
  }
  return (
    <span className={cn("inline-flex h-5 max-w-full shrink-0 items-center truncate rounded px-1.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  )
}

export function NativeSelect({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select
        className="h-9 w-full appearance-none rounded-lg border border-input bg-background pr-8 pl-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </div>
  )
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        {icon ?? <Inbox className="size-5" aria-hidden />}
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

export function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor?: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function Callout({ tone = "info", children, title }: { tone?: "info" | "danger" | "neutral"; title?: string; children: ReactNode }) {
  const tones = {
    info: "bg-primary-soft text-accent-foreground",
    danger: "bg-destructive-soft text-destructive",
    neutral: "bg-secondary text-secondary-foreground",
  }
  return (
    <div className={cn("flex flex-col gap-1 rounded-lg px-3 py-2.5 text-sm leading-relaxed", tones[tone])}>
      {title && <p className="font-bold">{title}</p>}
      <div>{children}</div>
    </div>
  )
}
