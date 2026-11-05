'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BookOpen, ChevronDown, ChevronRight, LayoutDashboard, LifeBuoy, LoaderCircle, LogOut, Menu, Search, Settings2, Sparkles, X, Zap } from 'lucide-react'
import { DEMO_MODE, EXPECTED_GAS_VERSION, asset } from '@/lib/config'
import { isAnyManager, type BootstrapData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AdminView } from './admin-view'
import { AuthProvider, useAuth } from './auth-provider'
import { LoginScreen } from './login-screen'
import { useHashRoute, type Navigate } from './router'
import { ToastProvider } from './ui'
import { HelpView } from './help-view'
import { HomeView, LibraryView, SearchView, ToolsView } from './views'

export function PortalApp() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  )
}

function Gate() {
  const { status, data } = useAuth()
  if (status === 'signedIn' && data) return <Portal data={data} />
  if (status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb]">
        <div className="flex items-center gap-2 text-[13px] text-[#718096]"><LoaderCircle size={18} className="animate-spin" />読み込み中…</div>
      </main>
    )
  }
  return <LoginScreen />
}

const NAV = [
  { path: '/', label: 'ホーム', icon: LayoutDashboard },
  { path: '/tools', label: 'ツール', icon: Zap },
  { path: '/library', label: '資料館', icon: BookOpen },
] as const

const DISMISS_KEY = 'fsif-portal-dismissed'

function readDismissed(): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? '[]')
  } catch {
    return []
  }
}

function Portal({ data }: { data: BootstrapData }) {
  const { route, navigate } = useHashRoute()
  const [mobileMenu, setMobileMenu] = useState(false)
  const [dismissed, setDismissed] = useState<string[]>([])
  const [headerQuery, setHeaderQuery] = useState('')
  const me = data.me
  const manager = isAnyManager(me)
  // 管理者には、画面とGASの版がずれていたら常に知らせる
  const versionMismatch = !DEMO_MODE && data.gasVersion !== EXPECTED_GAS_VERSION

  useEffect(() => setDismissed(readDismissed()), [])

  const dismiss = (key: string) => {
    const next = [...dismissed, key]
    setDismissed(next)
    try {
      window.localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-50)))
    } catch {
      // noop
    }
  }

  const segments = route.path.split('/').filter(Boolean)
  const tab = segments[0] ?? 'home'
  const activePath = tab === 'home' ? '/' : `/${tab}`
  const announcements = data.announcements.filter((a) => !dismissed.includes(`${a.id}:${a.updatedAt}`))
  const firstName = me.name.split(/\s+/)[0]

  const meta: Record<string, { title: string; description: string }> = {
    home: { title: 'ホーム', description: '今日も必要な情報へ、すばやくアクセスできます。' },
    tools: { title: 'ツール', description: '業務に使うツールをまとめています。' },
    library: { title: '資料館', description: 'マニュアルやオンボーディング資料を探せます。資料はGoogle Driveで開く・ダウンロードできます。' },
    search: { title: '検索結果', description: `「${route.params.get('q') ?? ''}」の検索結果` },
    admin: { title: '管理画面', description: 'ポータルの掲載情報・アカウント・権限を管理します。' },
    help: { title: 'ヘルプ・問い合わせ', description: '使い方で困ったときの問い合わせ先と、よくある質問です。' },
  }
  const page = meta[tab] ?? meta.home

  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#1b304b]">
      {manager && versionMismatch && (
        <div role="alert" className="border-b border-[#f1b8b2] bg-[#b42318] px-4 py-2.5 text-white">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-2 text-[12px]">
            <AlertTriangle size={15} className="shrink-0" />
            <span className="font-bold">GASの版が画面と一致していません</span>
            <span className="opacity-90">（画面：{EXPECTED_GAS_VERSION} ／ GAS：{data.gasVersion || '不明（古い版）'}）一部の操作が失敗する可能性があります。</span>
            <button onClick={() => navigate('/admin/system')} className="ml-auto rounded-lg bg-white/15 px-2.5 py-1 font-bold hover:bg-white/25">確認する</button>
          </div>
        </div>
      )}
      {announcements.map((a) => (
        <div key={a.id} className={cn('border-b px-4 py-2.5', a.level === 'important' ? 'border-[#e9caca] bg-[#fff5f4] text-[#a13b3b]' : 'border-[#d4e4f2] bg-[#f2f8fd] text-[#285b82]')}>
          <div className="mx-auto flex max-w-[1320px] items-center gap-2 text-[12px]">
            <span className={cn('shrink-0 rounded px-1.5 py-0.5 font-bold', a.level === 'important' ? 'bg-[#f7d8d6]' : 'bg-[#dcecf8]')}>お知らせ</span>
            <span className="font-semibold">{a.title}</span>
            <span className="hidden truncate opacity-80 sm:inline">{a.body}</span>
            <button onClick={() => dismiss(`${a.id}:${a.updatedAt}`)} aria-label="お知らせを閉じる" className="ml-auto shrink-0 rounded p-1 hover:bg-black/5"><X size={15} /></button>
          </div>
        </div>
      ))}

      <header className="sticky top-0 z-20 border-b border-[#e7ecf2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-4 py-3.5 lg:px-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-3" aria-label="ホームへ">
            <img src={asset('/fsif-logo.png')} alt="" className="size-10 rounded-xl" />
            <span className="text-left">
              <span className="block text-[17px] font-bold tracking-[-0.03em] text-[#132b4f]">FSIF Portal</span>
              <span className="block text-[10px] font-medium tracking-[0.18em] text-[#7b8da5]">CONNECT THE DOTS</span>
            </span>
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <button key={n.path} onClick={() => navigate(n.path)} className={cn('rounded-lg px-4 py-2 text-[13px] font-semibold transition', activePath === n.path ? 'bg-[#edf5fc] text-[#1e6db8]' : 'text-[#718096] hover:bg-[#f5f7fa] hover:text-[#1b304b]')}>{n.label}</button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                navigate('/search', { q: headerQuery })
              }}
              className="hidden h-10 w-[220px] items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#fafbfd] px-3 lg:flex"
            >
              <Search size={16} className="text-[#92a0af]" />
              <input value={headerQuery} onChange={(e) => setHeaderQuery(e.target.value)} placeholder="ツール・資料を検索" aria-label="ツール・資料を検索" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#a6b1bd]" />
            </form>
            <button onClick={() => setMobileMenu(!mobileMenu)} className="rounded-lg p-2 text-[#66778b] hover:bg-[#f3f6f9] md:hidden" aria-label="メニュー" aria-expanded={mobileMenu}><Menu size={21} /></button>
            <UserMenu data={data} />
          </div>
        </div>
        {mobileMenu && (
          <nav className="flex gap-1 border-t border-[#eef1f5] px-4 py-2 md:hidden">
            {NAV.map((n) => (
              <button key={n.path} onClick={() => { navigate(n.path); setMobileMenu(false) }} className={cn('flex-1 rounded-lg py-2 text-[13px] font-semibold', activePath === n.path ? 'bg-[#edf5fc] text-[#1e6db8]' : 'text-[#718096]')}>{n.label}</button>
            ))}
            <button onClick={() => { navigate('/help'); setMobileMenu(false) }} className={cn('flex-1 rounded-lg py-2 text-[13px] font-semibold', tab === 'help' ? 'bg-[#edf5fc] text-[#1e6db8]' : 'text-[#718096]')}>ヘルプ</button>
            {manager && (
              <button onClick={() => { navigate('/admin'); setMobileMenu(false) }} className={cn('flex-1 rounded-lg py-2 text-[13px] font-semibold', tab === 'admin' ? 'bg-[#edf5fc] text-[#1e6db8]' : 'text-[#718096]')}>管理</button>
            )}
          </nav>
        )}
      </header>

      <div className="mx-auto flex max-w-[1320px] gap-8 px-4 py-8 lg:px-8">
        <aside className="hidden w-[215px] shrink-0 lg:block">
          <div className="sticky top-28">
            <p className="mb-3 px-3 text-[11px] font-bold tracking-[0.14em] text-[#9aa8b8]">PORTAL MENU</p>
            <div className="flex flex-col gap-1">
              {NAV.map((n) => {
                const Icon = n.icon
                return (
                  <button key={n.path} onClick={() => navigate(n.path)} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold', activePath === n.path ? 'bg-[#eaf3fb] text-[#1e6db8]' : 'text-[#647589] hover:bg-white')}>
                    <Icon size={17} />{n.label}
                  </button>
                )
              })}
              <div className="my-4 border-t border-[#e4eaf0]" />
              {manager && (
                <button onClick={() => navigate('/admin')} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold', tab === 'admin' ? 'bg-[#eaf3fb] text-[#1e6db8]' : 'text-[#647589] hover:bg-white')}>
                  <Settings2 size={17} />管理画面
                </button>
              )}
              <button onClick={() => navigate('/help')} className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold', tab === 'help' ? 'bg-[#eaf3fb] text-[#1e6db8]' : 'text-[#647589] hover:bg-white')}>
                <LifeBuoy size={17} />ヘルプ・問い合わせ
              </button>
            </div>
            {DEMO_MODE && (
              <div className="mt-10 rounded-2xl bg-[#edf5fb] p-4">
                <div className="mb-2 flex size-8 items-center justify-center rounded-lg bg-white text-[#3986be]"><Sparkles size={16} /></div>
                <p className="text-[12px] font-bold text-[#285b82]">デモモード</p>
                <p className="mt-1 text-[11px] leading-5 text-[#6a879d]">GAS未接続のため、サンプルデータで動いています。変更はこのブラウザにだけ保存されます。</p>
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="mb-7">
            <div className="mb-2 flex items-center gap-2 text-[12px] text-[#8a99a9]"><span>FSIF Portal</span><ChevronRight size={13} /><span>{page.title}</span></div>
            <h1 className="text-[27px] font-bold tracking-[-0.04em] text-[#1b304b]">
              {tab === 'home' || !meta[tab] ? <>おかえりなさい、<span className="text-[#1e6db8]">{firstName}さん</span></> : page.title}
            </h1>
            <p className="mt-2 text-[13px] text-[#7d8c9d]">{page.description}</p>
          </div>
          <Content tab={tab} segments={segments} params={route.params} data={data} navigate={navigate} />
        </section>
      </div>
    </main>
  )
}

function Content({ tab, segments, params, data, navigate }: { tab: string; segments: string[]; params: URLSearchParams; data: BootstrapData; navigate: Navigate }) {
  switch (tab) {
    case 'tools':
      return <ToolsView data={data} navigate={navigate} initialQuery={params.get('q') ?? ''} />
    case 'library':
      return <LibraryView data={data} navigate={navigate} params={params} />
    case 'help':
      return <HelpView data={data} navigate={navigate} />
    case 'search':
      return <SearchView data={data} navigate={navigate} query={params.get('q') ?? ''} />
    case 'admin':
      return isAnyManager(data.me) ? <AdminView me={data.me} section={segments[1] ?? ''} navigate={navigate} /> : <HomeView data={data} navigate={navigate} />
    default:
      return <HomeView data={data} navigate={navigate} />
  }
}

function UserMenu({ data }: { data: BootstrapData }) {
  const { signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const me = data.me
  const roleNames = me.roles.map((id) => data.roles.find((r) => r.id === id)?.name ?? id)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 rounded-xl border border-[#e1e7ee] px-2.5 py-1.5 hover:bg-[#f7f9fb]">
        {me.picture ? (
          <img src={me.picture} alt="" referrerPolicy="no-referrer" className="size-8 rounded-full" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-[#dcecf8] text-[12px] font-bold text-[#1e6db8]">{me.name.slice(0, 1)}</span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-[12px] font-bold text-[#334b67]">{me.name}</span>
          <span className="block max-w-[140px] truncate text-[10px] text-[#8796a7]">{roleNames.join('・') || 'ロールなし'}</span>
        </span>
        <ChevronDown size={14} className="text-[#91a0af]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[260px] rounded-2xl border border-[#e4e9f0] bg-white p-2 shadow-xl">
          <div className="border-b border-[#edf0f3] px-3 pb-3 pt-2">
            <p className="text-[13px] font-bold text-[#1b304b]">{me.name}</p>
            <p className="truncate text-[11px] text-[#8796a7]">{me.email}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {roleNames.map((r) => <span key={r} className="rounded bg-[#edf5fc] px-1.5 py-0.5 text-[10px] font-semibold text-[#1e6db8]">{r}</span>)}
            </div>
          </div>
          <button onClick={signOut} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-[#55708b] hover:bg-[#f6f8fa]">
            <LogOut size={15} />{DEMO_MODE ? 'ログアウト（別のデモユーザーに切り替え）' : 'ログアウト'}
          </button>
        </div>
      )}
    </div>
  )
}
