'use client'

import { Hash, Heart, MessageCircle, Repeat2, Bookmark } from 'lucide-react'
import type { Account, AppState, WebArticle } from '@/lib/kouhou/domain/types'
import { SITES, parseBody } from '@/lib/kouhou/domain/web'
import { PLATFORM_LABEL } from '@/lib/kouhou/domain/labels'
import { AssetThumb } from '@/components/kouhou/domain/asset-thumb'
import { cn } from '@/lib/utils'

interface PreviewProps {
  s: AppState
  account: Account
  channelId: string | null
  body: string
  assetIds: string[]
  article?: WebArticle | null
}

function useParts({ s, account, assetIds }: PreviewProps) {
  const brand = s.brands.find((b) => b.id === account.brandId)
  const assets = assetIds.map((id) => s.assets.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a && a.kind !== 'text')
  return { brand, assets }
}

function Avatar({ color, label }: { color: string; label: string }) {
  return (
    <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary-foreground" style={{ backgroundColor: color }}>
      {label.slice(0, 2)}
    </span>
  )
}

function XPreview(p: PreviewProps) {
  const { brand, assets } = useParts(p)
  return (
    <div className="flex gap-3 p-3">
      <Avatar color={brand?.color ?? '#888'} label={brand?.code ?? ''} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="text-sm">
          <span className="font-bold">{p.account.name}</span> <span className="text-muted-foreground">@{p.account.code} · 予定</span>
        </p>
        {p.body ? <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{p.body}</p> : <p className="text-sm text-muted-foreground">（本文なし）</p>}
        {assets.length > 0 && (
          <div className={cn('grid gap-0.5 overflow-hidden rounded-xl border', assets.length > 1 && 'grid-cols-2')}>
            {assets.slice(0, 4).map((a) => (
              <AssetThumb key={a.id} s={p.s} asset={a} />
            ))}
          </div>
        )}
        <div className="flex gap-6 text-muted-foreground" aria-hidden>
          <MessageCircle className="size-4" />
          <Repeat2 className="size-4" />
          <Heart className="size-4" />
          <Bookmark className="size-4" />
        </div>
      </div>
    </div>
  )
}

function InstagramPreview(p: PreviewProps) {
  const { brand, assets } = useParts(p)
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 p-3">
        <Avatar color={brand?.color ?? '#888'} label={brand?.code ?? ''} />
        <span className="text-sm font-bold">{p.account.code}</span>
      </div>
      {assets.length ? (
        <div className="relative">
          <AssetThumb s={p.s} asset={assets[0]} />
          {assets.length > 1 && <span className="absolute top-2 right-2 rounded-full bg-foreground/70 px-2 py-0.5 text-xs text-background">1/{assets.length}</span>}
        </div>
      ) : (
        <div className="flex aspect-square items-center justify-center bg-muted px-6 text-center text-sm text-muted-foreground">フィード投稿には画像または動画の添付を想定しています</div>
      )}
      <div className="flex gap-4 px-3 pt-3 text-muted-foreground" aria-hidden>
        <Heart className="size-5" />
        <MessageCircle className="size-5" />
        <Bookmark className="ml-auto size-5" />
      </div>
      <p className="p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
        <span className="font-bold">{p.account.code}</span> {p.body || <span className="text-muted-foreground">（キャプションなし）</span>}
      </p>
    </div>
  )
}

function DiscordPreview(p: PreviewProps) {
  const { brand, assets } = useParts(p)
  const ch = p.s.channels.find((c) => c.id === p.channelId)
  const server = p.s.servers.find((sv) => sv.id === p.account.serverId)
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 border-b px-3 py-2 text-sm font-bold">
        <Hash className="size-4 text-muted-foreground" aria-hidden />
        {ch?.name ?? 'チャンネル未選択'}
        <span className="ml-auto truncate text-xs font-normal text-muted-foreground">{server?.name}</span>
      </div>
      <div className="flex gap-3 p-3">
        <Avatar color={brand?.color ?? '#888'} label={brand?.code ?? ''} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="text-sm">
            <span className="font-bold">{p.account.name}</span> <span className="text-xs text-muted-foreground">予定</span>
          </p>
          {p.body ? <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{p.body}</p> : <p className="text-sm text-muted-foreground">（本文なし）</p>}
          {assets.length > 0 && (
            <div className="grid max-w-72 grid-cols-2 gap-1">
              {assets.map((a) => (
                <AssetThumb key={a.id} s={p.s} asset={a} className="rounded-md" />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WebPreview(p: PreviewProps) {
  const { assets } = useParts(p)
  const a = p.article
  const site = p.account.site ? SITES[p.account.site] : null
  const thumb = assets.find((x) => x.kind === 'image' || x.kind === 'logo' || x.kind === 'background')
  const sections = parseBody(p.body)
  return (
    <article className="flex flex-col">
      {thumb ? <AssetThumb s={p.s} asset={thumb} className="aspect-video" /> : <div className="flex aspect-video items-center justify-center bg-muted text-xs text-muted-foreground">サムネイルなし</div>}
      <div className="flex flex-col gap-2 p-3">
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {a?.category && <span className="rounded bg-primary px-1.5 py-0.5 font-bold text-primary-foreground">{a.category}</span>}
          <span className="text-muted-foreground">公開日（公開した日）</span>
          {a?.featured && <span className="text-muted-foreground">・注目</span>}
          {a?.important && <span className="text-muted-foreground">・重要なお知らせ</span>}
        </p>
        <h3 className="text-base font-bold leading-snug">{a?.title || '（タイトル未入力）'}</h3>
        {a?.excerpt && <p className="text-xs leading-relaxed text-muted-foreground">{a.excerpt}</p>}
        <div className="flex flex-col gap-2 border-t pt-2 text-sm leading-relaxed">
          {a?.lead && <p className="font-medium">{a.lead}</p>}
          {sections.length ? (
            sections.map((s, i) => (
              <section key={i} className="flex flex-col gap-1.5">
                {s.heading && <h4 className="font-bold">{s.heading}</h4>}
                {s.paragraphs.map((para, j) => (
                  <p key={j} className="break-words whitespace-pre-wrap">
                    {para}
                  </p>
                ))}
                {s.image &&
                  (() => {
                    const img = p.s.assets.find((x) => x.id === s.image)
                    return img ? (
                      <figure className="flex flex-col gap-1">
                        <AssetThumb s={p.s} asset={img} className="rounded-md" />
                        {s.imageAlt && <figcaption className="text-[11px] text-muted-foreground">{s.imageAlt}</figcaption>}
                      </figure>
                    ) : (
                      <p className="text-xs text-danger">画像が添付されていません（{s.image}）</p>
                    )
                  })()}
              </section>
            ))
          ) : (
            <p className="text-muted-foreground">（本文なし）</p>
          )}
        </div>
        {site && a?.slug && <p className="break-all font-mono text-[11px] text-muted-foreground">{site.articleUrl(a.slug)}</p>}
      </div>
    </article>
  )
}

export function PostPreview(p: PreviewProps) {
  const Comp = p.account.platform === 'x' ? XPreview : p.account.platform === 'instagram' ? InstagramPreview : p.account.platform === 'web' ? WebPreview : DiscordPreview
  const hasVideo = p.assetIds.some((id) => p.s.assets.find((a) => a.id === id)?.kind === 'video')
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-bold text-foreground">{PLATFORM_LABEL[p.account.platform]} 参考プレビュー</span>
        <span className="tabular">{[...p.body].length}文字</span>
      </figcaption>
      <div className="overflow-hidden rounded-lg border bg-card">
        <Comp {...p} />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        表示は参考です。文字数・画像枚数などの上限は実接続時に確認します。
        {hasVideo && ' 動画の投稿可否は実接続時に対応確認となります。'}
      </p>
    </figure>
  )
}
