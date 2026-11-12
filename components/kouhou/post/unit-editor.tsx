'use client'

import type { Account } from '@/lib/kouhou/domain/types'
import type { UnitFields } from '@/lib/kouhou/domain/actions'
import { useAppState } from '@/lib/kouhou/store/store'
import { Field, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { AssetPicker, AssetStrip } from './asset-picker'
import { PostPreview } from './post-preview'

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
        <Field label="本文" htmlFor={bodyId} hint={<span className="tabular">{[...unit.body].length}文字</span>}>
          <Textarea id={bodyId} value={unit.body} onChange={(e) => onChange({ body: e.target.value })} disabled={disabled} className="min-h-44" placeholder="投稿する本文を入力" />
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
        </div>
      </div>
      <PostPreview s={s} account={account} channelId={unit.channelId} body={unit.body} assetIds={unit.assetIds} />
    </div>
  )
}
