'use client'

// 本番（GAS 接続時）だけ出す、X・Discord との接続まわりの部品。
// トークンは GAS のスクリプト プロパティに保存され、画面には二度と返ってこない。

import { useState } from 'react'
import { ExternalLink, Link2, Link2Off, RefreshCw, Send } from 'lucide-react'
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
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [manual, setManual] = useState(false)
  const [token, setToken] = useState('')
  const [secret, setSecret] = useState('')
  const { pending } = useLiveMeta()
  const busy = pending > 0
  const close = () => {
    setOpen(false)
    setAuthUrl(null)
    setPin('')
    setManual(false)
    setToken('')
    setSecret('')
  }
  const start = async () => {
    const r = await toastResult(liveAdmin('xStartAuth', { accountId: account.id }))
    if (r.ok && r.url) setAuthUrl(r.url)
  }
  const finish = async () => {
    const r = await toastResult(manual ? liveAdmin('connectX', { accountId: account.id, accessToken: token, accessSecret: secret }) : liveAdmin('xFinishAuth', { accountId: account.id, pin }))
    if (r.ok) close()
  }
  const connected = account.connection === 'connected'
  const canSubmit = manual ? !!token.trim() && !!secret.trim() : !!authUrl && /^\d{5,10}$/.test(pin.trim())
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
        description="投稿に使う X アカウントで認可すると、そのアカウントとして投稿できるようになります。"
        footer={
          <>
            <Button variant="outline" onClick={close}>
              キャンセル
            </Button>
            <Button onClick={finish} disabled={!canSubmit || busy}>
              {busy ? '確認中…' : '接続する'}
            </Button>
          </>
        }
      >
        {!manual ? (
          <ol className="flex flex-col gap-4 text-sm">
            <li className="flex flex-col gap-2">
              <span className="font-semibold">1. 認可ページを開く</span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                X にログインし直す画面が開きます。必ず「{account.name}」の X アカウントでログインして「連携アプリを認証」を押してください（別のアカウントでログイン中でも、ここで切り替えられます）。
              </span>
              {authUrl ? (
                <a href={authUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 w-fit items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <ExternalLink className="size-4" aria-hidden />
                  認可ページを開く
                </a>
              ) : (
                <Button className="w-fit gap-1" variant="outline" onClick={start} disabled={busy}>
                  {busy ? '準備中…' : '認可ページを用意する'}
                </Button>
              )}
            </li>
            <li className="flex flex-col gap-2">
              <span className="font-semibold">2. 表示された PIN（数字）を入力</span>
              <Field label="PIN" htmlFor="x-pin" hint="認証後に X の画面に表示される7桁ほどの数字。15分以内に入力してください">
                <Input id="x-pin" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} disabled={!authUrl} autoComplete="off" className="font-mono" />
              </Field>
            </li>
            <li>
              <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setManual(true)}>
                トークンを直接入力する（X アプリを作った開発者アカウント本人の場合）
              </button>
            </li>
          </ol>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              X Developer Portal のアプリの「Keys and tokens」で発行した Access Token と Access Token Secret を入力します。ここで発行できるのはアプリを作ったアカウント本人のトークンだけです。アプリの権限を Read and write にしてから発行してください。
            </p>
            <Field label="Access Token" htmlFor="x-at">
              <Input id="x-at" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
            </Field>
            <Field label="Access Token Secret" htmlFor="x-as">
              <Input id="x-as" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
            </Field>
            <button type="button" className="w-fit text-xs text-muted-foreground underline underline-offset-2" onClick={() => setManual(false)}>
              認可ページで接続する方法に戻る
            </button>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">トークンは広報管理の GAS にだけ保存され、画面には表示されません。保存の前に X API でアカウントを確認します。</p>
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
