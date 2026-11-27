'use client'

// 画像をドロップ・選択・貼り付けでアップロードして、素材に登録する場所。何枚でもまとめて入れられる。

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ImageUp, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isImageFile, uploadOne, type UploadMeta } from '@/lib/kouhou/upload'

type Item = { key: number; name: string; preview: string; state: 'waiting' | 'uploading' | 'done' | 'error'; message?: string }

let seq = 0

/** 貼り付け・ドロップのデータから画像ファイルを取り出す */
export function imageFilesOf(data: DataTransfer | null): File[] {
  if (!data) return []
  return [...data.files].filter(isImageFile)
}

export function useImageUploader(meta: () => UploadMeta | string, onUploaded: (id: string) => void) {
  const [items, setItems] = useState<Item[]>([])
  const queue = useRef(Promise.resolve())
  const latest = useRef({ meta, onUploaded })
  latest.current = { meta, onUploaded }
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.preview)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (key: number, p: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)))
  const add = (files: File[]) => {
    const images = files.filter(isImageFile)
    if (!images.length) return
    const added = images.map((f) => ({ key: ++seq, name: f.name || '貼り付けた画像', preview: URL.createObjectURL(f), state: 'waiting' as const, file: f }))
    setItems((list) => [...list.filter((i) => i.state !== 'done'), ...added.map(({ file: _f, ...i }) => i)])
    for (const it of added) {
      queue.current = queue.current.then(async () => {
        const m = latest.current.meta()
        if (typeof m === 'string') {
          patch(it.key, { state: 'error', message: m })
          return
        }
        patch(it.key, { state: 'uploading' })
        try {
          const name = it.file.name ? undefined : `貼り付け ${new Date().toLocaleString('ja-JP')}`
          const r = await uploadOne(it.file, m, name)
          patch(it.key, { state: 'done', message: r.resized ? '送信できる大きさに縮めました' : undefined })
          latest.current.onUploaded(r.id)
        } catch (e) {
          patch(it.key, { state: 'error', message: e instanceof Error ? e.message : 'アップロードできませんでした' })
        }
      })
    }
  }
  const busy = items.some((i) => i.state === 'waiting' || i.state === 'uploading')
  return { items, add, busy, clear: () => setItems([]) }
}

export function UploadZone({
  uploader,
  label = '画像をここにドロップ、またはクリックして選ぶ',
  hint = '何枚でもまとめて入れられます。コピーした画像は、ここを選んで貼り付け（Ctrl+V / ⌘V）もできます。大きい写真は自動で縮めます',
  compact,
  disabled,
}: {
  uploader: ReturnType<typeof useImageUploader>
  label?: string
  hint?: string
  compact?: boolean
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={label}
        onClick={() => !disabled && input.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            input.current?.click()
          }
        }}
        onPaste={(e) => {
          const files = imageFilesOf(e.clipboardData)
          if (disabled || !files.length) return
          e.preventDefault()
          uploader.add(files)
        }}
        onDragOver={(e) => {
          if (disabled) return
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!disabled) uploader.add(imageFilesOf(e.dataTransfer))
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-center transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-primary focus-visible:outline-none',
          compact ? 'px-3 py-3' : 'px-4 py-8',
          over && 'border-primary bg-primary/10',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <ImageUp className={cn('text-muted-foreground', compact ? 'size-5' : 'size-7')} aria-hidden />
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <input
          ref={input}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          hidden
          onChange={(e) => {
            uploader.add([...(e.target.files ?? [])])
            e.target.value = ''
          }}
        />
      </div>
      {uploader.items.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label="アップロードの状況">
          {uploader.items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.preview} alt="" className="size-8 shrink-0 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate">{i.name}</span>
              {i.state === 'waiting' && <span className="text-muted-foreground">待機中</span>}
              {i.state === 'uploading' && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  アップロード中
                </span>
              )}
              {i.state === 'done' && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  完了{i.message ? `（${i.message}）` : ''}
                </span>
              )}
              {i.state === 'error' && (
                <span className="flex max-w-[60%] items-center gap-1 text-danger">
                  <XCircle className="size-3.5 shrink-0" aria-hidden />
                  {i.message}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
