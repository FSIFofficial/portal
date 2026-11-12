'use client'

import { useState } from 'react'
import { Check, FileText, ImagePlus, X } from 'lucide-react'
import type { AssetKind } from '@/lib/kouhou/domain/types'
import { useAppState } from '@/lib/kouhou/store/store'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Segmented } from '@/components/kouhou/kit/primitives'
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
}: {
  brandId: string
  selected: string[]
  onChange: (ids: string[]) => void
  onInsertText: (text: string) => void
  disabled?: boolean
}) {
  const s = useAppState()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [draft, setDraft] = useState<string[]>(selected)

  const kindsFor: Record<Filter, AssetKind[]> = { all: ['image', 'video', 'logo', 'text'], image: ['image', 'video', 'logo'], template: ['image'], text: ['text'] }
  const list = s.assets.filter(
    (a) => a.brandId === brandId && a.kind !== 'background' && kindsFor[filter].includes(a.kind) && (filter !== 'template' || !!a.edit),
  )

  const openPicker = () => {
    setDraft(selected)
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
        description="このブランドの素材・テンプレート編集済み画像から選べます。テキスト素材は本文に挿入します。"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={() => {
                onChange(draft)
                setOpen(false)
              }}
            >
              {draft.length}件を添付
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
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
          {list.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">該当する素材はありません</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((a) => {
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
                      <span className="truncate text-xs text-muted-foreground">{a.edit ? 'テンプレート編集' : a.purpose}</span>
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
