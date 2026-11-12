'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save } from 'lucide-react'
import { recordManual, type ManualInput } from '@/lib/kouhou/domain/actions'
import { canCreate } from '@/lib/kouhou/domain/rules'
import { runAction, useAppState, useCurrentUser } from '@/lib/kouhou/store/store'
import { useUi } from '@/lib/kouhou/store/ui'
import { Button } from '@/components/kouhou/ui/button'
import { EmptyState, Field, Input, Notice, Panel, Select } from '@/components/kouhou/kit/primitives'
import { DateTimeInput } from '@/components/kouhou/kit/form-bits'
import { toastResult } from '@/components/kouhou/kit/toast'
import { UnitEditor } from '@/components/kouhou/post/unit-editor'

export function ManualPostScreen() {
  const s = useAppState()
  const user = useCurrentUser()
  const { brand } = useUi()
  const router = useRouter()
  const accounts = useMemo(() => s.accounts.filter((a) => canCreate(s, user, a.id).ok && (brand === 'all' || a.brandId === brand)), [s, user, brand])

  const [input, setInput] = useState<ManualInput>(() => ({
    title: '',
    accountId: accounts[0]?.id ?? '',
    channelId: null,
    typeId: s.postTypes[0]?.id ?? '',
    body: '',
    assetIds: [],
    publishedAt: s.now,
    publicUrl: '',
  }))
  const set = (p: Partial<ManualInput>) => setInput((i) => ({ ...i, ...p }))
  const account = s.accounts.find((a) => a.id === input.accountId)

  const submit = () => {
    const r = toastResult(runAction(recordManual, input))
    if (r.ok && r.id) router.push(`/kouhou/posts/detail?id=${encodeURIComponent(r.id)}`)
  }

  if (!accounts.length) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">手動投稿の記録</h1>
        <EmptyState title="記録できるアカウントがありません">アカウントの作成権限は管理者が設定します。</EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Link href="/kouhou/posts" className="rounded-md p-2 hover:bg-muted" aria-label="投稿一覧に戻る">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <h1 className="text-2xl font-bold">手動投稿の記録</h1>
      </header>
      <Notice tone="info" title="システム外で公開した投稿を記録します">
        承認・予約の手続きは不要です。記録はカレンダーと分析に「手動記録」として反映されます。
      </Notice>

      <Panel title="記録内容">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="管理用タイトル" htmlFor="m-title" required className="md:col-span-2">
            <Input id="m-title" value={input.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="アカウント" htmlFor="m-account" required>
            <Select id="m-account" value={input.accountId} onChange={(e) => set({ accountId: e.target.value, channelId: null })}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="種類" htmlFor="m-type">
            <Select id="m-type" value={input.typeId} onChange={(e) => set({ typeId: e.target.value })}>
              {s.postTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="実公開日時（日本時間）" htmlFor="m-at" required>
            <DateTimeInput id="m-at" value={input.publishedAt} onChange={(v) => set({ publishedAt: v ?? '' })} />
          </Field>
          <Field label="公開URL" htmlFor="m-url" hint="任意。公開先の投稿URLを貼り付けてください">
            <Input id="m-url" type="url" inputMode="url" placeholder="https://" value={input.publicUrl} onChange={(e) => set({ publicUrl: e.target.value })} />
          </Field>
        </div>
      </Panel>

      {account && (
        <Panel title="投稿内容">
          <UnitEditor
            key={account.id}
            idPrefix="m"
            account={account}
            unit={{ accountId: account.id, channelId: input.channelId, body: input.body, assetIds: input.assetIds }}
            onChange={(p) => set({ ...('channelId' in p ? { channelId: p.channelId ?? null } : {}), ...(p.body !== undefined ? { body: p.body } : {}), ...(p.assetIds ? { assetIds: p.assetIds } : {}) })}
          />
        </Panel>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={submit}>
          <Save aria-hidden />
          記録する
        </Button>
      </div>
    </div>
  )
}
