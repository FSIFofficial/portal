'use client'

// お知らせ一覧：閉じたもの・掲載が終わったものも含めて読み返せる
import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Announcement, BootstrapData } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-provider'
import { EmptyState, NewBadge, useToast } from './ui'

const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

export function AnnouncementsView({ data }: { data: BootstrapData }) {
  const { run, patchData } = useAuth()
  const toast = useToast()
  const [acking, setAcking] = useState('')
  const list = data.announcementArchive ?? data.announcements
  const acks = data.me.acks ?? []
  const d = today()

  const ack = async (a: Announcement) => {
    setAcking(a.id)
    try {
      await run((t) => api.ackAnnouncement(t, a.id))
      patchData((x) => ({ ...x, me: { ...x.me, acks: [...(x.me.acks ?? []), a.id] } }))
      toast('確認済みにしました')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setAcking('')
    }
  }

  if (!list.length) return <EmptyState title="お知らせはまだありません" />

  return (
    <div className="flex max-w-[860px] flex-col gap-3">
      {list.map((a) => {
        const ended = !!a.endDate && a.endDate < d
        const date = a.startDate || a.updatedAt.slice(0, 10)
        const needsAck = a.requireAck && !acks.includes(a.id)
        const isNewItem = !!data.me.newSince && a.updatedAt > data.me.newSince
        return (
          <article key={a.id} className={cn('rounded-2xl border bg-white p-5', a.level === 'important' && !ended ? 'border-[#f0c9c6]' : 'border-[#e4e9f0]', ended && 'opacity-75')}>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {a.level === 'important' ? (
                <span className="rounded bg-[#f7d8d6] px-1.5 py-0.5 font-bold text-[#a13b3b]">重要</span>
              ) : (
                <span className="rounded bg-[var(--brand-soft)] px-1.5 py-0.5 font-bold text-[var(--brand)]">お知らせ</span>
              )}
              <span className="text-[#8a99a9]">{date}</span>
              {ended && <span className="rounded bg-[#eef1f5] px-1.5 py-0.5 font-semibold text-[#6b7785]">掲載終了</span>}
              {isNewItem && <NewBadge />}
            </div>
            <h2 className="mt-2 text-[16px] font-bold text-[#1b304b]">{a.title}</h2>
            {a.body && <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-[#52677d]">{a.body}</p>}
            {a.requireAck && (
              <div className="mt-3">
                {needsAck ? (
                  <button onClick={() => void ack(a)} disabled={acking === a.id} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-2 text-[12px] font-bold text-white hover:bg-[var(--brand-dark)] disabled:opacity-60">
                    <CheckCircle2 size={14} />{acking === a.id ? '送信中…' : '確認しました'}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1c7a43]"><CheckCircle2 size={14} />確認済み</span>
                )}
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
