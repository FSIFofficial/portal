'use client'

// 本番（ポータルが GAS につながっているとき）は、ポータルにログインしている人だけが開けるようにする。
// ログインはポータルと共通（同じサイトの localStorage 'fsif-portal-session'）。
// ポータルがデモモード（手元の pnpm dev や CI）のときは、そのまま開く。

import { useEffect, useState } from 'react'
import { LogIn } from 'lucide-react'
import { DEMO_MODE } from '@/lib/config'
import { portalHomeUrl } from '@/lib/kouhou/paths'
import { buttonVariants } from '@/components/kouhou/ui/button'

const SESSION_KEY = 'fsif-portal-session'

function hasPortalSession(): boolean {
  try {
    const s = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as { token?: string; expiresAt?: number } | null
    return !!s?.token && !!s.expiresAt && s.expiresAt > Date.now()
  } catch {
    return false
  }
}

export function PortalGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<'checking' | 'ok' | 'signedOut'>(DEMO_MODE ? 'ok' : 'checking')
  useEffect(() => {
    if (!DEMO_MODE) setState(hasPortalSession() ? 'ok' : 'signedOut')
  }, [])
  if (state === 'ok') return <>{children}</>
  if (state === 'checking') return <p className="p-6 text-sm text-muted-foreground">読み込み中…</p>
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <LogIn className="size-6" aria-hidden />
        </div>
        <h1 className="text-lg font-bold">ポータルにログインしてください</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          広報管理は FSIF Portal と同じログインで使います。ポータルでログインしてから、もう一度開いてください。
        </p>
        <a href={portalHomeUrl()} className={buttonVariants({ size: 'lg' })}>
          ポータルを開く
        </a>
      </div>
    </main>
  )
}
