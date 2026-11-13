'use client'

import { useState } from 'react'
import { ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { liveAdmin, useAppState, useLiveMeta } from '@/lib/kouhou/store/store'
import { ACCESS_ROLES } from '@/lib/kouhou/domain/commands'
import { toastResult } from '@/components/kouhou/kit/toast'
import { newId } from '@/lib/kouhou/domain/actions'
import { PLATFORM_CODE } from '@/lib/kouhou/domain/labels'
import type { AccountPermission, Level, User } from '@/lib/kouhou/domain/types'
import { Field, Input, Notice, Panel, Pill, Select, Switch } from '@/components/kouhou/kit/primitives'
import { useAdminEdit } from './use-admin'

const STATUS_LABEL: Record<User['status'], { label: string; tone: 'success' | 'info' | 'danger' }> = {
  active: { label: '利用中', tone: 'success' },
  invited: { label: '招待中', tone: 'info' },
  suspended: { label: '利用停止', tone: 'danger' },
}
const LEVEL_LABEL: Record<Level, string> = { 1: 'レベル①', 2: 'レベル②', 3: 'レベル③' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const accessUrl = () => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/access/`

/** 利用者を FSIF Access Manager（/access/）で管理しているとき：一覧は表示だけ */
function ManagedUsersSection() {
  const s = useAppState()
  const { pending } = useLiveMeta()
  return (
    <Panel
      title="利用者"
      id="users"
      bodyClassName="p-0"
      actions={
        <>
          <a href={accessUrl()} className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium hover:bg-muted">
            <ExternalLink className="size-3.5" aria-hidden />
            アクセス権限管理を開く
          </a>
          <Button size="sm" variant="outline" className="gap-1" disabled={pending > 0} onClick={() => void toastResult(liveAdmin('syncAccess'))}>
            <RefreshCw className="size-3.5" aria-hidden />
            今すぐ同期
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2 p-3 text-sm">
        <Notice tone="info" title="利用者はアクセス権限管理で管理しています">
          広報管理を使える人と役割は、アクセス権限管理（/access/）の「広報管理」で付与します。付与した人は、広報管理を開いたときに自動で登録されます（1時間ごとにも同期し、権限が外れた人は利用停止になります）。
          SNSアカウントごとの閲覧・作成・編集・承認は、下の「権限」で調整します。
        </Notice>
        <table className="w-full max-w-xl text-xs">
          <caption className="mb-1 text-left font-semibold">役割とレベルの対応（アクセス権限管理の役割キー）</caption>
          <tbody>
            {ACCESS_ROLES.map((r) => (
              <tr key={r.roleKey} className="border-t border-border">
                <td className="py-1 pr-3 font-mono">{r.roleKey}</td>
                <td className="py-1 pr-3 font-medium">{r.label}</td>
                <td className="py-1 text-muted-foreground">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {['利用者', '状態', 'レベル', '管理者'].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">
                  <span className="flex flex-col">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Pill tone={STATUS_LABEL[u.status].tone}>{u.status === 'suspended' ? '権限なし' : STATUS_LABEL[u.status].label}</Pill>
                </td>
                <td className="px-3 py-2">{LEVEL_LABEL[u.level]}</td>
                <td className="px-3 py-2">{u.isAdmin ? <Pill tone="info">管理者</Pill> : <span className="text-muted-foreground">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

export function UsersSection() {
  const s = useAppState()
  if (s.settings.usersManagedBy === 'access') return <ManagedUsersSection />
  return <LocalUsersSection />
}

function LocalUsersSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')

  const invite = async () => {
    const ok = await edit(s.live ? `${email} を登録しました。本人がポータルにログインした状態で広報管理を開くと利用中になります` : `${email} を招待しました（デモ：メールは送信しません）`, (d) => {
      if (!name.trim()) return '表示名を入力してください'
      if (!EMAIL_RE.test(email)) return 'Googleアカウントのメールアドレスを入力してください'
      if (d.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return 'このメールアドレスは登録済みです'
      const id = newId(d, 'u')
      d.users.push({ id, name: name.trim(), email: email.trim(), isAdmin: false, level: 1, status: 'invited', publishSuccessCount: 0 })
      for (const a of d.accounts) d.permissions.push({ userId: id, accountId: a.id, view: true, create: false, edit: false, approve: false, levelOverride: null })
    })
    if (ok) {
      setEmail('')
      setName('')
    }
  }

  return (
    <Panel title="利用者" id="users" bodyClassName="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {['利用者', '状態', '標準レベル', '管理者', '操作'].map((h) => (
                <th key={h} scope="col" className="px-3 py-2 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.users.map((u) => {
              const self = u.id === s.currentUserId
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="flex flex-col">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Pill tone={STATUS_LABEL[u.status].tone}>{STATUS_LABEL[u.status].label}</Pill>
                  </td>
                  <td className="px-3 py-2">
                    <Select aria-label={`${u.name}の標準レベル`} value={u.level} onChange={(e) => edit('標準レベルを変更しました', (d) => void (d.users.find((x) => x.id === u.id)!.level = Number(e.target.value) as Level))}>
                      {([1, 2, 3] as Level[]).map((l) => (
                        <option key={l} value={l}>
                          {LEVEL_LABEL[l]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Switch
                      label={`${u.name}を管理者にする`}
                      checked={u.isAdmin}
                      disabled={self}
                      onChange={(v) => edit(v ? '管理者ロールを付与しました' : '管理者ロールを外しました', (d) => void (d.users.find((x) => x.id === u.id)!.isAdmin = v))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1.5">
                      {u.status === 'invited' && !s.live && (
                        <Button size="sm" variant="outline" onClick={() => edit(`${u.name}を利用中にしました（デモ：招待承諾を再現）`, (d) => void (d.users.find((x) => x.id === u.id)!.status = 'active'))}>
                          承諾を再現
                        </Button>
                      )}
                      {u.status !== 'suspended' ? (
                        <Button size="sm" variant="outline" disabled={self} onClick={() => edit(`${u.name}を利用停止にしました`, (d) => void (d.users.find((x) => x.id === u.id)!.status = 'suspended'))}>
                          利用停止
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => edit(`${u.name}の利用を再開しました`, (d) => void (d.users.find((x) => x.id === u.id)!.status = 'active'))}>
                          再開
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="grid items-end gap-2 border-t border-border p-3 sm:grid-cols-[1fr_2fr_auto]">
        <Field label="表示名" htmlFor="nu-name">
          <Input id="nu-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Googleメールアドレス" htmlFor="nu-email">
          <Input id="nu-email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button variant="outline" onClick={invite}>
          <Plus className="size-4" aria-hidden />
          招待
        </Button>
      </div>
      <p className="px-3 pb-3 text-xs text-muted-foreground">自分自身の管理者ロール解除・利用停止はできません。招待メールは送信されません。</p>
    </Panel>
  )
}

const FLAGS: { key: keyof Pick<AccountPermission, 'view' | 'create' | 'edit' | 'approve'>; label: string }[] = [
  { key: 'view', label: '閲覧' },
  { key: 'create', label: '作成' },
  { key: 'edit', label: '編集' },
  { key: 'approve', label: '承認' },
]

export function PermissionsSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [userId, setUserId] = useState(s.users[0]?.id ?? '')
  const user = s.users.find((u) => u.id === userId)

  const setFlag = (accountId: string, key: (typeof FLAGS)[number]['key'], v: boolean) =>
    edit('権限を更新しました', (d) => {
      let p = d.permissions.find((x) => x.userId === userId && x.accountId === accountId)
      if (!p) {
        p = { userId, accountId, view: false, create: false, edit: false, approve: false, levelOverride: null }
        d.permissions.push(p)
      }
      p[key] = v
      if (key === 'view' && !v) p.create = p.edit = p.approve = false
      if (key !== 'view' && v) p.view = true
    })

  return (
    <Panel title="権限" id="permissions">
      <div className="flex flex-col gap-3">
        <Field label="利用者" htmlFor="perm-user" className="max-w-xs">
          <Select id="perm-user" value={userId} onChange={(e) => setUserId(e.target.value)}>
            {s.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}（標準 {LEVEL_LABEL[u.level]}）
              </option>
            ))}
          </Select>
        </Field>
        {user?.status === 'suspended' && <Notice tone="warning">この利用者は利用停止中のため、権限に関わらずログインできません。</Notice>}
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[620px] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">アカウント</th>
                {FLAGS.map((f) => (
                  <th key={f.key} scope="col" className="px-3 py-2 text-center font-medium">
                    {f.label}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-left font-medium">レベル（上書き）</th>
              </tr>
            </thead>
            <tbody>
              {s.accounts.map((a) => {
                const p = s.permissions.find((x) => x.userId === userId && x.accountId === a.id)
                return (
                  <tr key={a.id} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <span className="mr-1 font-mono text-xs text-muted-foreground">{PLATFORM_CODE[a.platform]}</span>
                      {a.name}
                    </th>
                    {FLAGS.map((f) => (
                      <td key={f.key} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${a.name}の${f.label}`}
                          checked={Boolean(p?.[f.key])}
                          onChange={(e) => setFlag(a.id, f.key, e.target.checked)}
                          className="size-4 accent-primary"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      <Select
                        aria-label={`${a.name}のレベル上書き`}
                        value={p?.levelOverride ?? ''}
                        onChange={(e) =>
                          edit('アカウント別レベルを更新しました', (d) => {
                            const t = d.permissions.find((x) => x.userId === userId && x.accountId === a.id)
                            if (!t) return '先に閲覧権限を付与してください'
                            t.levelOverride = e.target.value ? (Number(e.target.value) as Level) : null
                          })
                        }
                      >
                        <option value="">標準（{user ? LEVEL_LABEL[user.level] : ''}）</option>
                        {([1, 2, 3] as Level[]).map((l) => (
                          <option key={l} value={l}>
                            {LEVEL_LABEL[l]}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">変更はすぐに全画面の判定（閲覧・作成・編集・承認）へ反映されます。編集は権限と最終編集者ロックの両方を満たしたときだけ可能です。</p>
      </div>
    </Panel>
  )
}

export function PromotionSection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const t = s.settings.promotionThreshold
  const candidates = s.users.filter((u) => u.status === 'active' && u.level < 3 && u.publishSuccessCount >= t)
  return (
    <Panel title="昇格検討" id="promotion">
      <div className="flex flex-col gap-3">
        <Field label="通知基準（公開成功回数）" htmlFor="promo-t" hint="基準に達すると昇格検討の対象として表示します。自動昇格はしません。" className="max-w-xs">
          <Input
            id="promo-t"
            type="number"
            min={1}
            key={t}
            defaultValue={t}
            onBlur={(e) => {
              const v = Number(e.target.value)
              if (v === t) return
              const input = e.target
              void edit('通知基準を変更しました', (d) => (v >= 1 && Number.isInteger(v) ? void (d.settings.promotionThreshold = v) : '1以上の整数で入力してください')).then((ok) => {
                if (!ok) input.value = String(t)
              })
            }}
          />
        </Field>
        {candidates.length ? (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {candidates.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{u.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    公開成功 {u.publishSuccessCount}回・現在 {LEVEL_LABEL[u.level]}
                  </span>
                </span>
                {s.settings.usersManagedBy === 'access' ? (
                  <span className="text-xs text-muted-foreground">昇格はアクセス権限管理で役割を変更してください</span>
                ) : (
                <Button size="sm" variant="outline" onClick={() => edit(`${u.name}を${LEVEL_LABEL[(u.level + 1) as Level]}に変更しました`, (d) => void (d.users.find((x) => x.id === u.id)!.level = (u.level + 1) as Level))}>
                  {LEVEL_LABEL[(u.level + 1) as Level]}へ手動変更
                </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">基準に達した利用者はいません。</p>
        )}
      </div>
    </Panel>
  )
}
