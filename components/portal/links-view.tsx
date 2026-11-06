'use client'

// リンク集：よく使うWebサイトやフォームへのリンクを、カテゴリごとにまとめて表示する
import { useEffect, useMemo, useState } from 'react'
import { Copy, ExternalLink, Search, Settings2, Star, X } from 'lucide-react'
import { can, isNew, type BootstrapData, type PortalLink } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTrack } from './auth-provider'
import type { Navigate } from './router'
import { useFavorites } from './tool-card'
import { EmptyState, NewBadge, useToast } from './ui'
import { copyText } from '@/lib/clipboard'
import { imageUrl } from '@/lib/drive'

const NO_CATEGORY = 'その他'

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * アイコンを取る先を順番に試す：自分で設定した画像 → Google → DuckDuckGo → サイト自身の favicon。
 * どれも取れなければ頭文字を表示する（社内サイトや、広告ブロックなどでアイコンの取得が止められている場合）
 */
export function iconCandidates(link: Pick<PortalLink, 'url' | 'iconUrl'>): string[] {
  const list: string[] = []
  if (link.iconUrl) list.push(imageUrl(link.iconUrl, 128))
  const host = hostOf(link.url)
  if (host) {
    list.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`)
    list.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`)
    try {
      list.push(`${new URL(link.url).origin}/favicon.ico`)
    } catch {
      // URLとして読めない
    }
  }
  return list
}

export function SiteIcon({ link }: { link: Pick<PortalLink, 'url' | 'iconUrl' | 'title'> }) {
  const candidates = iconCandidates(link)
  const [index, setIndex] = useState(0)
  useEffect(() => setIndex(0), [link.url, link.iconUrl])
  const src = candidates[index]
  if (!src) {
    return <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand-soft)] text-[15px] font-bold text-[var(--brand)]">{(link.title || '?').slice(0, 1)}</span>
  }
  // 自分で設定した画像は枠いっぱいに、自動取得したアイコンは小さめに表示する
  const custom = !!link.iconUrl && index === 0
  return (
    <span className="site-icon grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#eef1f4] bg-white">
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setIndex((n) => n + 1)}
        onLoad={(e) => {
          // 取得先によっては、見つからないときに1px程度の画像を返すので次を試す
          if (e.currentTarget.naturalWidth > 0 && e.currentTarget.naturalWidth < 8) setIndex((n) => n + 1)
        }}
        className={custom ? 'size-full object-cover' : 'size-6'}
      />
    </span>
  )
}

export function LinkCard({ link, restricted }: { link: PortalLink; restricted?: boolean }) {
  const track = useTrack()
  const toast = useToast()
  const { favorites, toggle } = useFavorites()
  const fav = favorites.includes(link.id)
  const copy = async () => {
    const ok = await copyText(link.url)
    toast(ok ? 'リンクをコピーしました' : 'コピーできませんでした。リンクを長押し（右クリック）してコピーしてください', ok ? 'info' : 'error')
  }
  return (
    <div className="group flex items-start gap-1 rounded-2xl border border-[#e4e9f0] bg-white p-4 pr-2 shadow-[0_2px_10px_rgba(25,50,80,0.03)] transition hover:-translate-y-0.5 hover:border-[#bdd4e7] hover:shadow-md">
      <a href={link.url} target="_blank" rel="noopener noreferrer" onClick={() => track('link', link.id)} className="flex min-w-0 flex-1 items-start gap-3">
        <SiteIcon link={link} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[14px] font-bold text-[#1b304b] group-hover:text-[var(--brand)]">{link.title}</span>
            <ExternalLink size={13} className="shrink-0 text-[#a9b5c2]" />
            {restricted && <span className="shrink-0 rounded bg-[#fff5df] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">限定公開</span>}
          </span>
          {link.description && <span className="mt-0.5 block line-clamp-2 text-[12px] leading-5 text-[#718096]">{link.description}</span>}
          <span className="mt-1 block truncate text-[11px] text-[#9aa7b5]">{hostOf(link.url)}</span>
        </span>
      </a>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          onClick={() => void toggle(link.id)}
          aria-pressed={fav}
          aria-label={fav ? `${link.title}をお気に入りから外す` : `${link.title}をお気に入りに追加`}
          title={fav ? 'お気に入りから外す' : 'お気に入りに追加（ホームに表示されます）'}
          className={cn('rounded-lg p-1.5 transition hover:bg-[#fff8e6]', fav ? 'text-[#e5a00d]' : 'text-[#c2ccd6] hover:text-[#e5a00d]')}
        >
          <Star size={16} fill={fav ? 'currentColor' : 'none'} />
        </button>
        <button onClick={() => void copy()} aria-label={`${link.title}のリンクをコピー`} title="リンクをコピー" className="rounded-lg p-1.5 text-[#9aa7b5] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]">
          <Copy size={16} />
        </button>
      </div>
    </div>
  )
}

export function LinksView({ data, navigate }: { data: BootstrapData; navigate: Navigate }) {
  const links = useMemo(() => data.links ?? [], [data.links])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const categories = useMemo(() => {
    const list: string[] = []
    links.forEach((l) => {
      const c = l.category || NO_CATEGORY
      if (!list.includes(c)) list.push(c)
    })
    // 「その他」は最後に
    return [...list.filter((c) => c !== NO_CATEGORY), ...list.filter((c) => c === NO_CATEGORY)]
  }, [links])

  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = links.filter((l) => {
    const text = `${l.title} ${l.description} ${l.category} ${l.url}`.toLowerCase()
    return words.every((w) => text.includes(w)) && (!category || (l.category || NO_CATEGORY) === category)
  })
  const groups = categories
    .map((c) => ({ name: c, items: filtered.filter((l) => (l.category || NO_CATEGORY) === c) }))
    .filter((g) => g.items.length)

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#dfe6ed] bg-white px-3">
          <Search size={16} className="text-[#9aa8b8]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="リンク名・説明・URLで検索" aria-label="リンクを検索" className="h-10 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#a6b1bd]" />
          {query && <button onClick={() => setQuery('')} aria-label="検索をクリア" className="rounded p-1 text-[#9aa8b8] hover:bg-[#f3f6f9]"><X size={14} /></button>}
        </div>
        {can(data.me, 'links.manage') && (
          <button onClick={() => navigate('/admin/links')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#dbe4ec] bg-white px-3.5 py-2.5 text-[12px] font-bold text-[#55708b] hover:bg-[#f7f9fb]">
            <Settings2 size={15} />リンクを管理
          </button>
        )}
      </div>
      {categories.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="カテゴリ">
          {['', ...categories].map((c) => (
            <button key={c || 'all'} onClick={() => setCategory(c)} aria-pressed={category === c} className={cn('rounded-full border px-3 py-1.5 text-[12px] font-semibold transition', category === c ? 'border-[var(--brand)] bg-[var(--brand)] text-white' : 'border-[#dbe3ec] bg-white text-[#55708b] hover:border-[#9fbfdc]')}>
              {c || 'すべて'}
            </button>
          ))}
        </div>
      )}
      {!links.length ? (
        <EmptyState title="リンクはまだありません" message={can(data.me, 'links.manage') ? '「リンクを管理」から追加できます。' : '管理者が追加するとここに表示されます。'} />
      ) : !groups.length ? (
        <EmptyState title="リンクが見つかりません" message="検索条件を変えてお試しください。" />
      ) : (
        <div className="flex flex-col gap-7">
          {groups.map((g) => (
            <section key={g.name}>
              <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
                {g.name}<span className="text-[12px] font-semibold text-[#9aa7b5]">{g.items.length}</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((l) => (
                  <div key={l.id} className="relative">
                    <LinkCard link={l} restricted={l.visibleRoles.length > 0} />
                    {isNew(l, data.me) && <span className="pointer-events-none absolute -right-1 -top-1"><NewBadge /></span>}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
