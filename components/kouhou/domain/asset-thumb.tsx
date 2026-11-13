'use client'

import { MediaImg } from './media-img'
import { FileText, Film } from 'lucide-react'
import type { AppState, Asset, TemplateEdit, TextLayer } from '@/lib/kouhou/domain/types'
import { cn } from '@/lib/utils'

/** テンプレートの座標系：x・yは％、fontSizeは1080px基準 */
export const TEMPLATE_BASE = 1080

const FONT_FAMILY: Record<TextLayer['font'], string> = {
  sans: 'var(--font-sans)',
  serif: '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif',
  mono: 'var(--font-mono)',
}

export function layerStyle(l: TextLayer): React.CSSProperties {
  const tx = l.align === 'left' ? '0' : l.align === 'right' ? '-100%' : '-50%'
  return {
    left: `${l.x}%`,
    top: `${l.y}%`,
    transform: `translate(${tx}, -50%)`,
    fontSize: `${(l.fontSize / TEMPLATE_BASE) * 100}cqw`,
    color: l.color,
    fontFamily: FONT_FAMILY[l.font],
    fontWeight: l.weight,
    textAlign: l.align,
    lineHeight: 1.25,
    whiteSpace: 'pre',
  }
}

export function TemplateRender({ s, edit, className, label }: { s: AppState; edit: TemplateEdit; className?: string; label?: string }) {
  const bg = s.assets.find((a) => a.id === edit.backgroundAssetId)
  return (
    <div
      role="img"
      aria-label={label ?? edit.layers.map((l) => l.text).join(' / ')}
      className={cn('relative aspect-square w-full overflow-hidden bg-muted', className)}
      style={{ containerType: 'inline-size' }}
    >
      {bg?.src && <MediaImg src={bg.src} alt="" className="absolute inset-0 size-full object-cover" draggable={false} />}
      {edit.layers.map((l) => (
        <span key={l.id} aria-hidden className="absolute" style={layerStyle(l)}>
          {l.text}
        </span>
      ))}
    </div>
  )
}

export function AssetThumb({ s, asset, className }: { s: AppState; asset: Asset; className?: string }) {
  if (asset.edit) return <TemplateRender s={s} edit={asset.edit} className={className} label={asset.name} />
  if (asset.kind === 'video') {
    return (
      <div className={cn('flex aspect-square w-full flex-col items-center justify-center gap-1 bg-muted p-2 text-center text-xs text-muted-foreground', className)}>
        <Film className="size-5" aria-hidden />
        <span>動画（実接続時に対応確認）</span>
      </div>
    )
  }
  if (asset.kind === 'text') {
    return (
      <div className={cn('flex aspect-square w-full flex-col gap-1 overflow-hidden bg-muted p-3 text-xs leading-relaxed text-muted-foreground', className)}>
        <FileText className="size-4 shrink-0" aria-hidden />
        <span className="line-clamp-5">{asset.text}</span>
      </div>
    )
  }
  if (asset.src) {
    return (
      <div className={cn('aspect-square w-full overflow-hidden bg-muted', className)}>
        <MediaImg src={asset.src} alt={asset.name} className={cn('size-full', asset.kind === 'logo' ? 'object-contain p-3' : 'object-cover')} />
      </div>
    )
  }
  return <div className={cn('flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground', className)}>プレビューなし</div>
}
