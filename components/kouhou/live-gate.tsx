'use client'

// 本番（GAS 接続時）の読み込み中・未登録・停止中・エラーの画面。デモでは何もしない。

import { Ban, Loader2, TriangleAlert, UserX } from 'lucide-react'
import { LIVE_MODE } from '@/lib/kouhou/live'
import { reloadLive, useLiveMeta } from '@/lib/kouhou/store/store'
import { portalHomeUrl } from '@/lib/kouhou/paths'
import { Button, buttonVariants } from '@/components/kouhou/ui/button'

function Screen({ icon, title, children, retry }: { icon: React.ReactNode; title: string; children: React.ReactNode; retry?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-accent text-primary">{icon}</div>
        <h1 className="text-lg font-bold">{title}</h1>
        <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <a href={portalHomeUrl()} className={buttonVariants({ size: 'lg', variant: retry ? 'outline' : 'default' })}>
            ポータルを開く
          </a>
          {retry && (
            <Button size="lg" onClick={() => void reloadLive()}>
              再読み込み
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}

export function LiveGate({ children }: { children: React.ReactNode }) {
  const { status } = useLiveMeta()
  if (!LIVE_MODE || status.kind === 'ready') return <>{children}</>
  switch (status.kind) {
    case 'loading':
      return (
        <main className="flex min-h-dvh items-center justify-center gap-2 text-sm text-muted-foreground" aria-busy="true">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          読み込み中…
        </main>
      )
    case 'unregistered':
      return (
        <Screen icon={<UserX className="size-6" aria-hidden />} title="広報管理に登録されていません">
          <p>{status.reason ?? `${status.email} は広報管理の利用者に登録されていません。広報管理の管理者に、このメールアドレスの登録を依頼してください。`}</p>
        </Screen>
      )
    case 'suspended':
      return (
        <Screen icon={<Ban className="size-6" aria-hidden />} title="このアカウントは利用停止中です">
          <p>再開が必要な場合は広報管理の管理者へ連絡してください。</p>
        </Screen>
      )
    case 'error':
      return (
        <Screen icon={<TriangleAlert className="size-6" aria-hidden />} title={status.code === 'UNAUTHENTICATED' ? 'ポータルにログインしてください' : '読み込めませんでした'} retry={status.code !== 'UNAUTHENTICATED'}>
          <p>{status.message}</p>
        </Screen>
      )
  }
}
