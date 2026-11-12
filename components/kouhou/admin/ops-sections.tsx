'use client'

import { useState } from 'react'
import { OctagonX } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { useAction, useAppState } from '@/lib/kouhou/store/store'
import { DEMO_STOP_CODE, countStopTargets, emergencyStop, releaseStop } from '@/lib/kouhou/domain/actions'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import type { EmergencyStop } from '@/lib/kouhou/domain/types'
import { Dialog, Field, Input, Notice, Panel, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { UserName } from '@/components/kouhou/domain/tags'
import { toastResult } from '@/components/kouhou/kit/toast'
import { useAdminEdit } from './use-admin'

export function NotifySection() {
  const s = useAppState()
  const edit = useAdminEdit()
  const [mentions, setMentions] = useState(s.settings.notifyMentions.join(', '))
  const channelName = (id: string) => s.channels.find((c) => c.id === id)?.name ?? '未設定'
  const parsed = mentions
    .split(/[,、\s]+/)
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => (m.startsWith('@') ? m : `@${m}`))

  return (
    <Panel title="Discord通知" id="notify">
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="通知先チャンネル（1つ）" htmlFor="nt-ch">
            <Select
              id="nt-ch"
              value={s.settings.notifyChannelId}
              onChange={(e) =>
                edit('通知先を変更しました', (d) => {
                  const ch = d.channels.find((c) => c.id === e.target.value)
                  if (!ch) return 'チャンネルが見つかりません'
                  d.settings.notifyChannelId = ch.id
                  ch.postable = false
                })
              }
            >
              {s.channels.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.name}（{s.servers.find((sv) => sv.id === c.serverId)?.name}）
                </option>
              ))}
            </Select>
          </Field>
          <Field label="メンション先" htmlFor="nt-m" hint="カンマ区切り。例：@広報チーム, @管理者A">
            <div className="flex gap-2">
              <Input id="nt-m" value={mentions} onChange={(e) => setMentions(e.target.value)} />
              <Button variant="outline" onClick={() => edit('メンション先を保存しました', (d) => void (d.settings.notifyMentions = parsed))}>
                保存
              </Button>
            </div>
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">送信プレビュー</h3>
          <div className="rounded-md border border-border bg-muted p-3 font-mono text-sm leading-relaxed">
            <p className="text-xs text-muted-foreground">#{channelName(s.settings.notifyChannelId)}</p>
            <p>
              {parsed.join(' ')} 【日時確定】宇宙知っトク11月 月探査回 ― 11/10(火) 19:00 に予約できます
            </p>
          </div>
          <p className="text-xs text-muted-foreground">デモのため実際には送信しません。下の履歴は「未送信」として記録されます。</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold">通知履歴</h3>
          {s.notifications.length ? (
            <ul className="flex max-h-72 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
              {s.notifications.slice(0, 50).map((n) => (
                <li key={n.id} className="flex flex-col gap-0.5 px-3 py-2 text-sm">
                  <span className="tabular text-xs text-muted-foreground">
                    {formatDateTime(n.at)}・#{channelName(n.channelId)}
                    {n.mentions.length > 0 && `・${n.mentions.join(' ')}`}
                  </span>
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">通知履歴はまだありません。</p>
          )}
        </div>
      </div>
    </Panel>
  )
}

export function EmergencySection({ isAdmin }: { isAdmin: boolean }) {
  const s = useAppState()
  const act = useAction()
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<EmergencyStop['scope']>('all')
  const [targetId, setTargetId] = useState('')
  const [reason, setReason] = useState('')
  const [code, setCode] = useState('')

  const options = scope === 'brand' ? s.brands.map((b) => ({ id: b.id, name: b.name })) : scope === 'account' ? s.accounts.map((a) => ({ id: a.id, name: a.name })) : []
  const count = countStopTargets(s, scope, scope === 'all' ? null : targetId || null)
  const describe = (st: EmergencyStop) =>
    st.scope === 'all' ? '全体' : st.scope === 'brand' ? `ブランド：${s.brands.find((b) => b.id === st.targetId)?.name}` : `アカウント：${s.accounts.find((a) => a.id === st.targetId)?.name}`

  const close = () => {
    setOpen(false)
    setReason('')
    setCode('')
  }
  const run = () => {
    const r = toastResult(act(emergencyStop, scope, scope === 'all' ? null : targetId || null, reason, code))
    setCode('')
    if (r.ok) close()
  }

  return (
    <Panel title="緊急停止" id="stop">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">対象の予約をすべて保留にします。解除しても過去日時の予約は一括送信されず、再予約が必要な状態で残ります。送信処理中の投稿を取り消せる保証はありません。</p>
        {s.stops.length > 0 && (
          <ul className="flex flex-col gap-2">
            {s.stops.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm">
                <span className="flex flex-col">
                  <span className="font-medium text-danger">停止中：{describe(st)}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(st.at)}・<UserName s={s} id={st.by} />・{st.reason}
                  </span>
                </span>
                <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => toastResult(act(releaseStop, st.id))}>
                  解除
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button variant="destructive" className="w-fit" disabled={!isAdmin} onClick={() => setOpen(true)}>
          <OctagonX className="size-4" aria-hidden />
          緊急停止を実行
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={close}
        title="緊急停止"
        description="対象と件数を確認し、理由と確認値を入力してください。"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              キャンセル
            </Button>
            <Button variant="destructive" disabled={!reason.trim() || !code || (scope !== 'all' && !targetId)} onClick={run}>
              {count}件を保留にする
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="対象範囲" htmlFor="st-scope">
            <Select
              id="st-scope"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as EmergencyStop['scope'])
                setTargetId('')
              }}
            >
              <option value="all">全体</option>
              <option value="brand">ブランド</option>
              <option value="account">アカウント</option>
            </Select>
          </Field>
          {scope !== 'all' && (
            <Field label={scope === 'brand' ? 'ブランド' : 'アカウント'} htmlFor="st-target" required>
              <Select id="st-target" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">選択してください</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <p className="rounded-md bg-muted px-3 py-2 text-sm" aria-live="polite">
            対象の予約：<span className="tabular font-semibold">{count}件</span>
          </p>
          <Field label="停止理由" htmlFor="st-reason" required>
            <Textarea id="st-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Notice tone="warning" title="デモ専用">
            {`実際の追加認証ではありません。確認値「${DEMO_STOP_CODE}」を入力してください。入力値は保存・履歴表示しません。`}
          </Notice>
          <Field label="確認値（追加パスワード）" htmlFor="st-code" required>
            <Input id="st-code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </Panel>
  )
}
