'use client'

import { ExternalLink, GripVertical, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { isNew, type Tool } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth, useTrack } from './auth-provider'
import { NewBadge, StatusBadge, ToolIcon, useToast } from './ui'

/** お気に入りの切り替え。画面にはすぐ反映し、保存に失敗したら元に戻す */
export function useFavorites() {
  const { data, patchData, run } = useAuth()
  const toast = useToast()
  const favorites = data?.me.favorites ?? []
  const toggle = async (id: string) => {
    const before = favorites
    const next = before.includes(id) ? before.filter((x) => x !== id) : [...before, id]
    patchData((d) => ({ ...d, me: { ...d.me, favorites: next } }))
    try {
      await run((t) => api.setFavorites(t, next))
    } catch (e) {
      patchData((d) => ({ ...d, me: { ...d.me, favorites: before } }))
      toast((e as Error).message, 'error')
    }
  }
  return { favorites, toggle }
}

function FavoriteButton({ tool }: { tool: Tool }) {
  const { favorites, toggle } = useFavorites()
  const on = favorites.includes(tool.id)
  return (
    <button
      onClick={() => void toggle(tool.id)}
      aria-pressed={on}
      aria-label={on ? `${tool.name}をお気に入りから外す` : `${tool.name}をお気に入りに追加`}
      title={on ? 'お気に入りから外す' : 'お気に入りに追加（ホームの先頭に表示されます）'}
      className={cn('rounded-lg p-1.5 transition hover:bg-[#fff8e6]', on ? 'text-[#e5a00d]' : 'text-[#c2ccd6] hover:text-[#e5a00d]')}
    >
      <Star size={17} fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}

export function ToolCard({ tool, docCount, onDocs, onMissingUrl, dragHandle, restricted }: {
  tool: Tool
  docCount: number
  onDocs: () => void
  onMissingUrl: () => void
  dragHandle?: React.ReactNode
  restricted?: boolean
}) {
  const track = useTrack()
  const { data } = useAuth()
  const disabled = tool.status !== '稼働中'
  const openButtonClass = 'flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[var(--brand-dark)]'
  return (
    <article className="group relative flex min-h-[230px] flex-col rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_16px_rgba(25,50,80,0.04)] transition hover:-translate-y-0.5 hover:border-[#c8d7e9] hover:shadow-[0_10px_28px_rgba(25,50,80,0.08)]">
      {dragHandle}
      <div className="flex items-start justify-between gap-2">
        <ToolIcon name={tool.icon} tone={tool.tone} src={tool.iconUrl} />
        <div className="flex flex-col items-end gap-1.5">
          {!dragHandle && (
            <div className="flex items-center gap-1">
              <FavoriteButton tool={tool} />
              <StatusBadge status={tool.status} />
            </div>
          )}
          {restricted && <span className="rounded-full bg-[#fff5df] px-2 py-0.5 text-[10px] font-semibold text-[#92400e]">限定公開</span>}
        </div>
      </div>
      <h3 className="mt-4 flex items-center gap-2 text-[16px] font-bold text-[#1b304b]">{tool.name}{isNew(tool, data?.me) && <NewBadge />}</h3>
      <p className="mt-1 text-[13px] leading-6 text-[#718096]">{tool.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="truncate rounded-md bg-[#f5f7fa] px-2 py-1 text-[11px] text-[#718096]">{tool.category || 'その他'}</span>
        <div className="flex shrink-0 items-center gap-2">
          {docCount > 0 && (
            <button onClick={onDocs} className="text-[12px] font-semibold text-[#4f6b88] hover:text-[var(--brand)]">使い方</button>
          )}
          {disabled ? (
            <span className="rounded-lg bg-[#dfe5eb] px-3 py-2 text-[12px] font-semibold text-[#6b7785]">{tool.status}</span>
          ) : tool.url ? (
            <a href={tool.url} target="_blank" rel="noopener noreferrer" onClick={() => track('tool', tool.id)} className={openButtonClass}>開く<ExternalLink size={13} /></a>
          ) : (
            <button onClick={onMissingUrl} className={openButtonClass}>開く<ExternalLink size={13} /></button>
          )}
        </div>
      </div>
    </article>
  )
}

export function DragHandle({ label }: { label: string }) {
  return (
    <span aria-label={label} className="absolute right-3 top-3 cursor-grab rounded-lg p-1.5 text-[#9aa8b8] hover:bg-[#f3f6f9]">
      <GripVertical size={18} />
    </span>
  )
}
