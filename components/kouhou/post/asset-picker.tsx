'use client'

import { useState } from 'react'
import { Check, FileText, ImagePlus, X } from 'lucide-react'
import type { AssetKind } from '@/lib/kouhou/domain/types'
import { useAppState } from '@/lib/kouhou/store/store'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Input, Segmented, Select } from '@/components/kouhou/kit/primitives'
import { UploadZone, useImageUploader } from '@/components/kouhou/assets/upload-zone'
import { AssetThumb } from '@/components/kouhou/domain/asset-thumb'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'image' | 'template' | 'text'

export function AssetStrip({ assetIds, onRemove, disabled }: { assetIds: string[]; onRemove?: (id: string) => void; disabled?: boolean }) {
  const s = useAppState()
  if (!assetIds.length) return null
  return (
    <ul className="flex flex-wrap gap-2" aria-label="添付素材">
      {assetIds.map((id) => {
        const a = s.assets.find((x) => x.id === id)
        if (!a) return null
        return (
          <li key={id} className="relative w-20">
            <AssetThumb s={s} asset={a} className="rounded-md border" />
            <span className="mt-1 block truncate text-xs text-muted-foreground">{a.name}</span>
            {onRemove && !disabled && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                aria-label={`${a.name} を外す`}
                className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-muted"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function AssetPicker({
  brandId,
  selected,
  onChange,
  onInsertText,
  disabled,
  uploadGroup = '投稿用',
}: {
  brandId: string
  selected: string[]
  onChange: (ids: string[]) => void
  onInsertText: (text: string) => void
  disabled?: boolean
  /** ここでアップロードした画像のグループ */
  uploadGroup?: string
}) {
  const s = useAppState()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [brand, setBrand] = useState<string>('all')
  const [group, setGroup] = useState('')
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<string[]>(selected)
  const uploader = useImageUploader(
    () => ({ kind: 'image', brandId, purpose: group || uploadGroup }),
    (id) => setDraft((d) => (d.includes(id) ? d : [...d, id])),
  )

  // グループ・ブランドを分けた後でも、どの画像も選べる（このブランドの素材を先に並べる）
  const kindsFor: Record<Filter, AssetKind[]> = { all: ['image', 'video', 'logo', 'background', 'text'], image: ['image', 'video', 'logo', 'background'], template: ['image'], text: ['text'] }
  const pool = s.assets.filter((a) => kindsFor[filter].includes(a.kind) && (filter !== 'template' || !!a.edit) && (brand === 'all' || a.brandId === brand))
  const groups = [...new Set(pool.map((a) => a.purpose))].sort((a, b) => a.localeCompare(b, 'ja'))
  const needle = q.trim().toLowerCase()
  const list = pool
    .filter((a) => !group || a.purpose === group)
    .filter((a) => !needle || [a.name, a.purpose].some((t) => t.toLowerCase().includes(needle)))
    .sort((a, b) => Number(b.brandId === brandId) - Number(a.brandId === brandId) || Number(draft.includes(b.id)) - Number(draft.includes(a.id)) || b.updatedAt.localeCompare(a.updatedAt))

  const openPicker = () => {
    setDraft(selected)
    setGroup('')
    setQ('')
    uploader.clear()
    setOpen(true)
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openPicker} disabled={disabled}>
        <ImagePlus aria-hidden />
        素材を選ぶ
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="素材を選ぶ"
        description="グループやブランドで絞り込めます。新しい画像はここからアップロードすると、そのまま選ばれます。テキスト素材は本文に挿入します。"
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              disabled={uploader.busy}
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
            >
              {uploader.busy ? 'アップロード中…' : `${draft.length}件を添付`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <UploadZone uploader={uploader} compact label="新しい画像をアップロード（ドロップ・クリック・貼り付け）" hint={`グループ「${group || uploadGroup}」に入ります`} />
          <div className="flex flex-col gap-2">
            <Segmented
              label="素材の種類"
              size="sm"
              value={filter}
              onChange={setFilter}
              items={[
                { value: 'all', label: 'すべて' },
                { value: 'image', label: '画像・動画' },
                { value: 'template', label: 'テンプレート' },
                { value: 'text', label: 'テキスト' },
              ]}
            />
            <div className="grid gap-2 sm:grid-cols-3">
              <Input aria-label="素材名・グループで検索" placeholder="素材名・グループで検索" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select aria-label="グループで絞り込み" value={group} onChange={(e) => setGroup(e.target.value)}>
                <option value="">すべてのグループ</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}（{pool.filter((a) => a.purpose === g).length}）
                  </option>
                ))}
              </Select>
              <Select aria-label="ブランドで絞り込み" value={brand} onChange={(e) => setBrand(e.target.value)}>
                <option value="all">すべてのブランド</option>
                {s.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {list.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">該当する素材はありません</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((a) => {
                const other = a.brandId !== brandId ? s.brands.find((b) => b.id === a.brandId)?.name : null
                if (a.kind === 'text') {
                  return (
                    <li key={a.id} className="flex flex-col gap-2 rounded-md border p-2">
                      <AssetThumb s={s} asset={a} className="rounded" />
                      <span className="truncate text-xs font-medium">{a.name}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onInsertText(a.text ?? '')
                          setOpen(false)
                        }}
                      >
                        <FileText aria-hidden />
                        本文に挿入
                      </Button>
                    </li>
                  )
                }
                const on = draft.includes(a.id)
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={a.name}
                      onClick={() => setDraft((d) => (on ? d.filter((x) => x !== a.id) : [...d, a.id]))}
                      className={cn('flex w-full flex-col gap-1.5 rounded-md border p-2 text-left transition-colors hover:bg-muted', on && 'border-primary ring-2 ring-primary/30')}
                    >
                      <span className="relative block">
                        <AssetThumb s={s} asset={a} className="rounded" />
                        {on && (
                          <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="size-4" aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs font-medium">{a.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {a.edit ? 'テンプレート編集' : a.purpose}
                        {other ? `・${other}` : ''}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  )
}
