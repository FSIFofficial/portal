'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, BookOpen, ChevronRight, FileText, Filter, GripVertical, Search, X } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import { can, isNew, type BootstrapData, type PortalDocument, type Tool } from '@/lib/types'
import { useAuth } from './auth-provider'
import { DocActions, DocCard, DocThumb } from './doc-card'
import type { Navigate } from './router'
import { DragHandle, ToolCard } from './tool-card'
import { Button, EmptyState, Select, useToast } from './ui'

const match = (text: string, query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const target = text.toLowerCase()
  return words.every((w) => target.includes(w))
}
const toolText = (t: Tool) => `${t.name} ${t.description} ${t.category}`
const docText = (d: PortalDocument) => `${d.title} ${d.description} ${d.keywords} ${d.type} ${d.tool} ${d.tags.join(' ')}`
const byDateDesc = (a: PortalDocument, b: PortalDocument) => b.date.localeCompare(a.date)

function useDocCounts(data: BootstrapData) {
  return useMemo(() => {
    const counts: Record<string, number> = {}
    data.documents.forEach((d) => (counts[d.tool] = (counts[d.tool] ?? 0) + 1))
    return counts
  }, [data.documents])
}

function SearchBox({ value, onChange, onSubmit, placeholder, large }: { value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string; large?: boolean }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.()
      }}
      className={large ? 'flex items-center gap-3 rounded-2xl border border-[#d9e8f3] bg-white p-3 shadow-[0_4px_16px_rgba(25,50,80,0.03)]' : 'flex flex-1 items-center gap-2 rounded-xl border border-[#dfe6ed] bg-white px-3'}
    >
      <Search className={large ? 'ml-2 text-[#7ca0bd]' : 'text-[#9aa8b8]'} size={large ? 19 : 16} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={large ? 'h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#99a8b7]' : 'h-10 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#a6b1bd]'}
      />
      {value && !large && (
        <button type="button" onClick={() => onChange('')} aria-label="検索をクリア" className="rounded p-1 text-[#9aa8b8] hover:bg-[#f3f6f9]"><X size={14} /></button>
      )}
      {large && <button type="submit" className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-[12px] font-bold text-white">検索</button>}
    </form>
  )
}

// ---------------------------------------------------------------------------
// ホーム
// ---------------------------------------------------------------------------

export function HomeView({ data, navigate }: { data: BootstrapData; navigate: Navigate }) {
  const toast = useToast()
  const [query, setQuery] = useState('')
  const counts = useDocCounts(data)
  const recent = useMemo(() => [...data.documents].sort(byDateDesc).slice(0, 4), [data.documents])
  const guide = data.documents.find((d) => d.pinned) ?? data.documents.find((d) => d.type === 'オンボーディング')
  // お気に入りを先頭に（選んだ順）、残りは管理者が決めた並び順で6件まで
  const favorites = data.me.favorites ?? []
  const homeTools = useMemo(() => {
    const favs = favorites.map((id) => data.tools.find((t) => t.id === id)).filter((t): t is Tool => !!t)
    return [...favs, ...data.tools.filter((t) => !favorites.includes(t.id))].slice(0, Math.max(6, favs.length))
  }, [data.tools, favorites])
  return (
    <>
      <div className="mb-8">
        <SearchBox large value={query} onChange={setQuery} onSubmit={() => navigate('/search', { q: query })} placeholder="ツールや資料を検索" />
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold">よく使うツール</h2>
          <p className="mt-1 text-[12px] text-[#8998a8]">{favorites.length ? '☆を付けたお気に入りのツールが先頭に表示されます' : 'ツールの☆を押すと、お気に入りとしてここに固定できます'}</p>
        </div>
        <button onClick={() => navigate('/tools')} className="flex items-center gap-1 text-[12px] font-bold text-[var(--brand)]">すべてのツール <ArrowRight size={14} /></button>
      </div>
      {data.tools.length === 0 ? (
        <EmptyState title="表示できるツールがありません" message="閲覧権限のあるツールが登録されるとここに表示されます。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {homeTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} docCount={counts[tool.name] ?? 0} restricted={tool.visibleRoles.length > 0} onDocs={() => navigate('/library', { tool: tool.name })} onMissingUrl={() => toast('このツールの接続先はまだ設定されていません')} />
          ))}
        </div>
      )}
      <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col rounded-2xl bg-[#173a62] p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold">はじめての方へ</span>
              <h2 className="mt-5 text-[20px] font-bold leading-8">まずはここから<br />ポータルを使いこなそう</h2>
              <p className="mt-3 text-[12px] leading-6 text-[#b9cee2]">{guide ? guide.description : 'FSIF Portalの基本と、よく使う機能を紹介します。'}</p>
            </div>
            <BookOpen className="shrink-0 text-[#75b7df]" size={32} />
          </div>
          <div className="mt-6">
            {guide && guide.driveUrl ? (
              <a href={guide.driveUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[12px] font-bold text-white">「{guide.title}」を見る <ArrowRight size={14} /></a>
            ) : (
              <button onClick={() => navigate('/library', { type: 'オンボーディング' })} className="flex items-center gap-2 text-[12px] font-bold text-white">スタートガイドを見る <ArrowRight size={14} /></button>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-[#e3e9ef] bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-bold">最近更新された資料</h2>
              <p className="mt-1 text-[12px] text-[#8a99a9]">最新の資料をチェック</p>
            </div>
            <FileText size={24} className="text-[#78a6c6]" />
          </div>
          <div className="mt-5 flex flex-col gap-3">
            {recent.length === 0 && <p className="text-[12px] text-[#8a99a9]">まだ資料がありません。</p>}
            {recent.map((doc) => (
              <button key={doc.id} onClick={() => navigate('/library', { q: doc.title })} className="flex items-center justify-between border-b border-[#eef1f4] pb-3 text-left last:border-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[#39536f]">{doc.title}</span>
                  <span className="mt-1 block text-[11px] text-[#9aa7b5]">{doc.type} · {doc.date}</span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-[#a9b5c2]" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ツール一覧（並べ替えは tools.manage 権限のある人のみ）
// ---------------------------------------------------------------------------

export function ToolsView({ data, navigate, initialQuery }: { data: BootstrapData; navigate: Navigate; initialQuery: string }) {
  const toast = useToast()
  const { run, refresh } = useAuth()
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState('')
  const [editing, setEditing] = useState(false)
  const [order, setOrder] = useState<Tool[]>(data.tools)
  const [dragId, setDragId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const counts = useDocCounts(data)
  const canSort = can(data.me, 'tools.manage')

  useEffect(() => setQuery(initialQuery), [initialQuery])
  useEffect(() => {
    if (!editing) setOrder(data.tools)
  }, [data.tools, editing])

  const categories = useMemo(() => [...new Set(data.tools.map((t) => t.category).filter(Boolean))], [data.tools])
  const visible = editing ? order : data.tools.filter((t) => match(toolText(t), query) && (!category || t.category === category))

  const move = (id: string, to: number) => {
    setOrder((prev) => {
      const from = prev.findIndex((t) => t.id === id)
      if (from < 0 || to < 0 || to >= prev.length || from === to) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await run((t) => api.reorderTools(t, order.map((x) => x.id), data.tools.map((x) => x.id)))
      await refresh()
      setEditing(false)
      toast('並び順を保存しました')
    } catch (e) {
      toast((e as Error).message, 'error')
      if (e instanceof ApiError && e.code === 'CONFLICT') {
        await refresh().catch(() => {})
        setEditing(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        {editing ? (
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-[var(--brand-soft)] px-4 py-2.5 text-[12px] font-semibold text-[#285b82]">
            <GripVertical size={15} />ドラッグ、または矢印ボタンで並べ替えて「保存」してください。ホームには上から6件が表示されます。
          </div>
        ) : (
          <>
            <SearchBox value={query} onChange={setQuery} placeholder="名称・用途・カテゴリで検索" />
            <div className="flex items-center gap-2">
              <Filter size={15} className="text-[#7890a5]" />
              <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="カテゴリ" className="w-auto min-w-[150px]">
                <option value="">すべてのカテゴリ</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </>
        )}
        {canSort && (
          editing ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>キャンセル</Button>
              <Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => { setOrder(data.tools); setEditing(true) }}>並べ替え<GripVertical size={15} /></Button>
          )
        )}
      </div>
      {!editing && <p className="mb-4 text-[12px] text-[#8b99a8]">{visible.length}件のツール</p>}
      {visible.length === 0 ? (
        <EmptyState title="ツールが見つかりません" message="検索条件を変えてお試しください。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((tool, index) => (
            <div
              key={tool.id}
              draggable={editing}
              onDragStart={() => setDragId(tool.id)}
              onDragOver={(e) => {
                if (!editing || !dragId) return
                e.preventDefault()
                if (dragId !== tool.id) move(dragId, index)
              }}
              onDragEnd={() => setDragId(null)}
              className={editing && dragId === tool.id ? 'opacity-50' : undefined}
            >
              <ToolCard
                tool={tool}
                docCount={counts[tool.name] ?? 0}
                restricted={tool.visibleRoles.length > 0}
                onDocs={() => navigate('/library', { tool: tool.name })}
                onMissingUrl={() => toast('接続先未設定：管理画面からURLを設定すると利用できます')}
                dragHandle={editing ? (
                  <>
                    <DragHandle label={`${tool.name}を並べ替え`} />
                    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1 rounded-lg border border-[#dbe4ec] bg-white p-1 shadow-sm">
                      <span className="px-1.5 py-1 text-[11px] font-bold text-[#7890a5]">{index + 1}</span>
                      <button onClick={() => move(tool.id, index - 1)} disabled={index === 0} aria-label="前へ" className="rounded p-1 text-[#55708b] hover:bg-[#f1f5f8] disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button onClick={() => move(tool.id, index + 1)} disabled={index === visible.length - 1} aria-label="後ろへ" className="rounded p-1 text-[#55708b] hover:bg-[#f1f5f8] disabled:opacity-30"><ArrowDown size={14} /></button>
                    </div>
                  </>
                ) : undefined}
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// 資料館（Google Drive へのリンク＋ダウンロード）
// ---------------------------------------------------------------------------

export function LibraryView({ data, navigate, params }: { data: BootstrapData; navigate: Navigate; params: URLSearchParams }) {
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [type, setType] = useState(params.get('type') ?? '')
  const [tool, setTool] = useState(params.get('tool') ?? '')
  const [sort, setSort] = useState<'date' | 'title' | 'popular'>('date')
  const [onlyNew, setOnlyNew] = useState(params.get('new') === '1')
  const newCount = data.documents.filter((d) => isNew(d, data.me)).length
  const pop = (d: PortalDocument) => data.popularity?.[`doc:${d.id}`] ?? 0

  useEffect(() => {
    setQuery(params.get('q') ?? '')
    setType(params.get('type') ?? '')
    setTool(params.get('tool') ?? '')
    setOnlyNew(params.get('new') === '1')
  }, [params])

  const types = useMemo(() => [...new Set(data.documents.map((d) => d.type).filter(Boolean))], [data.documents])
  const toolNames = useMemo(() => [...new Set(data.documents.map((d) => d.tool).filter(Boolean))], [data.documents])
  const filtered = data.documents
    .filter((d) => match(docText(d), query) && (!type || d.type === type) && (!tool || d.tool === tool) && (!onlyNew || isNew(d, data.me)))
    .sort(sort === 'date' ? byDateDesc : sort === 'popular' ? (a, b) => pop(b) - pop(a) || byDateDesc(a, b) : (a, b) => a.title.localeCompare(b.title, 'ja'))
  const pinned = !query && !type && !tool ? filtered.filter((d) => d.pinned).slice(0, 1)[0] : undefined
  const list = pinned ? filtered.filter((d) => d.id !== pinned.id) : filtered
  const hasFilter = query || type || tool || onlyNew

  return (
    <>
      {pinned && (
        <article className="mb-6 grid gap-5 overflow-hidden rounded-2xl border border-[#d9e8f3] bg-white p-5 sm:grid-cols-[1fr_320px]">
          <div className="flex flex-col">
            <span className="w-fit rounded-full bg-[#fff0e5] px-2.5 py-1 text-[10px] font-bold text-[#c2410c]">ピックアップ</span>
            <h2 className="mt-3 text-[18px] font-bold">{pinned.title}</h2>
            <p className="mt-1 text-[11px] text-[#7d8c9d]">{pinned.date} · {pinned.type}</p>
            <div className="mt-2 flex flex-wrap gap-1">{pinned.tags.map((t) => <span key={t} className="rounded border border-[#d5e3ef] px-1.5 py-0.5 text-[10px] text-[#55708b]">{t}</span>)}</div>
            <p className="mt-3 text-[13px] leading-6 text-[#52677d]">{pinned.description}</p>
            <div className="mt-auto pt-4"><DocActions doc={pinned} /></div>
          </div>
          <DocThumb doc={pinned} className="h-44 w-full rounded-xl border border-[#e4e9f0]" />
        </article>
      )}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <SearchBox value={query} onChange={setQuery} placeholder="資料名・概要・キーワードで検索" />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="種類" className="sm:w-[150px]">
            <option value="">すべての種類</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={tool} onChange={(e) => setTool(e.target.value)} aria-label="関連ツール" className="sm:w-[170px]">
            <option value="">すべてのツール</option>
            {toolNames.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'title' | 'popular')} aria-label="並び順" className="sm:w-[150px]">
            <option value="date">更新日が新しい順</option>
            <option value="title">名称順</option>
            <option value="popular">よく見られている順</option>
          </Select>
          {newCount > 0 && (
            <button onClick={() => setOnlyNew(!onlyNew)} aria-pressed={onlyNew} className={`h-10 whitespace-nowrap rounded-lg border px-3 text-[12px] font-bold ${onlyNew ? 'border-[#e5484d] bg-[#e5484d] text-white' : 'border-[#f3c4c4] bg-white text-[#c0373c]'}`}>
              新着のみ（{newCount}）
            </button>
          )}
          {hasFilter && <Button variant="secondary" onClick={() => { setOnlyNew(false); navigate('/library') }}>リセット</Button>}
        </div>
      </div>
      <p className="mb-4 text-[12px] font-bold text-[#38536f]">資料一覧 <span className="font-semibold text-[var(--brand)]">{filtered.length}件</span></p>
      {list.length === 0 && !pinned ? (
        <EmptyState title="資料が見つかりません" message="検索条件を変えてお試しください。" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((doc) => <DocCard key={doc.id} doc={doc} restricted={doc.visibleRoles.length > 0} />)}
        </div>
      )}
      <p className="mt-6 text-[11px] leading-5 text-[#9aa7b5]">※ 資料はGoogle Driveに保存されています。開けない場合はDrive側の共有設定を担当者にご確認ください。</p>
    </>
  )
}

// ---------------------------------------------------------------------------
// 横断検索
// ---------------------------------------------------------------------------

export function SearchView({ data, navigate, query }: { data: BootstrapData; navigate: Navigate; query: string }) {
  const toast = useToast()
  const [q, setQ] = useState(query)
  useEffect(() => setQ(query), [query])
  const counts = useDocCounts(data)
  const tools = data.tools.filter((t) => match(toolText(t), query))
  const docs = data.documents.filter((d) => match(docText(d), query)).sort(byDateDesc)
  return (
    <>
      <div className="mb-6"><SearchBox large value={q} onChange={setQ} onSubmit={() => navigate('/search', { q })} placeholder="ツールや資料を検索" /></div>
      <h2 className="mb-3 text-[15px] font-bold">ツール <span className="text-[12px] font-semibold text-[var(--brand)]">{tools.length}件</span></h2>
      {tools.length === 0 ? <p className="mb-8 text-[12px] text-[#8a99a9]">該当するツールはありません。</p> : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => <ToolCard key={tool.id} tool={tool} docCount={counts[tool.name] ?? 0} restricted={tool.visibleRoles.length > 0} onDocs={() => navigate('/library', { tool: tool.name })} onMissingUrl={() => toast('このツールの接続先はまだ設定されていません')} />)}
        </div>
      )}
      <h2 className="mb-3 text-[15px] font-bold">資料 <span className="text-[12px] font-semibold text-[var(--brand)]">{docs.length}件</span></h2>
      {docs.length === 0 ? <p className="text-[12px] text-[#8a99a9]">該当する資料はありません。</p> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc) => <DocCard key={doc.id} doc={doc} restricted={doc.visibleRoles.length > 0} />)}
        </div>
      )}
    </>
  )
}
