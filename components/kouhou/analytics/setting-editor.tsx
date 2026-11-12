'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { useAction } from '@/lib/kouhou/store/store'
import { useScope } from '@/lib/kouhou/store/hooks'
import { STANDARD_SETTING, checkpointTime, formatOffset, planCheckpoints } from '@/lib/kouhou/domain/analytics'
import { updateAnalyticsSetting } from '@/lib/kouhou/domain/actions'
import { formatDateTimeShort } from '@/lib/kouhou/domain/time'
import type { AnalyticsSetting, Post } from '@/lib/kouhou/domain/types'
import { Field, Input, Notice, Panel, Segmented, Select } from '@/components/kouhou/kit/primitives'
import { DateTimeInput } from '@/components/kouhou/kit/form-bits'
import { toastResult } from '@/components/kouhou/kit/toast'

export function AnalyticsSettingEditor({ post }: { post: Post }) {
  const { s, user } = useScope()
  const act = useAction()
  const [draft, setDraft] = useState<AnalyticsSetting>(post.analytics)
  const [newOffset, setNewOffset] = useState('')
  const canEdit = Boolean(user && s.permissions.find((p) => p.userId === user.id && p.accountId === post.accountId)?.edit)
  const base = post.publishedAt ?? post.scheduledAt
  const plan = planCheckpoints(draft, base)
  const dirty = JSON.stringify(draft) !== JSON.stringify(post.analytics)

  const setEnd = (patch: Partial<AnalyticsSetting['end']>) => setDraft((d) => ({ ...d, end: { ...d.end, ...patch } }))
  const addOffset = () => {
    const v = Number(newOffset)
    if (!(v > 0)) return
    setDraft((d) => ({ ...d, customOffsetsHours: [...d.customOffsetsHours, v] }))
    setNewOffset('')
  }

  return (
    <Panel title="取得設定">
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        {!canEdit && <Notice tone="muted">このアカウントの編集権限がないため閲覧のみです。</Notice>}
        <Segmented
          label="取得方式"
          value={draft.mode}
          onChange={(mode) => setDraft((d) => ({ ...d, mode }))}
          items={[
            { value: 'standard', label: '標準' },
            { value: 'custom', label: '個別時点' },
            { value: 'interval', label: '定間隔' },
          ]}
        />
        {draft.mode === 'standard' && <p className="text-sm text-muted-foreground">公開から1・12・24時間後に取得します。</p>}

        {draft.mode === 'custom' && (
          <div className="flex flex-col gap-2">
            <ul className="flex flex-wrap gap-1.5" aria-label="取得時点">
              {draft.customOffsetsHours.map((h, i) => (
                <li key={`${h}-${i}`} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-sm">
                  {formatOffset(h)}
                  <button
                    type="button"
                    aria-label={`${formatOffset(h)}を削除`}
                    onClick={() => setDraft((d) => ({ ...d, customOffsetsHours: d.customOffsetsHours.filter((_, j) => j !== i) }))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex items-end gap-2">
              <Field label="追加する時点（時間後）" htmlFor="off-new" className="flex-1">
                <Input id="off-new" type="number" min={0.25} step={0.25} value={newOffset} onChange={(e) => setNewOffset(e.target.value)} />
              </Field>
              <Button type="button" variant="outline" onClick={addOffset} disabled={!(Number(newOffset) > 0)}>
                <Plus className="size-4" aria-hidden />
                追加
              </Button>
            </div>
          </div>
        )}

        {draft.mode === 'interval' && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="間隔" htmlFor="iv-val">
                <Input id="iv-val" type="number" min={1} value={draft.interval.value} onChange={(e) => setDraft((d) => ({ ...d, interval: { ...d.interval, value: Number(e.target.value) } }))} />
              </Field>
              <Field label="単位" htmlFor="iv-unit">
                <Select id="iv-unit" value={draft.interval.unit} onChange={(e) => setDraft((d) => ({ ...d, interval: { ...d.interval, unit: e.target.value as AnalyticsSetting['interval']['unit'] } }))}>
                  <option value="minute">分</option>
                  <option value="hour">時間</option>
                  <option value="day">日</option>
                </Select>
              </Field>
            </div>
            <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-medium">終了条件（先に達した条件で終了）</legend>
              <EndRow label="期間（時間）" enabled={draft.end.durationHours != null} onToggle={(on) => setEnd({ durationHours: on ? 72 : null })}>
                <Input type="number" aria-label="期間（時間）" min={1} value={draft.end.durationHours ?? ''} onChange={(e) => setEnd({ durationHours: Number(e.target.value) })} />
              </EndRow>
              <EndRow label="終了日時" enabled={draft.end.endAt != null} onToggle={(on) => setEnd({ endAt: on ? (base ? checkpointTime(base, 48) : '2026-11-30T23:55') : null })}>
                <DateTimeInput label="終了日時" value={draft.end.endAt} onChange={(v) => setEnd({ endAt: v })} />
              </EndRow>
              <EndRow label="最大回数" enabled={draft.end.maxCount != null} onToggle={(on) => setEnd({ maxCount: on ? 10 : null })}>
                <Input type="number" aria-label="最大回数" min={1} value={draft.end.maxCount ?? ''} onChange={(e) => setEnd({ maxCount: Number(e.target.value) })} />
              </EndRow>
            </fieldset>
          </div>
        )}

        <div className="flex flex-col gap-1.5 rounded-md bg-muted p-3 text-sm" aria-live="polite">
          {plan.errors.length ? (
            plan.errors.map((e) => (
              <p key={e} className="text-danger">
                {e}
              </p>
            ))
          ) : (
            <>
              <p className="font-medium">
                予定 {plan.offsets.length}回{plan.stoppedBy && <span className="font-normal text-muted-foreground">（{plan.stoppedBy}で終了）</span>}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {plan.offsets
                  .slice(0, 8)
                  .map((h) => `${formatOffset(h)}${base ? `（${formatDateTimeShort(checkpointTime(base, h))}）` : ''}`)
                  .join('、')}
                {plan.offsets.length > 8 && ` ほか${plan.offsets.length - 8}回`}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDraft(STANDARD_SETTING)}>
            標準に戻す
          </Button>
          <Button type="button" disabled={!dirty || plan.errors.length > 0} onClick={() => toastResult(act(updateAnalyticsSetting, post.id, draft))}>
            設定を保存
          </Button>
        </div>
      </fieldset>
    </Panel>
  )
}

function EndRow({ label, enabled, onToggle, children }: { label: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] items-center gap-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => onToggle(e.target.checked)} className="size-4 accent-primary" />
        {label}
      </label>
      <div className={enabled ? '' : 'pointer-events-none opacity-40'} aria-hidden={!enabled}>
        {children}
      </div>
    </div>
  )
}
