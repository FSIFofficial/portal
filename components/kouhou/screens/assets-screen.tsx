'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { PenLine, Search } from 'lucide-react'
import { buttonVariants } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import type { Asset, AssetKind } from '@/lib/kouhou/domain/types'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { Dialog, EmptyState, Input, Notice, Pill, Select, Tabs } from '@/components/kouhou/kit/primitives'
import { AssetThumb } from '@/components/kouhou/domain/asset-thumb'
import { BrandTag, PostId, UserName } from '@/components/kouhou/domain/tags'
import { CommentsPanel } from '@/components/kouhou/domain/comments'
import { cn } from '@/lib/utils'
import { UploadButton } from '@/components/kouhou/assets/upload-dialog'

const KIND_TABS: { value: AssetKind; label: string }[] = [
  { value: 'image', label: '画像' },
  { value: 'video', label: '動画' },
  { value: 'logo', label: 'ロゴ' },
  { value: 'background', label: '背景テンプレート' },
  { value: 'text', label: '文章テンプレート' },
]

const isEditable = (a: Asset) => a.kind === 'background' || Boolean(a.edit)

export function AssetsScreen() {
  const { s, brand } = useScope()
  const [kind, setKind] = useState<AssetKind>('background')
  const [q, setQ] = useState('')
  const [purpose, setPurpose] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const scoped = useMemo(() => s.assets.filter((a) => brand === 'all' || a.brandId === brand), [s.assets, brand])
  const purposes = useMemo(() => [...new Set(scoped.map((a) => a.purpose))], [scoped])
  const needle = q.trim().toLowerCase()
  const list = scoped
    .filter((a) => a.kind === kind)
    .filter((a) => !purpose || a.purpose === purpose)
    .filter((a) => {
      if (!needle) return true
      const brandName = s.brands.find((b) => b.id === a.brandId)?.name ?? ''
      return [a.name, a.purpose, brandName].some((t) => t.toLowerCase().includes(needle))
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const open = s.assets.find((a) => a.id === openId)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">素材・テンプレート</h1>
        <p className="text-sm text-muted-foreground">
          {s.live
            ? '背景テンプレートから文字入りの投稿用画像を作れます。画像は Google Drive に保存されます。'
            : '背景テンプレートから文字入りの投稿用画像を作れます。外部の保存先は未接続のため、サンプル素材で動作します。'}
        </p>
        {s.live && <UploadButton defaultKind={kind === 'logo' || kind === 'background' ? kind : 'image'} />}
      </header>

      <Tabs label="素材の種類" value={kind} onChange={setKind} items={KIND_TABS.map((t) => ({ ...t, count: scoped.filter((a) => a.kind === t.value).length }))} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="名前・ブランド・用途で検索" placeholder="名前・ブランド・用途で検索" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="用途で絞り込み" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="sm:w-48">
          <option value="">すべての用途</option>
          {purposes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      {kind === 'image' && <Notice tone="info">文字入りの画像は「背景テンプレート」から作成した投稿用コピーです。元の背景は変更されません。</Notice>}

      {list.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((a) => (
            <li key={a.id}>
              <AssetCard asset={a} onOpen={() => setOpenId(a.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="該当する素材はありません">検索条件やブランドの絞り込みを変えてください。</EmptyState>
      )}

      <Dialog open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.name ?? ''} size="lg" side="right">
        {open && <AssetDetail asset={open} />}
      </Dialog>
    </div>
  )
}

function AssetCard({ asset, onOpen }: { asset: Asset; onOpen: () => void }) {
  const { s } = useScope()
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-md border border-border bg-card">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
        <AssetThumb s={s} asset={asset} className="border-b border-border" />
        <div className="flex flex-col gap-1 p-2.5">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">{asset.name}</h3>
          <div className="flex flex-wrap items-center gap-1">
            <BrandTag brand={s.brands.find((b) => b.id === asset.brandId)} />
            <Pill tone="muted">{asset.purpose}</Pill>
          </div>
          <p className="text-xs text-muted-foreground">
            <UserName s={s} id={asset.updatedBy} />・{formatDateTime(asset.updatedAt)}
          </p>
        </div>
      </button>
      {isEditable(asset) && (
        <Link href={`/kouhou/assets/editor?asset=${asset.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 rounded-none border-t border-border')}>
          <PenLine className="size-4" aria-hidden />
          {asset.kind === 'background' ? '文字を入れて作成' : '再編集'}
        </Link>
      )}
    </article>
  )
}

function AssetDetail({ asset }: { asset: Asset }) {
  const { s } = useScope()
  const usedIn = s.posts.filter((p) => p.assetIds.includes(asset.id))
  const source = asset.sourceAssetId ? s.assets.find((a) => a.id === asset.sourceAssetId) : null
  const copies = s.assets.filter((a) => a.sourceAssetId === asset.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="mx-auto w-full max-w-sm overflow-hidden rounded-md border border-border">
        <AssetThumb s={s} asset={asset} />
      </div>
      {asset.kind === 'text' && <p className="rounded-md bg-muted p-3 text-sm leading-relaxed">{asset.text}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">ブランド</dt>
        <dd>
          <BrandTag brand={s.brands.find((b) => b.id === asset.brandId)} />
        </dd>
        <dt className="text-muted-foreground">用途</dt>
        <dd>{asset.purpose}</dd>
        <dt className="text-muted-foreground">更新</dt>
        <dd>
          <UserName s={s} id={asset.updatedBy} />　{formatDateTime(asset.updatedAt)}
        </dd>
        {source && (
          <>
            <dt className="text-muted-foreground">元テンプレート</dt>
            <dd>{source.name}</dd>
          </>
        )}
        {copies.length > 0 && (
          <>
            <dt className="text-muted-foreground">作成済みコピー</dt>
            <dd>{copies.length}件</dd>
          </>
        )}
        <dt className="text-muted-foreground">使用中の投稿</dt>
        <dd className="flex flex-wrap gap-2">
          {usedIn.length
            ? usedIn.map((p) => (
                <Link key={p.id} href={`/kouhou/posts/detail?id=${p.id}`} className="text-primary hover:underline">
                  <PostId id={p.id} />
                </Link>
              ))
            : 'なし'}
        </dd>
      </dl>
      {isEditable(asset) && (
        <Link href={`/kouhou/assets/editor?asset=${asset.id}`} className={cn(buttonVariants(), 'w-fit gap-1')}>
          <PenLine className="size-4" aria-hidden />
          {asset.kind === 'background' ? 'この背景で投稿用画像を作る' : 'このコピーを再編集'}
        </Link>
      )}
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">コメント</h3>
        <CommentsPanel target={{ type: 'asset', id: asset.id }} />
      </section>
    </div>
  )
}
