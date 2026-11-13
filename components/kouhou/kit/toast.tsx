'use client'

import { useSyncExternalStore } from 'react'
import { CircleAlert, CircleCheck, X } from 'lucide-react'
import type { Result } from '@/lib/kouhou/domain/actions'
import { cn } from '@/lib/utils'

interface ToastItem {
  id: number
  ok: boolean
  message: string
}

let items: ToastItem[] = []
let n = 0
const ls = new Set<() => void>()
const emit = () => ls.forEach((l) => l())

export function toast(message: string, ok = true) {
  const id = ++n
  items = [...items.slice(-3), { id, ok, message }]
  emit()
  setTimeout(() => dismiss(id), ok ? 3600 : 6000)
}

function show(r: Result) {
  if (r.ok) {
    if (r.message) toast(r.message, true)
  } else if (!r.conflict) toast(r.message, false)
  return r
}

/** 操作の結果を通知に出す。本番では結果がサーバーから返るまで待つ */
export function toastResult(r: Result | Promise<Result>): Promise<Result> {
  return Promise.resolve(r).then(show)
}

function dismiss(id: number) {
  items = items.filter((i) => i.id !== id)
  emit()
}

const EMPTY: ToastItem[] = []

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => items,
    () => EMPTY,
  )
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2 px-4 md:items-end md:pr-6">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.ok ? 'status' : 'alert'}
          className={cn(
            'pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm shadow-lg',
            t.ok ? 'border-success/30' : 'border-danger/40',
          )}
        >
          {t.ok ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
          <p className="flex-1 leading-relaxed">{t.message}</p>
          <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="通知を閉じる">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
