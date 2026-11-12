'use client'

import type { HistoryEntry, HistoryKind } from '@/lib/kouhou/domain/types'
import type { Tone } from '@/lib/kouhou/domain/labels'
import { useAppState } from '@/lib/kouhou/store/store'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { Pill } from '@/components/kouhou/kit/primitives'
import { UserName } from '@/components/kouhou/domain/tags'

const KIND_META: Record<HistoryKind, { label: string; tone: Tone }> = {
  created: { label: '作成', tone: 'neutral' },
  saved: { label: '保存', tone: 'neutral' },
  body_changed: { label: '本文変更', tone: 'info' },
  asset_changed: { label: '素材変更', tone: 'info' },
  schedule_changed: { label: '日時変更', tone: 'info' },
  editor_handover: { label: '編集権引き継ぎ', tone: 'warning' },
  edit_open_changed: { label: '編集許可', tone: 'neutral' },
  content_completed: { label: '内容承認依頼', tone: 'info' },
  content_approved: { label: '内容承認', tone: 'success' },
  content_auto_approved: { label: '内容自動承認', tone: 'success' },
  content_rejected: { label: '内容差し戻し', tone: 'danger' },
  candidates_proposed: { label: '候補提示', tone: 'info' },
  schedule_selected: { label: '日時確定', tone: 'success' },
  schedule_requested: { label: '日時承認依頼', tone: 'info' },
  schedule_approved: { label: '日時承認', tone: 'success' },
  schedule_rejected: { label: '日時差し戻し', tone: 'danger' },
  scheduled: { label: '予約確定', tone: 'success' },
  held: { label: '保留', tone: 'warning' },
  cancel_requested: { label: '取消申請', tone: 'warning' },
  cancelled: { label: '取り消し', tone: 'muted' },
  change_rejected: { label: '申請却下', tone: 'danger' },
  published: { label: '公開', tone: 'success' },
  failed: { label: '投稿失敗', tone: 'danger' },
  manual_recorded: { label: '手動記録', tone: 'muted' },
}

export function BeforeAfter({ before, after }: { before?: string; after?: string }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <div className="flex flex-col gap-1 rounded-md border border-danger/25 bg-danger-soft/50 p-2">
        <span className="text-xs font-bold text-danger">変更前</span>
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{before || '—'}</p>
      </div>
      <div className="flex flex-col gap-1 rounded-md border border-success/25 bg-success-soft/50 p-2">
        <span className="text-xs font-bold text-success">変更後</span>
        <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{after || '—'}</p>
      </div>
    </div>
  )
}

export function HistoryList({ postId, entries }: { postId?: string; entries?: HistoryEntry[] }) {
  const s = useAppState()
  const list = (entries ?? s.history.filter((h) => h.postId === postId)).slice().sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id, undefined, { numeric: true }))
  if (!list.length) return <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">履歴はまだありません</p>
  return (
    <ol className="flex flex-col">
      {list.map((h) => {
        const m = KIND_META[h.kind]
        return (
          <li key={h.id} className="flex gap-3 border-l-2 pb-4 pl-4 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Pill tone={m.tone}>{m.label}</Pill>
                <span className="tabular text-muted-foreground">{formatDateTime(h.at)}</span>
                <span className="text-muted-foreground">
                  <UserName s={s} id={h.actorId} />
                </span>
                <span className="font-mono tabular text-muted-foreground">v{h.version}</span>
              </div>
              <p className="text-sm leading-relaxed">{h.summary}</p>
              {(h.before !== undefined || h.after !== undefined) && (
                <details className="group">
                  <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">変更前後を見る</summary>
                  <div className="mt-2">
                    <BeforeAfter before={h.before} after={h.after} />
                  </div>
                </details>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
