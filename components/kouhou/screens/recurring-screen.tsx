'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Repeat } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import { runAction } from '@/lib/kouhou/store/store'
import type { AppState, JstDateTime, Recurrence } from '@/lib/kouhou/domain/types'
import { generateFromRecurrence, saveRecurrence, type RecurrenceInput } from '@/lib/kouhou/domain/actions'
import { canCreate, getAccount } from '@/lib/kouhou/domain/rules'
import { WEEKDAY_LABELS, addDays, dateOf, formatDateTime, isBefore, weekday } from '@/lib/kouhou/domain/time'
import { EmptyState, Field, Input, Notice, Panel, Pill, Segmented, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { AccountTag, PostId, StatusBadge } from '@/components/kouhou/domain/tags'
import { toast } from '@/components/kouhou/kit/toast'
import { cn } from '@/lib/utils'

const MAX_PREVIEW = 60

export function occurrences(r: Pick<Recurrence, 'weekdays' | 'time' | 'startDate' | 'endDate' | 'count'>): JstDateTime[] {
  if (!r.weekdays.length || !r.startDate || !/^\d{2}:\d{2}$/.test(r.time)) return []
  const out: JstDateTime[] = []
  const limit = r.count ?? MAX_PREVIEW
  let d = r.startDate
  for (let i = 0; i < 400 && out.length < Math.min(limit, MAX_PREVIEW); i++) {
    if (r.endDate && d > r.endDate) break
    if (r.weekdays.includes(weekday(d))) out.push(`${d}T${r.time}`)
    d = addDays(d, 1)
  }
  return out
}

export function RecurringScreen() {
  const { s, user, brand } = useScope()
  const recs = s.recurrences.filter((r) => brand === 'all' || r.accountIds.some((a) => getAccount(s, a)?.brandId === brand))
  const [selectedId, setSelectedId] = useState<string | null>(recs[0]?.id ?? null)
  const [creating, setCreating] = useState(false)
  const selected = s.recurrences.find((r) => r.id === selectedId)
  const creatableAccounts = s.accounts.filter((a) => canCreate(s, user, a.id).ok)

  const blank: RecurrenceInput = {
    name: '',
    accountIds: creatableAccounts[0] ? [creatableAccounts[0].id] : [],
    channelId: null,
    typeId: s.postTypes[0]?.id ?? '',
    weekdays: [3],
    time: '19:00',
    startDate: addDays(dateOf(s.now), 1),
    endDate: null,
    count: 4,
    mode: 'individual',
    templateText: '',
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">繰り返し予約</h1>
          <p className="text-sm text-muted-foreground">曜日と時刻から下書きをまとめて生成します。生成された各投稿は個別に内容承認・日時承認が必要です。</p>
        </div>
        <Button
          size="sm"
          disabled={!creatableAccounts.length}
          onClick={() => {
            setCreating(true)
            setSelectedId(null)
          }}
        >
          <Plus className="size-4" aria-hidden />
          繰り返し設定を追加
        </Button>
      </div>
      <Notice>「定期投稿扱い」は投稿種類ごとの承認上の分類で、管理者設定で決まります。この画面の繰り返し設定とは別のもので、承認を省略しません。</Notice>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <ul className="flex flex-col gap-2 lg:w-80 lg:shrink-0" aria-label="繰り返し設定一覧">
          {recs.length === 0 && !creating && <EmptyState title="繰り返し設定はありません" />}
          {recs.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(r.id)
                  setCreating(false)
                }}
                aria-current={selected?.id === r.id && !creating}
                className={cn(
                  'flex w-full flex-col gap-1.5 rounded-lg border bg-card p-3 text-left hover:bg-accent/40',
                  selected?.id === r.id && !creating && 'border-primary ring-1 ring-primary',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-bold">
                  <Repeat className="size-4 text-primary" aria-hidden />
                  {r.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  毎週{r.weekdays.map((w) => WEEKDAY_LABELS[w]).join('・')} {r.time}／{r.mode === 'template' ? 'テンプレートから作成' : '毎回個別に作成'}
                </span>
                <span className="text-xs tabular text-muted-foreground">生成済み {r.generatedPostIds.length}件</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="min-w-0 flex-1">
          {creating ? (
            <RecurrenceEditor
              key="new"
              s={s}
              initial={blank}
              onSaved={(id) => {
                setCreating(false)
                setSelectedId(id)
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selected ? (
            <RecurrenceEditor key={selected.id} s={s} initial={selected} existing={selected} onSaved={() => undefined} />
          ) : null}
        </div>
      </div>
    </div>
  )
}

function toInput(r: RecurrenceInput & { generatedPostIds?: string[] }): RecurrenceInput {
  const { id, name, accountIds, channelId, typeId, weekdays, time, startDate, endDate, count, mode, templateText } = r
  return { id, name, accountIds, channelId, typeId, weekdays, time, startDate, endDate, count, mode, templateText }
}

function RecurrenceEditor({ s, initial, existing, onSaved, onCancel }: { s: AppState; initial: RecurrenceInput; existing?: Recurrence; onSaved: (id: string) => void; onCancel?: () => void }) {
  const user = s.users.find((u) => u.id === s.currentUserId)
  const [baseline] = useState(() => toInput(initial))
  const [f, setF] = useState<RecurrenceInput>(baseline)
  const [endMode, setEndMode] = useState<'date' | 'count'>(initial.endDate ? 'date' : 'count')
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<RecurrenceInput>) => {
    setF((v) => ({ ...v, ...patch }))
    setError(null)
  }
  const input: RecurrenceInput = { ...f, endDate: endMode === 'date' ? f.endDate : null, count: endMode === 'count' ? f.count : null }
  const dates = useMemo(() => occurrences(input), [input.weekdays, input.time, input.startDate, input.endDate, input.count]) // eslint-disable-line react-hooks/exhaustive-deps
  const future = dates.filter((d) => isBefore(s.now, d))
  const accounts = s.accounts.filter((a) => canCreate(s, user, a.id).ok || f.accountIds.includes(a.id))
  const hasDiscord = f.accountIds.some((a) => getAccount(s, a)?.platform === 'discord')
  const type = s.postTypes.find((t) => t.id === f.typeId)
  const generated = existing ? s.posts.filter((p) => existing.generatedPostIds.includes(p.id)) : []
  const dirty = JSON.stringify(input) !== JSON.stringify(baseline)

  const save = () => {
    const r = runAction(saveRecurrence, input)
    if (!r.ok) return setError(r.message)
    toast(r.message ?? '保存しました')
    onSaved(r.id!)
  }
  const generate = () => {
    if (!existing) return
    const saved = runAction(saveRecurrence, input)
    if (!saved.ok) return setError(saved.message)
    const r = runAction(generateFromRecurrence, existing.id, future)
    if (!r.ok) return setError(r.message)
    toast(r.message ?? '生成しました')
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title={existing ? '繰り返し設定' : '繰り返し設定を追加'}>
        <div className="flex flex-col gap-3">
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="設定名" htmlFor="rc-name" required>
            <Input id="rc-name" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="例：宇宙知っトク 毎週水曜19時" />
          </Field>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-bold">投稿先</legend>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const on = f.accountIds.includes(a.id)
                return (
                  <label key={a.id} className={cn('flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm', on && 'border-primary bg-accent')}>
                    <input type="checkbox" checked={on} onChange={() => set({ accountIds: on ? f.accountIds.filter((x) => x !== a.id) : [...f.accountIds, a.id] })} />
                    <AccountTag s={s} account={a} />
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasDiscord && (
              <Field label="Discordチャンネル" htmlFor="rc-ch">
                <Select id="rc-ch" value={f.channelId ?? ''} onChange={(e) => set({ channelId: e.target.value || null })}>
                  <option value="">選択してください</option>
                  {s.channels.filter((c) => c.postable).map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="投稿種類" htmlFor="rc-type" hint={type ? `承認上の分類：${type.important ? '重要投稿扱い' : type.routine ? '定期投稿扱い' : '通常投稿'}` : undefined}>
              <Select id="rc-type" value={f.typeId} onChange={(e) => set({ typeId: e.target.value })}>
                {s.postTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </Field>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-bold">曜日</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((w, i) => {
                const on = f.weekdays.includes(i)
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ weekdays: on ? f.weekdays.filter((x) => x !== i) : [...f.weekdays, i].sort() })}
                    className={cn('size-10 rounded-md border text-sm', on ? 'border-primary bg-primary font-bold text-primary-foreground' : 'bg-card hover:bg-muted')}
                  >
                    {w}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="時刻（日本時間）" htmlFor="rc-time">
              <Input id="rc-time" type="time" value={f.time} onChange={(e) => set({ time: e.target.value })} />
            </Field>
            <Field label="開始日" htmlFor="rc-start">
              <Input id="rc-start" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold">終了条件</span>
              <Segmented size="sm" label="終了条件" value={endMode} onChange={setEndMode} items={[{ value: 'count', label: '回数' }, { value: 'date', label: '終了日' }]} />
              {endMode === 'count' ? (
                <Input aria-label="回数" type="number" min={1} max={MAX_PREVIEW} value={f.count ?? ''} onChange={(e) => set({ count: e.target.value ? Math.max(1, Number(e.target.value)) : null })} />
              ) : (
                <Input aria-label="終了日" type="date" value={f.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || null })} />
              )}
            </div>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-bold">原稿の作り方</legend>
            <Segmented
              label="原稿の作り方"
              value={f.mode}
              onChange={(v) => set({ mode: v })}
              items={[{ value: 'individual', label: '毎回個別に作成' }, { value: 'template', label: '原稿テンプレートから作成' }]}
            />
            {f.mode === 'template' ? (
              <Textarea aria-label="原稿テンプレート" value={f.templateText} onChange={(e) => set({ templateText: e.target.value })} placeholder="毎回の下書きにこの本文が入ります。{テーマ}などは生成後に各投稿で書き換えてください。" />
            ) : (
              <p className="text-xs leading-relaxed text-muted-foreground">日時だけ入った空の下書きを生成します。本文は毎回個別に作成してください。</p>
            )}
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            {onCancel && <Button variant="outline" onClick={onCancel}>キャンセル</Button>}
            <Button variant={existing ? 'outline' : 'default'} onClick={save} disabled={existing ? !dirty : false}>
              {existing ? '設定を保存' : '追加'}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title={<span>生成予定のプレビュー <span className="font-normal text-muted-foreground tabular">（{dates.length}件{dates.length >= MAX_PREVIEW ? '・上限表示' : ''}）</span></span>}
        actions={
          existing && (
            <Button size="sm" onClick={generate} disabled={!future.length}>
              未来の{future.length}件を下書き生成
            </Button>
          )
        }
      >
        {dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">曜日・時刻・開始日を指定すると予定が表示されます。</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
            {dates.map((d) => {
              const past = !isBefore(s.now, d)
              return (
                <li key={d} className={cn('flex items-center justify-between rounded-md border px-3 py-2 text-sm tabular', past && 'text-muted-foreground')}>
                  {formatDateTime(d)}
                  {past && <Pill>過去・生成しない</Pill>}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          生成されるのは下書きです。{f.accountIds.length > 1 ? `投稿先ごとに別の公開単位（${f.accountIds.length}件×回数）になります。` : ''}予約には各投稿の内容承認と日時承認が必要です。
        </p>
      </Panel>

      {existing && (
        <Panel title={`生成済みの投稿（${generated.length}件）`}>
          {generated.length ? (
            <ul className="flex flex-col divide-y rounded-md border">
              {generated.map((p) => (
                <li key={p.id}>
                  <Link href={`/kouhou/posts/detail?id=${encodeURIComponent(p.id)}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-accent/40">
                    <PostId id={p.id} />
                    <span className="min-w-0 flex-1 truncate">{p.title}</span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">まだ生成していません。</p>
          )}
        </Panel>
      )}
    </div>
  )
}
