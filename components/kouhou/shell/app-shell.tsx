'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  FlaskConical,
  Images,
  LayoutDashboard,
  Lightbulb,
  List,
  Menu,
  OctagonPause,
  Plus,
  Repeat,
  Search,
  Settings,
} from 'lucide-react'
import { useAppState, useCurrentUser, useStoreMeta } from '@/lib/kouhou/store/store'
import { setBrandFilter, useUi } from '@/lib/kouhou/store/ui'
import { approvalCount } from '@/lib/kouhou/domain/selectors'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/kouhou/ui/button'
import { Dialog, Select } from '@/components/kouhou/kit/primitives'
import { DemoMenu } from './demo-menu'
import { UserMenu } from './user-menu'

const NAV = [
  { href: '/kouhou/dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/kouhou/calendar', label: 'カレンダー', icon: CalendarDays },
  { href: '/kouhou/posts', label: '投稿一覧', icon: List },
  { href: '/kouhou/approvals', label: '承認待ち', icon: ClipboardCheck, badge: true },
  { href: '/kouhou/plans', label: '企画スペース', icon: Lightbulb },
  { href: '/kouhou/recurring', label: '繰り返し予約', icon: Repeat },
  { href: '/kouhou/assets', label: '素材・テンプレート', icon: Images },
  { href: '/kouhou/analytics', label: '投稿分析', icon: BarChart3 },
  { href: '/kouhou/admin', label: '管理者設定', icon: Settings, admin: true },
]

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/$/, '')
  const s = useAppState()
  const user = useCurrentUser()
  const ui = useUi()
  const count = approvalCount(s, user, ui.brand)
  return (
    <nav aria-label="メイン" className="flex flex-col gap-0.5 p-2">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors',
              active ? 'bg-sidebar-accent font-bold text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-muted',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.badge && count > 0 && (
              <span className="tabular rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground" aria-label={`${count}件`}>
                {count}
              </span>
            )}
            {item.admin && !user?.isAdmin && <span className="text-[10px] text-muted-foreground">閲覧のみ</span>}
          </Link>
        )
      })}
    </nav>
  )
}

function Logo() {
  return (
    <Link href="/kouhou/calendar" className="flex items-center gap-2 px-3 py-3">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground" aria-hidden>
        PR
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-bold">FSIF 広報管理</span>
        <span className="text-[10px] text-muted-foreground">内部向けツール</span>
      </span>
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const s = useAppState()
  const user = useCurrentUser()
  const { hydrated } = useStoreMeta()
  const ui = useUi()
  const router = useRouter()
  const [drawer, setDrawer] = useState(false)
  const [demo, setDemo] = useState(false)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (hydrated && !user) router.replace('/kouhou/login')
  }, [hydrated, user, router])

  const stopped = s.stops.length > 0

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 border-b bg-warning-soft px-3 py-1 text-center text-xs text-foreground">
        <span className="font-bold text-warning">デモ</span>
        <span>実際の認証・SNS送信・分析取得は行いません</span>
        <span className="tabular">基準日時 {formatDateTime(s.now)}（日本時間）</span>
      </div>
      {stopped && (
        <div role="alert" className="flex flex-wrap items-center justify-center gap-2 border-b border-danger/30 bg-danger-soft px-3 py-1.5 text-sm text-danger">
          <OctagonPause className="size-4" aria-hidden />
          <span className="font-bold">緊急停止中</span>
          <span className="text-foreground">
            {s.stops
              .map((st) => (st.scope === 'all' ? '全体' : st.scope === 'brand' ? s.brands.find((b) => b.id === st.targetId)?.name : s.accounts.find((a) => a.id === st.targetId)?.name))
              .join('・')}
            の予約配信を停止しています
          </span>
          <Link href="/kouhou/admin#stop" className="underline underline-offset-2">
            管理者設定
          </Link>
        </div>
      )}
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r bg-sidebar lg:flex">
          <Logo />
          <NavList />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-2 md:px-4">
            <button type="button" onClick={() => setDrawer(true)} className="rounded-md p-2.5 hover:bg-muted lg:hidden" aria-label="メニューを開く">
              <Menu className="size-5" />
            </button>
            <label className="sr-only" htmlFor="brand-filter">
              表示ブランド
            </label>
            <Select id="brand-filter" value={ui.brand} onChange={(e) => setBrandFilter(e.target.value)} className="w-auto max-w-44 md:w-52">
              <option value="all">すべてのブランド</option>
              {s.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <form
              role="search"
              className="relative hidden flex-1 md:block md:max-w-sm"
              onSubmit={(e) => {
                e.preventDefault()
                router.push(`/kouhou/posts?q=${encodeURIComponent(q)}`)
              }}
            >
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <label htmlFor="global-search" className="sr-only">
                全体検索
              </label>
              <input
                id="global-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="投稿ID・タイトル・本文を検索"
                className="h-9 w-full rounded-md border border-input bg-muted pr-3 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:bg-card"
              />
            </form>
            <div className="ml-auto flex items-center gap-1.5">
              <Link href="/kouhou/posts" className="rounded-md p-2.5 hover:bg-muted md:hidden" aria-label="検索">
                <Search className="size-5" />
              </Link>
              <button
                type="button"
                onClick={() => setDemo(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-dashed border-warning/60 px-2.5 text-xs font-bold text-warning hover:bg-warning-soft md:h-8"
              >
                <FlaskConical className="size-4" aria-hidden />
                <span className="hidden sm:inline">デモ操作</span>
              </button>
              <Link href="/kouhou/posts/new" className={cn(buttonVariants(), 'gap-1')}>
                <Plus className="size-4" aria-hidden />
                <span className="hidden sm:inline">新規投稿</span>
                <span className="sr-only sm:hidden">新規投稿</span>
              </Link>
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 px-3 py-4 md:px-6 md:py-5">{user ? children : <p className="text-sm text-muted-foreground">読み込み中…</p>}</main>
        </div>
      </div>
      <Dialog open={drawer} onClose={() => setDrawer(false)} title="FSIF 広報管理" side="left">
        <div className="-mx-4 -my-4">
          <NavList onNavigate={() => setDrawer(false)} />
        </div>
      </Dialog>
      <DemoMenu open={demo} onClose={() => setDemo(false)} />
    </div>
  )
}
