'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { House, LogOut } from 'lucide-react'
import { portalHomeUrl } from '@/lib/kouhou/paths'
import { mutate, useAppState, useCurrentUser } from '@/lib/kouhou/store/store'

export function UserMenu() {
  const user = useCurrentUser()
  const s = useAppState()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!user) return null
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-10 items-center justify-center rounded-full border bg-secondary text-sm font-bold text-secondary-foreground md:size-8"
        aria-label={`${user.name}のメニュー`}
      >
        {user.name.slice(0, 1)}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-60 rounded-lg border bg-popover p-1 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-sm font-bold">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="mt-1 text-xs">
              {user.isAdmin ? '管理者 / ' : ''}レベル{user.level}
              <span className="text-muted-foreground">（公開成功 {user.publishSuccessCount}回）</span>
            </p>
          </div>
          <a role="menuitem" href={portalHomeUrl()} className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-muted">
            <House className="size-4" aria-hidden />
            ポータルに戻る
          </a>
          {!s.live && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              mutate((d) => {
                d.currentUserId = null
              })
              router.replace('/kouhou/login')
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-md px-3 text-sm hover:bg-muted"
          >
            <LogOut className="size-4" aria-hidden />
            ログアウト（デモ）
          </button>
          )}
        </div>
      )}
    </div>
  )
}
