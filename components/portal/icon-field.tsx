'use client'

// アイコン画像の入力欄。URLを貼るか画像をアップロードすると、表示する位置と大きさを決める画面が開く。

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Crop, Minus, Plus, RotateCcw } from 'lucide-react'
import { imageUrl } from '@/lib/drive'
import { cropStyle, DEFAULT_CROP, isDefaultCrop, joinIconUrl, MAX_ZOOM, normalizeCrop, splitIconUrl, type IconCrop } from '@/lib/icon'
import { Button, Modal, TextInput } from './ui'
import { UploadButton } from './admin-extra'

const looksLikeUrl = (s: string) => /^https?:\/\/\S+$/i.test(s.trim())

export function IconImageField({ value, onChange, preview, placeholder }: {
  value: string
  onChange: (v: string) => void
  /** 今の値で表示したアイコン（ツールとリンクで見た目が違うので呼び出し側で描く） */
  preview: (value: string) => ReactNode
  placeholder?: string
}) {
  const { src, crop } = splitIconUrl(value)
  const [adjusting, setAdjusting] = useState(false)
  return (
    <>
      <div className="flex items-center gap-3">
        {preview(value)}
        <TextInput
          type="url"
          aria-label="アイコン画像のURL"
          placeholder={placeholder}
          value={src}
          // URLを変えたら位置は中央に戻す（別の画像に前の位置を当てても合わないため）
          onChange={(e) => onChange(joinIconUrl(e.target.value, null))}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (looksLikeUrl(text)) {
              e.preventDefault()
              onChange(joinIconUrl(text, null))
              setAdjusting(true)
            }
          }}
        />
        {src && <Button variant="ghost" onClick={() => onChange('')}>クリア</Button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <UploadButton purpose="icon" label="画像をアップロード" onUploaded={(res) => { onChange(res.url); setAdjusting(true) }} />
        <Button variant="secondary" type="button" disabled={!looksLikeUrl(src)} onClick={() => setAdjusting(true)}>
          <Crop size={14} />位置を調整
        </Button>
        {!isDefaultCrop(crop) && <span className="text-[11px] text-[#5b6b7c]">位置を調整済み（{Math.round((crop?.zoom ?? 1) * 100)}%）</span>}
      </div>
      {adjusting && looksLikeUrl(src) && (
        <IconCropModal
          src={src}
          initial={crop ?? DEFAULT_CROP}
          preview={(c) => preview(joinIconUrl(src, c))}
          onCancel={() => setAdjusting(false)}
          onSave={(c) => { onChange(joinIconUrl(src, c)); setAdjusting(false) }}
        />
      )}
    </>
  )
}

const BOX = 240

/**
 * 画像をドラッグして位置を、スライダーで大きさを決める。
 * 表示側と同じ CSS（object-position + scale）で描くので、ここで見えたとおりにアイコンに表示される。
 */
export function IconCropModal({ src, initial, preview, onCancel, onSave }: {
  src: string
  initial: IconCrop
  preview: (c: IconCrop) => ReactNode
  onCancel: () => void
  onSave: (c: IconCrop) => void
}) {
  const [crop, setCrop] = useState<IconCrop>(initial)
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const drag = useRef<{ px: number; py: number; start: IconCrop } | null>(null)
  const url = imageUrl(src, 800)
  useEffect(() => { setFailed(false); setNatural(null) }, [url])

  // 画像の端が枠の外にどれだけはみ出しているか（px）。ドラッグ量を位置（%）に直すのに使う
  const overflow = () => {
    if (!natural) return { x: 0, y: 0 }
    const s = BOX / Math.min(natural.w, natural.h)
    return { x: natural.w * s * crop.zoom - BOX, y: natural.h * s * crop.zoom - BOX }
  }
  const move = (dx: number, dy: number, start: IconCrop) => {
    const o = overflow()
    setCrop(normalizeCrop({ ...start, x: o.x > 0.5 ? start.x - (dx / o.x) * 100 : start.x, y: o.y > 0.5 ? start.y - (dy / o.y) * 100 : start.y }))
  }
  const zoomTo = (z: number) => setCrop((c) => normalizeCrop({ ...c, zoom: z }))

  return (
    <Modal
      title="アイコンの位置を調整"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>キャンセル</Button>
          <Button onClick={() => onSave(normalizeCrop(crop))} disabled={failed}>この位置にする</Button>
        </>
      }
    >
      {failed ? (
        <p className="rounded-lg bg-[#fff1f0] px-3 py-2 text-[12px] leading-5 text-[#b42318]">
          画像を読み込めませんでした。URLが画像を指しているか、Driveの場合は「リンクを知っている全員」が見られる共有設定になっているか確認してください。
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div>
            <div
              role="application"
              tabIndex={0}
              aria-label="アイコンの表示範囲。ドラッグするか矢印キーで位置を動かします"
              className="relative cursor-grab touch-none overflow-hidden rounded-2xl border border-[#dbe3ec] bg-[#f5f7fa] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] active:cursor-grabbing"
              style={{ width: BOX, height: BOX }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = { px: e.clientX, py: e.clientY, start: crop }
              }}
              onPointerMove={(e) => drag.current && move(e.clientX - drag.current.px, e.clientY - drag.current.py, drag.current.start)}
              onPointerUp={() => { drag.current = null }}
              onPointerCancel={() => { drag.current = null }}
              onWheel={(e) => zoomTo(crop.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 2
                const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
                if (!d) return
                e.preventDefault()
                // 矢印の向きに表示範囲を動かす（画像は逆向きに動いて見える）
                setCrop((c) => normalizeCrop({ ...c, x: c.x + d[0], y: c.y + d[1] }))
              }}
            >
              <img
                src={url}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
                onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                onError={() => setFailed(true)}
                className="pointer-events-none absolute inset-0 size-full select-none"
                style={cropStyle(crop)}
              />
              {/* 十字のガイド（中心が分かるように） */}
              <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/60 mix-blend-difference" />
              <span className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white/60 mix-blend-difference" />
            </div>
            <div className="mt-3 flex items-center gap-2" style={{ width: BOX }}>
              <button type="button" aria-label="縮小" onClick={() => zoomTo(crop.zoom - 0.1)} className="rounded-lg p-1.5 text-[#55708b] hover:bg-[#f1f5f8]"><Minus size={16} /></button>
              <input
                type="range"
                min={1}
                max={MAX_ZOOM}
                step={0.01}
                value={crop.zoom}
                aria-label="拡大率"
                onChange={(e) => zoomTo(Number(e.target.value))}
                className="min-w-0 flex-1 accent-[var(--brand)]"
              />
              <button type="button" aria-label="拡大" onClick={() => zoomTo(crop.zoom + 0.1)} className="rounded-lg p-1.5 text-[#55708b] hover:bg-[#f1f5f8]"><Plus size={16} /></button>
            </div>
          </div>
          <div className="flex-1 text-[12px] leading-6 text-[#38536f]">
            <p className="font-bold">表示の見本</p>
            <div className="mt-2 flex items-center gap-3">{preview(crop)}</div>
            <ul className="mt-4 list-disc space-y-1 pl-4 text-[11px] leading-5 text-[#5b6b7c]">
              <li>画像をドラッグして、アイコンに見せたい部分を枠の中に入れます。</li>
              <li>スライダー（またはマウスホイール）で拡大できます。</li>
              <li>枠からはみ出した部分はアイコンには表示されません。</li>
            </ul>
            <Button variant="ghost" className="mt-3 px-2" onClick={() => setCrop(DEFAULT_CROP)}><RotateCcw size={14} />中央に戻す</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
