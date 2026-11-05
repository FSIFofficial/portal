'use client'

// 管理画面の各セクションで共通に使う部品
import { useState, type ReactNode } from 'react'
import { Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from './ui'

export const fmt = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) : '—')

export type Mutate = (fn: (token: string) => Promise<unknown>, message: string) => Promise<boolean>

export function SectionHeader({ section, action, loading, onReload }: { section: { label: string; description: string }; action?: ReactNode; loading: boolean; onReload: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#edf0f3] p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[16px] font-bold">{section.label}</h2>
        <p className="mt-1 text-[12px] text-[#8998a8]">{section.description}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="ghost" onClick={onReload} aria-label="再読み込み" disabled={loading}><RefreshCw size={15} className={loading ? 'animate-spin' : undefined} /></Button>
        {action}
      </div>
    </div>
  )
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-[12px]">
        <thead className="bg-[#fafbfd] text-[#8998a8]">
          <tr>{head.map((h, i) => <th key={i} className="px-5 py-3 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <p className="p-10 text-center text-[12px] text-[#8a99a9]">まだ登録がありません。</p>}
    </div>
  )
}

export function RowActions({ onEdit, onDelete, label }: { onEdit: () => void; onDelete?: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-1">
      <button onClick={onEdit} aria-label={`${label}を編集`} className="rounded-lg p-2 text-[#7890a5] hover:bg-[#f1f5f8]"><Pencil size={15} /></button>
      {onDelete && <button onClick={onDelete} aria-label={`${label}を削除`} className="rounded-lg p-2 text-[#b42318] hover:bg-[#fff5f4]"><Trash2 size={15} /></button>}
    </div>
  )
}

/** 編集モーダルの共通状態 */
export function useEditor<T>() {
  const [draft, setDraft] = useState<T | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const open = (value: T, fresh = false) => {
    setDraft(value)
    setIsNew(fresh)
  }
  const set = <K extends keyof T>(key: K, value: T[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))
  return { draft, isNew, saving, setSaving, open, close: () => setDraft(null), set }
}

export function ModalFooter({ onCancel, onSave, saving }: { onCancel: () => void; onSave: () => void; saving: boolean }) {
  return (
    <>
      <Button variant="secondary" onClick={onCancel} disabled={saving}>キャンセル</Button>
      <Button onClick={onSave} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>
    </>
  )
}

export const confirmDelete = (name: string) => window.confirm(`「${name}」を削除します。よろしいですか？\nこの操作は取り消せません。`)

