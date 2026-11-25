'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, Plus, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import { runAction } from '@/lib/kouhou/store/store'
import type { AppState, CalendarEvent } from '@/lib/kouhou/domain/types'
import { canEditEvent, deleteEvent, retryEventSync, saveEvent, visibleEvents, type EventInput } from '@/lib/kouhou/domain/events'
import { formatDateTime, isBefore } from '@/lib/kouhou/domain/time'
import { Dialog, EmptyState, Field, Input, Notice, Pill, Segmented, Select, Switch, Textarea } from '@/components/kouhou/kit/primitives'
import { DateTimeInput } from '@/components/kouhou/kit/form-bits'
import { BrandTag } from '@/components/kouhou/domain/tags'
import { toastResult } from '@/components/kouhou/kit/toast'

export function EventsScreen() {
  const { s, user, brand } = useScope()
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming')
  const [editing, setEditing] = useState<EventInput | null>(null)
  const editableBrands = s.brands.filter((b) => canEditEvent(s, user?.id ?? null, b.id))
  const events = useMemo(() => {
    const list = visibleEvents(s).filter((e) => (brand === 'all' || e.brandId === brand) && (when === 'upcoming' ? !isBefore(e.endAt ?? e.at, s.now) : isBefore(e.endAt ?? e.at, s.now)))
    return list.sort((a, b) => (when === 'upcoming' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)))
  }, [s, brand, when])

  const blank = (): EventInput => ({
    title: '',
    brandId: brand !== 'all' && editableBrands.some((b) => b.id === brand) ? brand : editableBrands[0]?.id ?? '',
    at: '',
    endAt: null,
    description: '',
    location: '',
    discord: null,
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">イベント</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="表示する期間" value={when} onChange={setWhen} items={[{ value: 'upcoming', label: 'これから' }, { value: 'past', label: '終わったもの' }]} />
          <Button size="sm" onClick={() => setEditing(blank())} disabled={!editableBrands.length}>
            <Plus className="size-4" aria-hidden />
            イベントを追加
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">登録したイベントはカレンダーに表示されます。「Discordのイベントにも登録」をオンにすると、Discord のサーバーの「イベント」にも作成し、編集・削除も反映します。</p>
      {!editableBrands.length && <p className="text-xs text-muted-foreground">投稿作成権限のあるアカウントがないため、イベントは閲覧のみです。</p>}

      {events.length === 0 ? (
        <EmptyState title={when === 'upcoming' ? '予定されているイベントはありません' : '終わったイベントはありません'}>{when === 'upcoming' && '「イベントを追加」から登録できます。'}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <EventRow key={e.id} s={s} ev={e} canEdit={canEditEvent(s, user?.id ?? null, e.brandId)} onEdit={() => setEditing(toInput(e))} />
          ))}
        </ul>
      )}
      {editing && <EventEditor s={s} initial={editing} brands={editableBrands} onClose={() => setEditing(null)} />}
    </div>
  )
}

const toInput = (e: CalendarEvent): EventInput => ({
  id: e.id,
  title: e.title,
  brandId: e.brandId,
  at: e.at,
  endAt: e.endAt ?? null,
  description: e.description ?? '',
  location: e.location ?? '',
  discord: e.discord && e.discord.sync?.action !== 'delete' ? { serverId: e.discord.serverId, place: e.discord.place, channelId: e.discord.channelId, imageAssetId: e.discord.imageAssetId } : null,
})

function DiscordStatus({ s, ev }: { s: AppState; ev: CalendarEvent }) {
  const d = ev.discord
  if (!d) return null
  const server = s.servers.find((x) => x.id === d.serverId)
  if (d.sync?.state === 'error')
    return (
      <span className="flex flex-col gap-0.5">
        <Pill tone="danger">Discord：{d.sync.action === 'delete' ? '削除' : '反映'}に失敗</Pill>
        <span className="max-w-80 text-xs text-danger">{d.sync.error}</span>
      </span>
    )
  if (d.sync?.state === 'queued') return <Pill tone="warning">Discord：{d.sync.action === 'delete' ? '登録を外しています' : d.externalId ? '更新待ち' : '登録待ち'}</Pill>
  return (
    <span className="flex items-center gap-1.5">
      <Pill tone="success">Discord：{server?.name ?? ''}に登録済み</Pill>
      {d.url && (
        <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-xs text-primary underline underline-offset-2">
          開く
          <ExternalLink className="size-3" aria-hidden />
        </a>
      )}
    </span>
  )
}

function EventRow({ s, ev, canEdit, onEdit }: { s: AppState; ev: CalendarEvent; canEdit: boolean; onEdit: () => void }) {
  const ch = ev.discord?.place === 'channel' ? s.channels.find((c) => c.id === ev.discord?.channelId) : null
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-3" aria-label={ev.title}>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <BrandTag brand={s.brands.find((b) => b.id === ev.brandId)} />
          <span className="font-bold">{ev.title}</span>
        </span>
        <span className="tabular text-sm text-muted-foreground">
          {formatDateTime(ev.at)}
          {ev.endAt && ` 〜 ${ev.endAt.slice(0, 10) === ev.at.slice(0, 10) ? ev.endAt.slice(11) : formatDateTime(ev.endAt)}`}
          {ch ? `・🔊${ch.name}` : ev.location ? `・${ev.location}` : ''}
        </span>
        {ev.description && <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{ev.description}</p>}
        <DiscordStatus s={s} ev={ev} />
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-1.5">
          {ev.discord?.sync?.state === 'error' && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => void toastResult(runAction(retryEventSync, ev.id))}>
              <RotateCw className="size-3.5" aria-hidden />
              やり直す
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onEdit}>
            編集
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1 text-danger"
            aria-label={`${ev.title}を削除`}
            onClick={() => window.confirm(`「${ev.title}」を削除しますか？${ev.discord?.externalId ? 'Discord のイベントも削除されます。' : ''}`) && void toastResult(runAction(deleteEvent, ev.id))}
          >
            <Trash2 className="size-3.5" aria-hidden />
            削除
          </Button>
        </div>
      )}
    </li>
  )
}

function EventEditor({ s, initial, brands, onClose }: { s: AppState; initial: EventInput; brands: AppState['brands']; onClose: () => void }) {
  const [v, setV] = useState<EventInput>(initial)
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<EventInput>) => setV((x) => ({ ...x, ...patch }))
  const servers = s.servers.filter((x) => x.brandId === v.brandId)
  const allServers = servers.length ? servers : s.servers
  const d = v.discord
  const places = d ? s.channels.filter((c) => c.serverId === d.serverId && (c.kind === 'voice' || c.kind === 'stage')) : []
  const images = s.assets.filter((a) => (a.kind === 'image' || a.kind === 'background' || a.kind === 'logo') && a.brandId === v.brandId)
  const registered = !!s.events.find((e) => e.id === v.id)?.discord?.externalId
  const setDiscord = (patch: Partial<NonNullable<EventInput['discord']>>) => setV((x) => ({ ...x, discord: x.discord ? { ...x.discord, ...patch } : null }))
  const save = async () => {
    setSaving(true)
    const r = await toastResult(runAction(saveEvent, v))
    setSaving(false)
    if (r.ok) onClose()
  }
  return (
    <Dialog
      open
      onClose={onClose}
      title={v.id ? 'イベントを編集' : 'イベントを追加'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="イベント名" htmlFor="ev-title" required>
          <Input id="ev-title" value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={100} />
        </Field>
        <Field label="ブランド" htmlFor="ev-brand">
          <Select
            id="ev-brand"
            value={v.brandId}
            onChange={(e) => {
              const brandId = e.target.value
              const sv = s.servers.find((x) => x.brandId === brandId)
              setV((x) => ({ ...x, brandId, discord: x.discord && !registered && sv ? { ...x.discord, serverId: sv.id, channelId: null, imageAssetId: null } : x.discord }))
            }}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="開始" htmlFor="ev-at" required>
            <DateTimeInput id="ev-at" value={v.at || null} onChange={(x) => set({ at: x ?? '' })} />
          </Field>
          <Field label="終了" htmlFor="ev-end" hint={d?.place === 'external' ? 'Discord（場所を指定）では必須' : '任意'}>
            <DateTimeInput id="ev-end" value={v.endAt} onChange={(x) => set({ endAt: x })} min={v.at || undefined} />
          </Field>
        </div>
        <Field label="場所" htmlFor="ev-loc" hint="会場名・住所・配信URLなど">
          <Input id="ev-loc" value={v.location} onChange={(e) => set({ location: e.target.value })} maxLength={100} />
        </Field>
        <Field label="説明" htmlFor="ev-desc" hint={d ? `${v.description.length} / 1000文字` : undefined}>
          <Textarea id="ev-desc" rows={4} value={v.description} onChange={(e) => set({ description: e.target.value })} maxLength={d ? 1000 : undefined} />
        </Field>

        <section className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
            Discordのイベントにも登録
            <Switch
              label="Discordのイベントにも登録"
              checked={!!d}
              disabled={!allServers.length}
              onChange={(on) => set({ discord: on ? { serverId: allServers[0]?.id ?? '', place: 'external', channelId: null, imageAssetId: null } : null })}
            />
          </div>
          {!allServers.length && <p className="text-xs text-muted-foreground">Discord のサーバーが登録されていません（管理者設定 →「Discord」）。</p>}
          {!d && registered && <Notice tone="warning">保存すると、Discord のイベントは削除されます。</Notice>}
          {d && (
            <>
              <Field label="サーバー" htmlFor="ev-server" hint={registered ? '登録済みのイベントはサーバーを変えられません' : undefined}>
                <Select id="ev-server" value={d.serverId} disabled={registered} onChange={(e) => setDiscord({ serverId: e.target.value, channelId: null })}>
                  {allServers.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="開く場所" hint={d.place === 'external' ? '上の「場所」に入力した会場・URLが Discord に表示されます' : undefined}>
                <Segmented
                  label="開く場所"
                  value={d.place}
                  onChange={(place) => setDiscord({ place, channelId: place === 'channel' ? places[0]?.id ?? null : null })}
                  items={[
                    { value: 'external', label: '場所を指定' },
                    { value: 'channel', label: 'ボイス・ステージ' },
                  ]}
                />
              </Field>
              {d.place === 'channel' &&
                (places.length ? (
                  <Field label="チャンネル" htmlFor="ev-ch">
                    <Select id="ev-ch" value={d.channelId ?? ''} onChange={(e) => setDiscord({ channelId: e.target.value || null })}>
                      {!d.channelId && <option value="">選んでください</option>}
                      {places.map((c) => (
                        <option key={c.id} value={c.id}>
                          🔊{c.name}（{c.kind === 'stage' ? 'ステージ' : 'ボイス'}）
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <p className="text-xs text-muted-foreground">ボイス・ステージのチャンネルがありません。管理者設定の「Discordからチャンネルを取得」で取り込めます。</p>
                ))}
              <Field label="表紙の画像" htmlFor="ev-img" hint="任意。素材・テンプレートの画像から選びます">
                <Select id="ev-img" value={d.imageAssetId ?? ''} onChange={(e) => setDiscord({ imageAssetId: e.target.value || null })}>
                  <option value="">なし</option>
                  {images.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <p className="text-xs text-muted-foreground">保存すると数分以内に Discord に反映されます。Discord のイベントは、これからの日時のものだけ登録できます。</p>
            </>
          )}
        </section>
      </div>
    </Dialog>
  )
}
