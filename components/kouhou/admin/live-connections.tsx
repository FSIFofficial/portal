'use client'

// 本番（GAS 接続時）だけ出す、X・Discord との接続まわりの部品。
// トークンは GAS のスクリプト プロパティに保存され、画面には二度と返ってこない。

import { useState } from 'react'
import { Link2, Link2Off, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Field, Input, Pill } from '@/components/kouhou/kit/primitives'
import { toastResult } from '@/components/kouhou/kit/toast'
import { liveAdmin, useLiveMeta } from '@/lib/kouhou/store/store'
import type { Account, DiscordServer } from '@/lib/kouhou/domain/types'

export function ConnectionPill({ account }: { account: Account }) {
  const ok = account.connection === 'connected'
  return (
    <span className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1.5">
        <Pill tone={ok ? 'success' : 'muted'}>{ok ? '接続済み' : '未接続'}</Pill>
        {ok && account.platform === 'x' && account.handle && <span className="text-xs text-muted-foreground">@{account.handle}</span>}
      </span>
      {!ok && account.connectionError && <span className="max-w-60 text-xs text-danger">{account.connectionError}</span>}
      {account.platform === 'instagram' && <span className="text-xs text-muted-foreground">自動送信は未対応（手動投稿の記録で管理）</span>}
    </span>
  )
}

export function XConnectButton({ account }: { account: Account }) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const { pending } = useLiveMeta()
  const close = () => {
    setOpen(false)
    setToken('')
    setSecret('')
  }
  const submit = async () => {
    const r = await toastResult(liveAdmin('connectX', { accountId: account.id, accessToken: token, accessSecret: secret }))
    if (r.ok) close()
  }
  const connected = account.connection === 'connected'
  return (
    <>
      <span className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
          <Link2 className="size-3.5" aria-hidden />
          {connected ? '再接続' : 'Xと接続'}
        </Button>
        {connected && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => window.confirm(`${account.name} の接続を解除しますか？予約済みの投稿は送信できなくなります。`) && void toastResult(liveAdmin('disconnectX', { accountId: account.id }))}
          >
            <Link2Off className="size-3.5" aria-hidden />
            解除
          </Button>
        )}
      </span>
      <Dialog
        open={open}
        onClose={close}
        title={`${account.name} をXと接続`}
        description="X Developer Portal のアプリの「Keys and tokens」で、投稿するアカウントの Access Token と Access Token Secret を発行して入力してください（アプリの権限は Read and write）。"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              キャンセル
            </Button>
            <Button onClick={submit} disabled={!token.trim() || !secret.trim() || pending > 0}>
              {pending > 0 ? '確認中…' : '接続する'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Access Token" htmlFor="x-at">
            <Input id="x-at" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
          </Field>
          <Field label="Access Token Secret" htmlFor="x-as">
            <Input id="x-as" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
          </Field>
          <p className="text-xs leading-relaxed text-muted-foreground">
            入力した値は広報管理の GAS にだけ保存され、画面には表示されません。保存の前に X API でアカウントを確認します。API Key・API Key Secret（アプリ側）は GAS のスクリプト プロパティに設定します。
          </p>
        </div>
      </Dialog>
    </>
  )
}

export function CheckConnectionsButton() {
  const { pending } = useLiveMeta()
  return (
    <Button size="sm" variant="outline" className="gap-1" disabled={pending > 0} onClick={() => void toastResult(liveAdmin('checkConnections'))}>
      <RefreshCw className="size-3.5" aria-hidden />
      接続を確認
    </Button>
  )
}

export function SyncDiscordButton({ server }: { server: DiscordServer }) {
  const { pending } = useLiveMeta()
  return (
    <Button size="sm" variant="outline" className="gap-1" disabled={!server.guildId || pending > 0} title={server.guildId ? undefined : '先にサーバーIDを入力してください'} onClick={() => void toastResult(liveAdmin('syncDiscordChannels', { serverId: server.id }))}>
      <RefreshCw className="size-3.5" aria-hidden />
      Discordからチャンネルを取得
    </Button>
  )
}

export function TestNotifyButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useLiveMeta()
  return (
    <Button size="sm" variant="outline" className="gap-1 self-start" disabled={disabled || pending > 0} onClick={() => void toastResult(liveAdmin('testNotify'))}>
      <Send className="size-3.5" aria-hidden />
      テスト通知を送る
    </Button>
  )
}
