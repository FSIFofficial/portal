'use client'

// 本番（GAS 接続時）だけ出す、X・Discord との接続まわりの部品。
// トークンは GAS のスクリプト プロパティに保存され、画面には二度と返ってこない。

import { useState } from 'react'
import { ExternalLink, Link2, Link2Off, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Field, Input, Pill } from '@/components/kouhou/kit/primitives'
import { toastResult } from '@/components/kouhou/kit/toast'
import { liveAdmin, useLiveMeta } from '@/lib/kouhou/store/store'
import type { Account, DiscordChannel, DiscordServer } from '@/lib/kouhou/domain/types'

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

const WEBHOOK_HINT = 'Discord でチャンネルの「設定（歯車）→ 連携サービス → ウェブフック → 新しいウェブフック」を作り、「ウェブフックURLをコピー」した URL を貼ります'

/** チャンネルの Webhook を設定・差し替え・解除する */
export function WebhookButton({ channel }: { channel: DiscordChannel }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const { pending } = useLiveMeta()
  const close = () => {
    setOpen(false)
    setUrl('')
  }
  const submit = async () => {
    const r = await toastResult(liveAdmin('setDiscordWebhook', { channelId: channel.id, webhookUrl: url }))
    if (r.ok) close()
  }
  return (
    <>
      <span className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
          <Link2 className="size-3.5" aria-hidden />
          {channel.webhook ? 'Webhookを差し替え' : 'Webhookを設定'}
        </Button>
        {channel.webhook && (
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => window.confirm(`#${channel.name} の Webhook を外しますか？このチャンネルには送信できなくなります。`) && void toastResult(liveAdmin('removeDiscordWebhook', { channelId: channel.id }))}
          >
            <Link2Off className="size-3.5" aria-hidden />
            外す
          </Button>
        )}
      </span>
      <Dialog
        open={open}
        onClose={close}
        title={`#${channel.name} の Webhook`}
        description={WEBHOOK_HINT}
        footer={
          <>
            <Button variant="outline" onClick={close}>
              キャンセル
            </Button>
            <Button onClick={submit} disabled={!url.trim() || pending > 0}>
              {pending > 0 ? '確認中…' : '保存する'}
            </Button>
          </>
        }
      >
        <Field label="ウェブフックURL" htmlFor={`wh-${channel.id}`}>
          <Input id={`wh-${channel.id}`} type="password" placeholder="https://discord.com/api/webhooks/…" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" spellCheck={false} className="font-mono" />
        </Field>
      </Dialog>
    </>
  )
}

/** Webhook を貼って、サーバーにチャンネルを追加する */
export function AddWebhookChannel({ server }: { server: DiscordServer }) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const { pending } = useLiveMeta()
  const submit = async () => {
    const r = await toastResult(liveAdmin('setDiscordWebhook', { serverId: server.id, name, webhookUrl: url }))
    if (r.ok) {
      setName('')
      setUrl('')
    }
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-dashed border-border p-3">
      <p className="text-xs font-semibold">チャンネルを追加</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input aria-label={`${server.name}に追加するチャンネル名`} placeholder="チャンネル名（例：お知らせ）" value={name} onChange={(e) => setName(e.target.value)} />
        <Input
          aria-label={`${server.name}に追加するチャンネルのウェブフックURL`}
          type="password"
          placeholder="ウェブフックURL https://discord.com/api/webhooks/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button variant="outline" className="gap-1" disabled={!name.trim() || !url.trim() || pending > 0} onClick={submit}>
          追加
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{WEBHOOK_HINT}。URL は広報管理の GAS にだけ保存され、画面には表示されません。</p>
    </div>
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
