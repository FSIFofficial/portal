'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Copy, Save } from 'lucide-react'
import type { DraftFields, UnitFields } from '@/lib/kouhou/domain/actions'
import { createPosts } from '@/lib/kouhou/domain/actions'
import { canCreate } from '@/lib/kouhou/domain/rules'
import { isValidDateTime } from '@/lib/kouhou/domain/time'
import { PLATFORM_LABEL } from '@/lib/kouhou/domain/labels'
import { runAction, useAppState, useCurrentUser } from '@/lib/kouhou/store/store'
import { useUi } from '@/lib/kouhou/store/ui'
import { Button } from '@/components/kouhou/ui/button'
import { EmptyState, Notice, Panel, Tabs } from '@/components/kouhou/kit/primitives'
import { toastResult } from '@/components/kouhou/kit/toast'
import { BrandDot, PlatformMark } from '@/components/kouhou/domain/tags'
import { DraftFieldsForm } from '@/components/kouhou/post/draft-fields'
import { UnitEditor } from '@/components/kouhou/post/unit-editor'
import { cn } from '@/lib/utils'

export function NewPostScreen({ initialAt, initialPlanId }: { initialAt?: string; initialPlanId?: string }) {
  const s = useAppState()
  const user = useCurrentUser()
  const { brand } = useUi()
  const router = useRouter()

  const creatable = useMemo(() => s.accounts.filter((a) => canCreate(s, user, a.id).ok && (brand === 'all' || a.brandId === brand)), [s, user, brand])

  const [fields, setFields] = useState<DraftFields>(() => ({
    title: s.plans.find((p) => p.id === initialPlanId)?.title ?? '',
    typeId: s.postTypes[0]?.id ?? '',
    importantManual: false,
    planId: s.plans.some((p) => p.id === initialPlanId) ? initialPlanId! : null,
    assigneeId: user?.id ?? '',
    designatedApproverId: null,
    draftDue: null,
    approvalDue: null,
    scheduledAt: initialAt && isValidDateTime(initialAt) ? initialAt : null,
  }))
  const [units, setUnits] = useState<UnitFields[]>([])
  const [active, setActive] = useState<string>('')

  const toggleAccount = (id: string) => {
    if (units.some((u) => u.accountId === id)) {
      const next = units.filter((u) => u.accountId !== id)
      setUnits(next)
      if (active === id) setActive(next[0]?.accountId ?? '')
      return
    }
    const base = units.find((u) => u.accountId === active) ?? units[0]
    setUnits([...units, { accountId: id, channelId: null, body: base?.body ?? '', assetIds: base ? [...base.assetIds] : [] }])
    if (!units.length) setActive(id)
  }

  const patchUnit = (id: string, patch: Partial<UnitFields>) => setUnits((list) => list.map((u) => (u.accountId === id ? { ...u, ...patch } : u)))

  const copyToOthers = (id: string) => {
    const src = units.find((u) => u.accountId === id)
    if (!src) return
    setUnits((list) => list.map((u) => (u.accountId === id ? u : { ...u, body: src.body, assetIds: [...src.assetIds] })))
  }

  const submit = async () => {
    const r = await toastResult(runAction(createPosts, fields, units))
    if (r.ok && r.id) router.push(r.ids && r.ids.length > 1 ? '/kouhou/posts' : `/kouhou/posts/detail?id=${encodeURIComponent(r.id)}`)
  }

  const activeUnit = units.find((u) => u.accountId === active) ?? units[0]
  const activeAccount = activeUnit ? s.accounts.find((a) => a.id === activeUnit.accountId) : undefined
  const brandIds = [...new Set(units.map((u) => s.accounts.find((a) => a.id === u.accountId)?.brandId).filter((x): x is string => !!x))]

  if (!creatable.length) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold">新規投稿</h1>
        <EmptyState title="作成できるアカウントがありません">アカウントの作成権限は管理者が設定します。</EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/kouhou/posts" className="rounded-md p-2 hover:bg-muted" aria-label="投稿一覧に戻る">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="text-2xl font-bold">新規投稿</h1>
        </div>
        <Button onClick={submit}>
          <Save aria-hidden />
          原稿を作成
        </Button>
      </header>

      <Panel title="投稿先" actions={<span className="text-xs text-muted-foreground">複数選ぶと投稿先ごとに別IDの公開単位になります</span>}>
        <fieldset>
          <legend className="sr-only">投稿先アカウント</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {creatable.map((a) => {
              const b = s.brands.find((x) => x.id === a.brandId)
              const on = units.some((u) => u.accountId === a.id)
              return (
                <label key={a.id} className={cn('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors hover:bg-muted', on && 'border-primary bg-primary/5')}>
                  <input type="checkbox" checked={on} onChange={() => toggleAccount(a.id)} className="size-4 accent-primary" />
                  <PlatformMark platform={a.platform} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{a.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BrandDot brand={b} />
                      {b?.name} ・ {PLATFORM_LABEL[a.platform]}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </Panel>

      <Panel title="管理情報">
        <DraftFieldsForm value={fields} onChange={(p) => setFields((f) => ({ ...f, ...p }))} brandIds={brandIds} />
      </Panel>

      <Panel title="投稿内容">
        {!activeUnit || !activeAccount ? (
          <p className="rounded-md border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">投稿先を選ぶと、本文・素材・プレビューを編集できます</p>
        ) : (
          <div className="flex flex-col gap-4">
            {units.length > 1 && (
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Tabs
                  label="投稿先ごとの内容"
                  value={activeUnit.accountId}
                  onChange={setActive}
                  items={units.map((u) => {
                    const a = s.accounts.find((x) => x.id === u.accountId)!
                    return { value: u.accountId, label: a.name }
                  })}
                />
                <Button variant="outline" size="sm" onClick={() => copyToOthers(activeUnit.accountId)}>
                  <Copy aria-hidden />
                  この内容を他の投稿先にコピー
                </Button>
              </div>
            )}
            <UnitEditor key={activeUnit.accountId} idPrefix={`u-${activeUnit.accountId}`} account={activeAccount} unit={activeUnit} onChange={(p) => patchUnit(activeUnit.accountId, p)} />
          </div>
        )}
      </Panel>

      <Notice tone="info" title="作成後の流れ">
        作成後に「内容を完了」すると内容承認へ、予定日時を入れると日時承認へ進みます。内容承認と日時承認の両方が揃うと「予約を確定」できます。
      </Notice>

      <div className="flex justify-end">
        <Button onClick={submit} size="lg">
          <Save aria-hidden />
          原稿を作成
        </Button>
      </div>
    </div>
  )
}
