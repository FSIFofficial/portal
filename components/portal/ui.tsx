'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  BookOpen, Briefcase, CalendarPlus, ChartBar, CircleHelp, ClipboardList, Database, FileText, Globe, GraduationCap,
  LayoutDashboard, Mail, Megaphone, MessageSquare, Rocket, Search, ShieldCheck, Sparkles, Users, Wrench, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RoleSummary } from '@/lib/types'

// ---------------------------------------------------------------------------
// ツールのアイコン・色
// ---------------------------------------------------------------------------

export const TOOL_ICONS: Record<string, LucideIcon> = {
  ClipboardList, Sparkles, CircleHelp, LayoutDashboard, Zap, ShieldCheck, CalendarPlus, Megaphone, BookOpen, Briefcase,
  ChartBar, Database, FileText, Globe, GraduationCap, Mail, MessageSquare, Rocket, Users, Wrench,
}

export const TONES: Record<string, string> = {
  blue: 'bg-[#eaf2ff] text-[#2563eb]',
  violet: 'bg-[#f2edff] text-[#7c3aed]',
  amber: 'bg-[#fff5df] text-[#b45309]',
  cyan: 'bg-[#e6f8fa] text-[#0e7490]',
  orange: 'bg-[#fff0e5] text-[#c2410c]',
  slate: 'bg-[#eef1f5] text-[#475569]',
  green: 'bg-[#eaf8ef] text-[#15803d]',
  pink: 'bg-[#fff0f5] text-[#be185d]',
}

export function ToolIcon({ name, tone, size = 22, className }: { name: string; tone: string; size?: number; className?: string }) {
  const Icon = TOOL_ICONS[name] ?? Zap
  return (
    <div className={cn('grid size-12 shrink-0 place-items-center rounded-xl', TONES[tone] ?? TONES.blue, className)}>
      <Icon size={size} strokeWidth={1.8} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// トースト
// ---------------------------------------------------------------------------

type ToastKind = 'info' | 'error'
const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; id: number } | null>(null)
  const show = useCallback((message: string, kind: ToastKind = 'info') => setToast({ message, kind, id: Date.now() }), [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 2800)
    return () => window.clearTimeout(timer)
  }, [toast])
  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className={cn(
            'fixed bottom-5 left-1/2 z-[60] flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-semibold text-white shadow-xl',
            toast.kind === 'error' ? 'bg-[#b42318]' : 'bg-[#173a62]',
          )}
        >
          <ShieldCheck size={16} className="shrink-0 text-white/70" />
          <span>{toast.message}</span>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

// ---------------------------------------------------------------------------
// フォーム部品
// ---------------------------------------------------------------------------

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f2440]/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cn('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-[760px]' : 'sm:max-w-[560px]')}
      >
        <div className="flex items-center justify-between border-b border-[#edf0f3] px-5 py-4">
          <h2 className="text-[16px] font-bold text-[#1b304b]">{title}</h2>
          <button onClick={onClose} aria-label="閉じる" className="rounded-lg p-1.5 text-[#7890a5] hover:bg-[#f1f5f8]"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-[#edf0f3] px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** group=true はボタン群など、1つの入力欄ではない項目に使う（label で囲むとクリックが先頭ボタンに伝わるため） */
export function Field({ label, hint, children, required, group }: { label: string; hint?: string; children: ReactNode; required?: boolean; group?: boolean }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="mb-4 block" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="mb-1.5 block text-[12px] font-bold text-[#38536f]">
        {label}
        {required && <span className="ml-1 text-[#c2410c]">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-5 text-[#8a99a9]">{hint}</span>}
    </Tag>
  )
}

const inputClass = 'w-full rounded-lg border border-[#dbe3ec] bg-white px-3 py-2 text-[13px] text-[#1b304b] outline-none transition placeholder:text-[#a6b1bd] focus:border-[#1f6fba] focus:ring-2 focus:ring-[#1f6fba]/15 disabled:bg-[#f5f7fa]'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, 'h-10', props.className)} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(inputClass, 'leading-6', props.className)} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, 'h-10', props.className)} />
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 py-1 text-[13px] text-[#38536f]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 accent-[#1f6fba]" />
      <span>{label}</span>
    </label>
  )
}

/** ロールの複数選択。空のときの意味（「全員」など）を emptyLabel で表示する */
export function RolePicker({ roles, value, onChange, emptyLabel, exclude = [] }: { roles: RoleSummary[]; value: string[]; onChange: (v: string[]) => void; emptyLabel?: string; exclude?: string[] }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {roles.filter((r) => !exclude.includes(r.id)).map((r) => {
          const on = value.includes(r.id)
          return (
            <button
              type="button"
              key={r.id}
              onClick={() => toggle(r.id)}
              aria-pressed={on}
              className={cn('rounded-full border px-3 py-1.5 text-[12px] font-semibold transition', on ? 'border-[#1f6fba] bg-[#1f6fba] text-white' : 'border-[#dbe3ec] bg-white text-[#55708b] hover:border-[#9fbfdc]')}
            >
              {r.name}
            </button>
          )
        })}
      </div>
      {emptyLabel && value.length === 0 && <p className="mt-2 text-[11px] text-[#8a99a9]">{emptyLabel}</p>}
    </div>
  )
}

export function Button({ variant = 'primary', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-[#1f6fba] text-white hover:bg-[#185c9d] disabled:bg-[#dfe5eb] disabled:text-[#8995a2]',
    secondary: 'border border-[#dbe4ec] bg-white text-[#55708b] hover:bg-[#f7f9fb]',
    danger: 'border border-[#f3d0cc] bg-white text-[#b42318] hover:bg-[#fff5f4]',
    ghost: 'text-[#55708b] hover:bg-[#f1f5f8]',
  }[variant]
  return <button {...props} className={cn('inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-[12px] font-bold transition disabled:cursor-not-allowed', styles, className)} />
}

export function RoleBadges({ ids, roles, emptyLabel = '全員' }: { ids: string[]; roles: RoleSummary[]; emptyLabel?: string }) {
  if (!ids.length) return <span className="text-[11px] text-[#9aa7b5]">{emptyLabel}</span>
  return (
    <span className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} className="rounded bg-[#fff5df] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">{roles.find((r) => r.id === id)?.name ?? id}</span>
      ))}
    </span>
  )
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d5dee7] bg-white p-12 text-center">
      <Search className="mx-auto text-[#a9b7c5]" size={28} />
      <p className="mt-3 text-[14px] font-semibold text-[#1b304b]">{title}</p>
      {message && <p className="mt-1 text-[12px] text-[#8a99a9]">{message}</p>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const style = status === '稼働中' ? 'bg-[#eaf7ef] text-[#1c7a43]' : status === '停止中' ? 'bg-[#fff1f0] text-[#b42318]' : 'bg-[#f1f3f5] text-[#6b7785]'
  return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', style)}>{status}</span>
}
