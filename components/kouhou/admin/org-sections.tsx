'use client'

import { useState } from 'react'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { useAppState } from '@/lib/kouhou/store/store'
import { newId } from '@/lib/kouhou/domain/actions'
import { PLATFORM_LABEL } from '@/lib/kouhou/domain/labels'
import type { Platform } from '@/lib/kouhou/domain/types'
import { Field, Input, Panel, Pill, Select, Switch } from '@/components/kouhou/kit/primitives'
import { BrandDot } from '@/components/kouhou/domain/tags'
import { CheckConnectionsButton, ConnectionPill, SyncDiscordButton, XConnectButton } from './live-connections'
import { CODE_RE, useAdminEdit } from './use-admin'
import { accountInUse, brandInUse, channelInUse, postTypeInUse } from '@/lib/kouhou/domain/commands'
import { toast } from '@/components/kouhou/kit/toast'

/** テキストは確定（フォーカスを外す）時に保存。失敗したら元の値に戻す */
function CommitInput({ value, onCommit, label, className, ...rest }: { value: string; onCommit: (v: string) => boolean | Promise<boolean>; label: string; className?: string } & Omit<React.ComponentProps<'input'>, 'value' | 'onChange'>) {
  return (
    <Input
      {...rest}
      key={value}
      aria-label={label}
      defaultValue={value}
      className={className}
      onBlur={(e) => {
        const v = e.target.value.trim()
        if (v === value) return
        const input = e.target
        void Promise.resolve(onCommit(v)).then((ok) => !ok && (input.value = value))
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/**
 * 削除ボタン。使われていれば理由を出して止め、使われていなければ確認してから消す。
 * inUse はブラウザ側の判定（サーバー側でも同じ判定をする）
 */
function DeleteButton({ label, inUse, onDelete }: { label: string; inUse: () => string | null; onDelete: () => void }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="gap-1 text-danger"
      aria-label={`${label}を削除`}
      onClick={() => {
        const msg = inUse()
        if (msg) return void toast(msg, false)
        if (window.confirm(`${label}を削除しますか？`)) onDelete()
      }}
    >
      <Trash2 className="size-3.5" aria-hidden />
      削除
    </Button>
  )
}

export function BrandsSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [color, setColor] = useState('#2f6fde')

  const add = async () => {
    const ok = await edit(`ブランド「${name}」を追加しました`, (d) => {
      if (!name.trim()) return 'ブランド名を入力してください'
      if (!CODE_RE.test(code)) return '識別コードは英大文字・数字・ハイフン2〜12文字です'
      if (d.brands.some((b) => b.code === code)) return 'この識別コードは使用中です'
      const id = newId(d, 'b')
      d.brands.push({ id, name: name.trim(), code, color })
      d.servers.push({ id: newId(d, 'sv'), brandId: id, name: `${name.trim()} サーバー` })
    })
    if (ok) {
      setName('')
      setCode('')
    }
  }

  return (
    <Panel title="ブランド" id="brands">
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col gap-2">
          {s.brands.map((b) => (
            <li key={b.id} className="grid grid-cols-[auto_1fr_8rem_auto] items-center gap-2">
              <input
                type="color"
                aria-label={`${b.name}の表示色`}
                value={b.color}
                onChange={(e) => edit('表示色を変更しました', (d) => void (d.brands.find((x) => x.id === b.id)!.color = e.target.value))}
                className="size-9 cursor-pointer rounded-md border border-input bg-card p-1"
              />
              <CommitInput label="ブランド名" value={b.name} onCommit={(v) => edit('ブランド名を変更しました', (d) => (v ? void (d.brands.find((x) => x.id === b.id)!.name = v) : 'ブランド名を入力してください'))} />
              <CommitInput
                label="識別コード"
                value={b.code}
                className="font-mono uppercase"
                onCommit={(v) =>
                  edit('識別コードを変更しました', (d) => {
                    const c = v.toUpperCase()
                    if (!CODE_RE.test(c)) return '識別コードは英大文字・数字・ハイフン2〜12文字です'
                    if (d.brands.some((x) => x.code === c && x.id !== b.id)) return 'この識別コードは使用中です'
                    d.brands.find((x) => x.id === b.id)!.code = c
                  })
                }
              />
              <DeleteButton
                label={`ブランド「${b.name}」`}
                inUse={() => brandInUse(s, b.id)}
                onDelete={() =>
                  void edit(`ブランド「${b.name}」を削除しました`, (d) => {
                    const msg = brandInUse(d, b.id)
                    if (msg) return msg
                    const servers = d.servers.filter((x) => x.brandId === b.id).map((x) => x.id)
                    d.channels = d.channels.filter((c) => !servers.includes(c.serverId))
                    d.servers = d.servers.filter((x) => x.brandId !== b.id)
                    d.brands = d.brands.filter((x) => x.id !== b.id)
                  })
                }
              />
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-[auto_1fr_8rem_auto] items-end gap-2 border-t border-border pt-3">
          <input type="color" aria-label="新しいブランドの表示色" value={color} onChange={(e) => setColor(e.target.value)} className="size-9 cursor-pointer rounded-md border border-input bg-card p-1" />
          <Input aria-label="新しいブランド名" placeholder="ブランド名" value={name} onChange={(e) => setName(e.target.value)} />
          <Input aria-label="新しい識別コード" placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          <Button variant="outline" onClick={add}>
            <Plus className="size-4" aria-hidden />
            追加
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">識別コードは投稿IDの先頭に使われます。変更しても既存の投稿IDは変わりません。</p>
      </div>
    </Panel>
  )
}

export function AccountsSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [brandId, setBrandId] = useState(s.brands[0]?.id ?? '')
  const [platform, setPlatform] = useState<Platform>('x')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  const add = async () => {
    const ok = await edit(`アカウント「${name}」を追加しました`, (d) => {
      if (!name.trim()) return '表示名を入力してください'
      if (!CODE_RE.test(code)) return '識別コードは英大文字・数字・ハイフン2〜12文字です'
      if (d.accounts.some((a) => a.brandId === brandId && a.code === code)) return '同じブランド内で識別コードが重複しています'
      const id = newId(d, 'ac')
      d.accounts.push({
        id,
        brandId,
        platform,
        name: name.trim(),
        code,
        connection: d.live ? 'disconnected' : 'disconnected_mock',
        defaultApproverId: null,
        serverId: platform === 'discord' ? d.servers.find((sv) => sv.brandId === brandId)?.id : undefined,
      })
      for (const u of d.users) d.permissions.push({ userId: u.id, accountId: id, view: u.isAdmin, create: u.isAdmin, edit: u.isAdmin, approve: u.isAdmin, levelOverride: null })
    })
    if (ok) {
      setName('')
      setCode('')
    }
  }

  return (
    <Panel title="SNSアカウント" id="accounts" bodyClassName="p-0" actions={s.live ? <CheckConnectionsButton /> : undefined}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {['ブランド', '媒体', '表示名', '識別コード', s.live ? '接続' : '接続（モック）', '標準承認者', ''].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.accounts.map((a) => {
              const approvers = s.users.filter((u) => u.status === 'active' && s.permissions.some((p) => p.userId === u.id && p.accountId === a.id && p.approve))
              return (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <BrandDot brand={s.brands.find((b) => b.id === a.brandId)} />
                      {s.brands.find((b) => b.id === a.brandId)?.name}
                    </span>
                  </td>
                  <td className="px-3 py-2">{PLATFORM_LABEL[a.platform]}</td>
                  <td className="px-3 py-2">
                    <CommitInput label={`${a.name}の表示名`} value={a.name} onCommit={(v) => edit('表示名を変更しました', (d) => (v ? void (d.accounts.find((x) => x.id === a.id)!.name = v) : '表示名を入力してください'))} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs">{a.code}</span>
                  </td>
                  <td className="px-3 py-2">
                    {s.live ? (
                      <span className="flex flex-col gap-1.5">
                        <ConnectionPill account={a} />
                        {a.platform === 'x' && <XConnectButton account={a} />}
                      </span>
                    ) : (
                    <span className="flex items-center gap-2">
                      <Switch
                        label={`${a.name}の接続状態`}
                        checked={a.connection === 'connected_mock'}
                        onChange={(v) => edit(v ? '接続済み（モック）にしました' : '未接続（モック）にしました', (d) => void (d.accounts.find((x) => x.id === a.id)!.connection = v ? 'connected_mock' : 'disconnected_mock'))}
                      />
                      <Pill tone={a.connection === 'connected_mock' ? 'success' : 'muted'}>{a.connection === 'connected_mock' ? '接続済み' : '未接続'}</Pill>
                    </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      aria-label={`${a.name}の標準承認者`}
                      value={a.defaultApproverId ?? ''}
                      onChange={(e) => edit('標準承認者を変更しました', (d) => void (d.accounts.find((x) => x.id === a.id)!.defaultApproverId = e.target.value || null))}
                    >
                      <option value="">指定なし</option>
                      {approvers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteButton
                      label={`アカウント「${a.name}」`}
                      inUse={() => accountInUse(s, a.id)}
                      onDelete={() =>
                        void edit(`アカウント「${a.name}」を削除しました`, (d) => {
                          const msg = accountInUse(d, a.id)
                          if (msg) return msg
                          d.accounts = d.accounts.filter((x) => x.id !== a.id)
                          d.permissions = d.permissions.filter((p) => p.accountId !== a.id)
                        })
                      }
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 items-end gap-2 border-t border-border p-3 md:grid-cols-[1fr_1fr_2fr_1fr_auto]">
        <Field label="ブランド" htmlFor="na-brand">
          <Select id="na-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {s.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="媒体" htmlFor="na-pf">
          <Select id="na-pf" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).filter((p) => p !== 'web').map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="表示名" htmlFor="na-name">
          <Input id="na-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="識別コード" htmlFor="na-code">
          <Input id="na-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
        </Field>
        <Button variant="outline" onClick={add}>
          <Plus className="size-4" aria-hidden />
          追加
        </Button>
      </div>
      <p className="px-3 pb-3 text-xs text-muted-foreground">
        {s.live
          ? 'Xは「Xと接続」でアカウントごとのトークンを登録します。Discordは下の「Discord」でサーバーIDを入れてチャンネルを取得すると接続済みになります。Instagramの自動送信は未対応です。追加直後は管理者以外に権限がありません。'
          : '接続状態はモックです。実際のSNS連携・認証は行いません。追加直後は管理者以外に権限がありません。'}
      </p>
    </Panel>
  )
}

export function DiscordSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [names, setNames] = useState<Record<string, string>>({})

  return (
    <Panel title="Discord" id="discord">
      <div className="flex flex-col gap-4">
        {s.servers.map((sv) => {
          const chans = s.channels.filter((c) => c.serverId === sv.id)
          return (
            <section key={sv.id} className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <BrandDot brand={s.brands.find((b) => b.id === sv.brandId)} />
                {sv.name}
              </h3>
              {s.live && (
                <div className="flex flex-wrap items-end gap-2">
                  <Field label="DiscordのサーバーID" htmlFor={`guild-${sv.id}`} hint="Discordの開発者モードで、サーバー名を右クリック →「サーバーIDをコピー」">
                    <CommitInput
                      id={`guild-${sv.id}`}
                      label={`${sv.name}のDiscordサーバーID`}
                      value={sv.guildId ?? ''}
                      className="font-mono"
                      onCommit={(v) =>
                        edit('サーバーIDを保存しました', (d) => {
                          if (v && !/^\d{15,22}$/.test(v)) return 'サーバーIDは数字です'
                          d.servers.find((x) => x.id === sv.id)!.guildId = v || undefined
                        })
                      }
                    />
                  </Field>
                  <SyncDiscordButton server={sv} />
                </div>
              )}
              {(sv.ignoredChannelIds?.length ?? 0) > 0 && (
                <button
                  type="button"
                  className="w-fit text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() =>
                    void edit('削除したチャンネルを戻せるようにしました。「Discordからチャンネルを取得」で再び取り込まれます', (d) => {
                      d.servers.find((x) => x.id === sv.id)!.ignoredChannelIds = []
                    })
                  }
                >
                  削除したチャンネル（{sv.ignoredChannelIds!.length}件）を戻す
                </button>
              )}
              {chans.length ? (
                <details className="group rounded-md border border-border">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                    <span className="font-medium">チャンネル</span>
                    <span className="text-xs text-muted-foreground">
                      全{chans.length}件・投稿可能 {chans.filter((c) => c.postable).length}件
                    </span>
                  </summary>
                  <ul className="flex flex-col divide-y divide-border border-t border-border">
                    {[...chans]
                      .sort((a, b) => Number(b.postable) - Number(a.postable))
                      .map((c) => (
                        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                          <span className="flex items-center gap-2">
                            #{c.name}
                            {s.settings.notifyChannelId === c.id && <Pill tone="info">通知用</Pill>}
                            {s.live && (c.discordId ? <span className="font-mono text-xs text-muted-foreground">{c.discordId}</span> : <Pill tone="warning">Discord未連携</Pill>)}
                          </span>
                          <span className="flex items-center gap-2 text-xs text-muted-foreground">
                            投稿可能
                            <Switch
                              label={`#${c.name}を投稿先にする`}
                              checked={c.postable}
                              disabled={s.settings.notifyChannelId === c.id}
                              onChange={(v) => edit(v ? '投稿可能にしました' : '投稿先から外しました', (d) => void (d.channels.find((x) => x.id === c.id)!.postable = v))}
                            />
                            <DeleteButton
                              label={`#${c.name}`}
                              inUse={() => channelInUse(s, c.id)}
                              onDelete={() =>
                                void edit(`#${c.name} を削除しました`, (d) => {
                                  const msg = channelInUse(d, c.id)
                                  if (msg) return msg
                                  d.channels = d.channels.filter((x) => x.id !== c.id)
                                  // 「Discordからチャンネルを取得」で再び追加しないよう覚えておく
                                  const srv = d.servers.find((x) => x.id === c.serverId)
                                  if (srv && c.discordId) srv.ignoredChannelIds = [...new Set([...(srv.ignoredChannelIds ?? []), c.discordId])]
                                })
                              }
                            />
                          </span>
                        </li>
                      ))}
                  </ul>
                </details>
              ) : (
                <p className="text-sm text-muted-foreground">チャンネルがありません。</p>
              )}
              {!s.live && <div className="flex gap-2">
                <Input aria-label={`${sv.name}に追加するチャンネル名`} placeholder="チャンネル名" value={names[sv.id] ?? ''} onChange={(e) => setNames((n) => ({ ...n, [sv.id]: e.target.value }))} />
                <Button
                  variant="outline"
                  onClick={async () => {
                    const n = (names[sv.id] ?? '').trim().replace(/^#/, '')
                    const ok = await edit(`#${n} を追加しました`, (d) => {
                      if (!n) return 'チャンネル名を入力してください'
                      if (d.channels.some((c) => c.serverId === sv.id && c.name === n)) return '同名のチャンネルがあります'
                      d.channels.push({ id: newId(d, 'ch'), serverId: sv.id, name: n, postable: true })
                    })
                    if (ok) setNames((x) => ({ ...x, [sv.id]: '' }))
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  追加
                </Button>
              </div>}
            </section>
          )
        })}
        <p className="text-xs text-muted-foreground">
          通知先チャンネルは投稿先とは別に「Discord通知」で1つだけ設定します。通知用チャンネルは投稿先にできません。
          使わないチャンネルは削除できます（投稿・繰り返し予約で使っているチャンネルは削除できないので「投稿可能」をオフに）。削除したチャンネルは「Discordからチャンネルを取得」でも再び追加されません。
        </p>
      </div>
    </Panel>
  )
}

export function PostTypesSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [name, setName] = useState('')
  return (
    <Panel title="投稿の種類" id="types">
      <div className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
          {s.postTypes.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <CommitInput
                label={`${t.name}の名前`}
                value={t.name}
                className="sm:max-w-64"
                onCommit={(v) =>
                  edit('種類名を変更しました', (d) => {
                    if (!v) return '種類名を入力してください'
                    if (d.postTypes.some((x) => x.id !== t.id && x.name === v)) return '同じ名前の種類があります'
                    d.postTypes.find((x) => x.id === t.id)!.name = v
                  })
                }
              />
              <span className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2">
                  定期投稿扱い
                  <Switch label={`${t.name}を定期投稿扱いにする`} checked={t.routine} onChange={(v) => edit('投稿種類を更新しました', (d) => void (d.postTypes.find((x) => x.id === t.id)!.routine = v))} />
                </label>
                <label className="flex items-center gap-2">
                  重要投稿扱い
                  <Switch label={`${t.name}を重要投稿扱いにする`} checked={t.important} onChange={(v) => edit('投稿種類を更新しました', (d) => void (d.postTypes.find((x) => x.id === t.id)!.important = v))} />
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-danger"
                  disabled={s.postTypes.length <= 1}
                  title={s.postTypes.length <= 1 ? '種類は1つ以上必要です' : undefined}
                  onClick={() => {
                    const inUse = postTypeInUse(s, t.id)
                    if (inUse) return void toast(inUse, false)
                    if (!window.confirm(`投稿の種類「${t.name}」を削除しますか？`)) return
                    void edit(`「${t.name}」を削除しました`, (d) => {
                      const msg = postTypeInUse(d, t.id)
                      if (msg) return msg
                      if (d.postTypes.length <= 1) return '種類は1つ以上必要です'
                      d.postTypes = d.postTypes.filter((x) => x.id !== t.id)
                    })
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  削除
                </Button>
              </span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input aria-label="新しい投稿種類名" placeholder="種類名" value={name} onChange={(e) => setName(e.target.value)} />
          <Button
            variant="outline"
            onClick={async () => {
              const ok = await edit(`「${name}」を追加しました`, (d) => {
                if (!name.trim()) return '種類名を入力してください'
                d.postTypes.push({ id: newId(d, 'pt'), name: name.trim(), routine: false, important: false })
              })
              if (ok) setName('')
            }}
          >
            <Plus className="size-4" aria-hidden />
            追加
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">定期投稿扱いはレベル②の内容自動承認に使われます。繰り返し予約とは別の設定です。重要投稿扱いは別のレベル②以上の承認が必要になります。</p>
      </div>
    </Panel>
  )
}
