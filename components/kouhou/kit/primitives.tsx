'use client'

import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Tone } from '@/lib/kouhou/domain/labels'

export const TONE_CLASS: Record<Tone, string> = {
  neutral: 'bg-muted text-foreground border-border',
  info: 'bg-info-soft text-accent-foreground border-primary/25',
  success: 'bg-success-soft text-success border-success/25',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  muted: 'bg-card text-muted-foreground border-border',
}

export function Pill({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: React.ReactNode; className?: string; icon?: React.ReactNode }) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', TONE_CLASS[tone], className)}>
      {icon}
      {children}
    </span>
  )
}

export function Panel({ title, actions, children, className, bodyClassName, id }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section id={id} className={cn('rounded-lg border bg-card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          {title && <h2 className="text-sm font-bold">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

export function Field({ label, hint, error, children, className, htmlFor, required }: { label: string; hint?: React.ReactNode; error?: string | null; children: React.ReactNode; className?: string; htmlFor?: string; required?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-xs font-bold text-foreground">
        {label}
        {required && <span className="ml-1 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
    </div>
  )
}

export const inputClass =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground md:h-9'

export function Input(props: React.ComponentProps<'input'>) {
  return <input {...props} className={cn(inputClass, props.className)} />
}

export function Textarea(props: React.ComponentProps<'textarea'>) {
  return <textarea {...props} className={cn(inputClass, 'h-auto min-h-28 py-2 leading-relaxed', props.className)} />
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputClass, 'pr-8', className)}>
      {children}
    </select>
  )
}

export function Switch({ checked, onChange, disabled, label, id }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-primary bg-primary' : 'border-input bg-muted',
      )}
    >
      <span className={cn('inline-block size-4 rounded-full bg-card shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-1')} />
    </button>
  )
}

export function Tabs<T extends string>({ value, onChange, items, className, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode; count?: number }[]; className?: string; label: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('flex gap-1 overflow-x-auto border-b', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            '-mb-px flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors',
            value === it.value ? 'border-primary font-bold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={cn('tabular rounded-full px-1.5 text-xs', value === it.value ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{it.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, items, label, size = 'md' }: { value: T; onChange: (v: T) => void; items: { value: T; label: React.ReactNode }[]; label: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-muted p-0.5">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'rounded px-3 text-sm whitespace-nowrap transition-colors',
            size === 'sm' ? 'h-7' : 'h-9 md:h-8',
            value === it.value ? 'bg-card font-bold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  side,
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  side?: 'left' | 'right'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const node = ref.current
    const focusable = node?.querySelector<HTMLElement>('[data-autofocus], input, textarea, select, button:not([data-close])')
    focusable?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab' && node) {
        const els = Array.from(node.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open || typeof document === 'undefined') return null
  const width = { sm: 'md:max-w-sm', md: 'md:max-w-lg', lg: 'md:max-w-2xl', xl: 'md:max-w-4xl' }[size]
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex max-h-[92dvh] w-full flex-col bg-card shadow-xl',
          side
            ? cn('h-dvh max-h-dvh max-w-xs self-stretch md:max-w-xs', side === 'left' ? 'mr-auto' : 'ml-auto')
            : cn('rounded-t-xl md:rounded-xl', width),
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id={titleId} className="text-base font-bold text-pretty">
              {title}
            </h2>
            {description && <div className="text-xs leading-relaxed text-muted-foreground">{description}</div>}
          </div>
          <button type="button" data-close onClick={onClose} className="-mr-1 rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="閉じる">
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-4 py-10 text-center">
      <p className="text-sm font-bold">{title}</p>
      {children && <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{children}</p>}
      {action}
    </div>
  )
}

export function Notice({ tone = 'info', children, title, className }: { tone?: Tone; children: React.ReactNode; title?: string; className?: string }) {
  return (
    <div className={cn('rounded-md border px-3 py-2 text-sm leading-relaxed', TONE_CLASS[tone], className)} role={tone === 'danger' ? 'alert' : undefined}>
      {title && <p className="font-bold">{title}</p>}
      <div className={cn(title && 'mt-0.5', 'text-foreground/90')}>{children}</div>
    </div>
  )
}

export function DisabledReason({ reason }: { reason?: string }) {
  if (!reason) return null
  return <p className="text-xs leading-relaxed text-muted-foreground">{reason}</p>
}
