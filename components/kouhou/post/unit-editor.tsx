'use client'

import type { Account } from '@/lib/kouhou/domain/types'
import type { UnitFields } from '@/lib/kouhou/domain/actions'
import { useAppState } from '@/lib/kouhou/store/store'
import { Field, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { AssetPicker, AssetStrip } from './asset-picker'
import { PostPreview } from './post-preview'
import { ArticleFields } from './article-fields'
import { emptyArticle, imageLine } from '@/lib/kouhou/domain/web'
import { useRef } from 'react'
import { ImagePlus } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'

export function UnitEditor({
  account,
  unit,
  onChange,
  disabled,
  idPrefix,
}: {
  account: Account
  unit: UnitFields
  onChange: (patch: Partial<UnitFields>) => void
  disabled?: boolean
  idPrefix: string
}) {
  const s = useAppState()
  const channels = account.platform === 'discord' ? s.channels.filter((c) => c.serverId === account.serverId) : []
  const server = s.servers.find((sv) => sv.id === account.serverId)
  const bodyId = `${idPrefix}-body`
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const images = unit.assetIds.map((id) => s.assets.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => !!a && a.kind !== 'text' && a.kind !== 'video')
  /** 本文のカーソルの位置（無ければ末尾）に、画像の行を前後に空行を付けて入れる */
  const insertImage = (assetId: string, alt: string) => {
    const el = bodyRef.current
    const at = el && document.activeElement === el ? el.selectionStart : el?.selectionStart ?? unit.body.length
    const before = unit.body.slice(0, at).replace(/\s*$/, '')
    const after = unit.body.slice(at).replace(/^\s*/, '')
    onChange({ body: [before, imageLine(assetId, alt), after].filter(Boolean).join('\n\n') })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex flex-col gap-4">
        {account.platform === 'discord' && (
          <Field label="チャンネル" htmlFor={`${idPrefix}-ch`} required hint={server ? `サーバー：${server.name}（投稿可能なチャンネルのみ選択できます）` : undefined}>
            <Select id={`${idPrefix}-ch`} value={unit.channelId ?? ''} onChange={(e) => onChange({ channelId: e.target.value || null })} disabled={disabled}>
              <option value="">選択してください</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id} disabled={!c.postable}>
                  #{c.name}
                  {c.postable ? '' : '（投稿不可）'}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {account.platform === 'web' && account.site && (
          <ArticleFields site={account.site} article={unit.article ?? emptyArticle(account.site)} onChange={(a) => onChange({ article: a })} disabled={disabled} idPrefix={`${idPrefix}-art`} />
        )}
        <Field
          label="本文"
          htmlFor={bodyId}
          hint={
            account.platform === 'web' ? (
              <span>空行で段落を分けます。「## 見出し」と書いた行から見出し付きのまとまりになります{account.site === 'cb' ? '（HTMLのタグも使えます）' : ''}。</span>
            ) : (
              <span className="tabular">{[...unit.body].length}文字</span>
            )
          }
        >
          <Textarea ref={bodyRef} id={bodyId} value={unit.body} onChange={(e) => onChange({ body: e.target.value })} disabled={disabled} className={account.platform === 'web' ? 'min-h-72' : 'min-h-44'} placeholder={account.platform === 'web' ? '記事の本文を入力' : '投稿する本文を入力'} />
        </Field>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">素材</span>
            <AssetPicker
              brandId={account.brandId}
              selected={unit.assetIds}
              onChange={(ids) => onChange({ assetIds: ids })}
              onInsertText={(t) => onChange({ body: unit.body ? `${unit.body}\n${t}` : t })}
              disabled={disabled}
            />
          </div>
          {unit.assetIds.length ? (
            <AssetStrip assetIds={unit.assetIds} onRemove={(id) => onChange({ assetIds: unit.assetIds.filter((x) => x !== id) })} disabled={disabled} />
          ) : (
            <p className="text-xs text-muted-foreground">素材は添付されていません</p>
          )}
          {account.platform === 'web' && (
            <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border p-2.5">
              <p className="text-xs text-muted-foreground">
                1枚目の画像はサムネイルになります。本文の途中に画像を入れるときは、本文の入れたい位置をクリックしてから「本文に入れる」を押してください（画像は段落のあとに入り、次の文から新しいまとまりになります）。
              </p>
              {images.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {images.map((a) => (
                    <li key={a.id}>
                      <Button type="button" size="sm" variant="outline" className="gap-1" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => insertImage(a.id, a.name)}>
                        <ImagePlus className="size-3.5" aria-hidden />
                        「{a.name}」を本文に入れる
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">画像を添付すると、ここから本文に入れられます。</p>
              )}
            </div>
          )}
        </div>
      </div>
      <PostPreview s={s} account={account} channelId={unit.channelId} body={unit.body} assetIds={unit.assetIds} article={unit.article} />
    </div>
  )
}
