'use client'

import { ExternalLink, GripVertical } from 'lucide-react'
import type { Tool } from '@/lib/types'
import { StatusBadge, ToolIcon } from './ui'

export function ToolCard({ tool, docCount, onDocs, onMissingUrl, dragHandle, restricted }: {
  tool: Tool
  docCount: number
  onDocs: () => void
  onMissingUrl: () => void
  dragHandle?: React.ReactNode
  restricted?: boolean
}) {
  const disabled = tool.status !== '稼働中'
  const openButtonClass = 'flex items-center gap-1.5 rounded-lg bg-[#1f6fba] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#185c9d]'
  return (
    <article className="group relative flex min-h-[230px] flex-col rounded-2xl border border-[#e4e9f0] bg-white p-5 shadow-[0_4px_16px_rgba(25,50,80,0.04)] transition hover:-translate-y-0.5 hover:border-[#c8d7e9] hover:shadow-[0_10px_28px_rgba(25,50,80,0.08)]">
      {dragHandle}
      <div className="flex items-start justify-between gap-2">
        <ToolIcon name={tool.icon} tone={tool.tone} />
        <div className="flex flex-col items-end gap-1.5">
          {!dragHandle && <StatusBadge status={tool.status} />}
          {restricted && <span className="rounded-full bg-[#fff5df] px-2 py-0.5 text-[10px] font-semibold text-[#92400e]">限定公開</span>}
        </div>
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-[#1b304b]">{tool.name}</h3>
      <p className="mt-1 text-[13px] leading-6 text-[#718096]">{tool.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="truncate rounded-md bg-[#f5f7fa] px-2 py-1 text-[11px] text-[#718096]">{tool.category || 'その他'}</span>
        <div className="flex shrink-0 items-center gap-2">
          {docCount > 0 && (
            <button onClick={onDocs} className="text-[12px] font-semibold text-[#4f6b88] hover:text-[#1e6db8]">使い方</button>
          )}
          {disabled ? (
            <span className="rounded-lg bg-[#dfe5eb] px-3 py-2 text-[12px] font-semibold text-[#6b7785]">{tool.status}</span>
          ) : tool.url ? (
            <a href={tool.url} target="_blank" rel="noopener noreferrer" className={openButtonClass}>開く<ExternalLink size={13} /></a>
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
