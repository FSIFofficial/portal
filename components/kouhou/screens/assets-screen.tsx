'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FolderInput, PenLine, Search, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import type { Asset, AssetKind } from '@/lib/kouhou/domain/types'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { Dialog, EmptyState, Field, Input, Notice, Pill, Select, Tabs } from '@/components/kouhou/kit/primitives'
import { runAction } from '@/lib/kouhou/store/store'
import { toastResult } from '@/components/kouhou/kit/toast'
import { assetInUse, canEditAssetsOf, deleteAsset, groupAssets, updateAsset } from '@/lib/kouhou/domain/assets'
import { AssetThumb } from '@/components/kouhou/domain/asset-thumb'
import { BrandTag, PostId, UserName } from '@/components/kouhou/domain/tags'
import { CommentsPanel } from '@/components/kouhou/domain/comments'
import { cn } from '@/lib/utils'
import { GroupOptions, UploadButton } from '@/components/kouhou/assets/upload-dialog'

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
  const [kind, setKind] = useState<AssetKind>('image')
  const [q, setQ] = useState('')
  const [purpose, setPurpose] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[] | null>(null)
  const [moveGroup, setMoveGroup] = useState('')
  const [moveBrand, setMoveBrand] = useState('')

  const scoped = useMemo(() => s.assets.filter((a) => brand === 'all' || a.brandId === brand), [s.assets, brand])
  const purposes = useMemo(() => [...new Set(scoped.filter((a) => a.kind === kind).map((a) => a.purpose))].sort((a, b) => a.localeCompare(b, 'ja')), [scoped, kind])
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
        <div className="flex flex-wrap gap-2">
          <UploadButton defaultKind={kind === 'logo' || kind === 'background' ? kind : 'image'} defaultBrandId={brand === 'all' ? undefined : brand} defaultGroup={purpose || undefined} />
          {kind !== 'text' && (
            <Button
              variant="outline"
              className="gap-1"
              aria-pressed={picked !== null}
              onClick={() => {
                setPicked(picked ? null : [])
                setMoveGroup(purpose)
                setMoveBrand('')
              }}
            >
              <FolderInput className="size-4" aria-hidden />
              {picked ? 'グループ分けを終える' : '選んでグループ分け'}
            </Button>
          )}
        </div>
      </header>

      <Tabs label="素材の種類" value={kind} onChange={(k) => { setKind(k); setPurpose(''); setPicked(null) }} items={KIND_TABS.map((t) => ({ ...t, count: scoped.filter((a) => a.kind === t.value).length }))} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label="名前・ブランド・グループで検索" placeholder="名前・ブランド・グループで検索" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <Select aria-label="グループで絞り込み" value={purpose} onChange={(e) => setPurpose(e.target.value)} className="sm:w-48">
          <option value="">すべてのグループ</option>
          {purposes.map((p) => (
            <option key={p} value={p}>
              {p}（{scoped.filter((a) => a.kind === kind && a.purpose === p).length}）
            </option>
          ))}
        </Select>
      </div>

      {picked && (
        <div className="sticky top-14 z-10 flex flex-col gap-2 rounded-md border border-primary/40 bg-card p-3 shadow-sm sm:flex-row sm:items-end">
          <p className="text-sm sm:mr-auto sm:self-center">
            <span className="font-semibold">{picked.length}件</span>を選択中
            <button type="button" className="ml-2 text-xs text-muted-foreground underline underline-offset-2" onClick={() => setPicked(list.map((a) => a.id))}>
              表示中をすべて選ぶ
            </button>
          </p>
          <Field label="移すグループ" htmlFor="mv-group">
            <Input id="mv-group" list="mv-groups" value={moveGroup} onChange={(e) => setMoveGroup(e.target.value)} placeholder="グループ名" className="sm:w-48" />
            <GroupOptions id="mv-groups" />
          </Field>
          <Field label="ブランド" htmlFor="mv-brand">
            <Select id="mv-brand" value={moveBrand} onChange={(e) => setMoveBrand(e.target.value)} className="sm:w-40">
              <option value="">変えない</option>
              {s.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            disabled={!picked.length || (!moveGroup.trim() && !moveBrand)}
            onClick={async () => {
              const r = await toastResult(runAction(groupAssets, picked, { ...(moveGroup.trim() ? { purpose: moveGroup } : {}), ...(moveBrand ? { brandId: moveBrand } : {}) }))
              if (r.ok) {
                setPicked([])
                if (moveGroup.trim()) setPurpose(moveGroup.trim())
              }
            }}
          >
            移す
          </Button>
        </div>
      )}

      {kind === 'image' && <Notice tone="info">文字入りの画像は「背景テンプレート」から作成した投稿用コピーです。元の背景は変更されません。</Notice>}

      {list.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((a) => (
            <li key={a.id}>
              <AssetCard
                asset={a}
                onOpen={() => setOpenId(a.id)}
                picked={picked ? picked.includes(a.id) : undefined}
                onPick={() => setPicked((p) => (p ? (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]) : p))}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="該当する素材はありません">検索条件やブランドの絞り込みを変えてください。</EmptyState>
      )}

      <Dialog open={Boolean(open)} onClose={() => setOpenId(null)} title={open?.name ?? ''} size="lg" side="right">
        {open && <AssetDetail asset={open} onDeleted={() => setOpenId(null)} />}
      </Dialog>
    </div>
  )
}

function AssetCard({ asset, onOpen, picked, onPick }: { asset: Asset; onOpen: () => void; picked?: boolean; onPick: () => void }) {
  const { s } = useScope()
  const picking = picked !== undefined
  return (
    <article className={cn('relative flex h-full flex-col overflow-hidden rounded-md border border-border bg-card', picked && 'border-primary ring-2 ring-primary/30')}>
      {picking && (
        <input type="checkbox" checked={picked} onChange={onPick} aria-label={`${asset.name}を選ぶ`} className="absolute top-2 left-2 z-10 size-5 accent-primary" />
      )}
      <button type="button" onClick={picking ? onPick : onOpen} className="flex flex-1 flex-col text-left hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary">
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
      {isEditable(asset) && !picking && (
        <Link href={`/kouhou/assets/editor?asset=${asset.id}`} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1 rounded-none border-t border-border')}>
          <PenLine className="size-4" aria-hidden />
          {asset.kind === 'background' ? '文字を入れて作成' : '再編集'}
        </Link>
      )}
    </article>
  )
}

function AssetDetail({ asset, onDeleted }: { asset: Asset; onDeleted: () => void }) {
  const { s } = useScope()
  const canEdit = canEditAssetsOf(s, s.currentUserId, asset.brandId)
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
        {!canEdit && (
          <>
            <dt className="text-muted-foreground">ブランド</dt>
            <dd>
              <BrandTag brand={s.brands.find((b) => b.id === asset.brandId)} />
            </dd>
            <dt className="text-muted-foreground">グループ</dt>
            <dd>{asset.purpose}</dd>
          </>
        )}
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
      {canEdit && <AssetEditForm key={asset.id + asset.updatedAt} asset={asset} onDeleted={onDeleted} />}
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">コメント</h3>
        <CommentsPanel target={{ type: 'asset', id: asset.id }} />
      </section>
    </div>
  )
}

function AssetEditForm({ asset, onDeleted }: { asset: Asset; onDeleted: () => void }) {
  const { s } = useScope()
  const [name, setName] = useState(asset.name)
  const [group, setGroup] = useState(asset.purpose)
  const [brandId, setBrandId] = useState(asset.brandId)
  const [kind, setKind] = useState(asset.kind)
  const kindEditable = !asset.edit && (asset.kind === 'image' || asset.kind === 'logo' || asset.kind === 'background')
  const dirty = name !== asset.name || group !== asset.purpose || brandId !== asset.brandId || kind !== asset.kind
  const inUse = assetInUse(s, asset.id)
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4" aria-label="素材の整理">
      <h3 className="text-sm font-semibold">名前・グループ</h3>
      <Field label="素材名" htmlFor="as-name">
        <Input id="as-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="グループ" htmlFor="as-group" hint="グループを変えても、投稿の「素材を選ぶ」からはこれまでどおり選べます">
        <Input id="as-group" list="as-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
        <GroupOptions id="as-groups" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ブランド" htmlFor="as-brand">
          <Select id="as-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {s.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        {kindEditable && (
          <Field label="種類" htmlFor="as-kind">
            <Select id="as-kind" value={kind} onChange={(e) => setKind(e.target.value as AssetKind)}>
              <option value="image">画像</option>
              <option value="logo">ロゴ</option>
              <option value="background">背景テンプレート</option>
            </Select>
          </Field>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={!dirty}
          onClick={() =>
            void toastResult(
              runAction(updateAsset, asset.id, {
                ...(name !== asset.name ? { name } : {}),
                ...(group !== asset.purpose ? { purpose: group } : {}),
                ...(brandId !== asset.brandId ? { brandId } : {}),
                ...(kind !== asset.kind && kindEditable ? { kind: kind as 'image' | 'logo' | 'background' } : {}),
              }),
            )
          }
        >
          保存
        </Button>
        <Button
          variant="ghost"
          className="gap-1 text-danger"
          disabled={!!inUse}
          title={inUse ?? undefined}
          onClick={async () => {
            if (!window.confirm(`「${asset.name}」を削除しますか？`)) return
            const r = await toastResult(runAction(deleteAsset, asset.id))
            if (r.ok) onDeleted()
          }}
        >
          <Trash2 className="size-4" aria-hidden />
          削除
        </Button>
        {inUse && <span className="text-xs text-muted-foreground">{inUse}</span>}
      </div>
    </section>
  )
}
