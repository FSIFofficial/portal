'use client'

import type { DraftFields } from '@/lib/kouhou/domain/actions'
import { useAppState } from '@/lib/kouhou/store/store'
import { getType } from '@/lib/kouhou/domain/rules'
import { isBefore } from '@/lib/kouhou/domain/time'
import { Field, Input, Select, Switch } from '@/components/kouhou/kit/primitives'
import { DateTimeInput } from '@/components/kouhou/kit/form-bits'

export function DraftFieldsForm({
  value,
  onChange,
  brandIds,
  disabled,
  scheduleLocked,
}: {
  value: DraftFields
  onChange: (patch: Partial<DraftFields>) => void
  brandIds: string[]
  disabled?: boolean
  scheduleLocked?: string
}) {
  const s = useAppState()
  const type = getType(s, value.typeId)
  const plans = s.plans.filter((p) => brandIds.length === 0 || brandIds.includes(p.brandId))
  const users = s.users.filter((u) => u.status === 'active')
  const pastSchedule = !!value.scheduledAt && !isBefore(s.now, value.scheduledAt)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="管理用タイトル" htmlFor="f-title" required className="md:col-span-2" hint="社内管理用です。投稿本文には含まれません">
        <Input id="f-title" value={value.title} onChange={(e) => onChange({ title: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="種類" htmlFor="f-type" hint={type ? [type.routine && '定型', type.important && '重要投稿'].filter(Boolean).join('・') || '通常' : undefined}>
        <Select id="f-type" value={value.typeId} onChange={(e) => onChange({ typeId: e.target.value })} disabled={disabled}>
          {s.postTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">重要投稿として扱う</span>
        <div className="flex min-h-10 items-center gap-2">
          <Switch id="f-important" label="重要投稿として扱う" checked={value.importantManual || !!type?.important} onChange={(v) => onChange({ importantManual: v })} disabled={disabled || !!type?.important} />
          <span className="text-xs leading-relaxed text-muted-foreground">{type?.important ? 'この種類は常に重要投稿です' : '本人以外の指定承認者による承認が必要になります'}</span>
        </div>
      </div>
      <Field label="担当者" htmlFor="f-assignee">
        <Select id="f-assignee" value={value.assigneeId} onChange={(e) => onChange({ assigneeId: e.target.value })} disabled={disabled}>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="指定承認者" htmlFor="f-approver" hint="未指定の場合はアカウントの承認者が対応します">
        <Select id="f-approver" value={value.designatedApproverId ?? ''} onChange={(e) => onChange({ designatedApproverId: e.target.value || null })} disabled={disabled}>
          <option value="">指定なし</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="企画" htmlFor="f-plan">
        <Select id="f-plan" value={value.planId ?? ''} onChange={(e) => onChange({ planId: e.target.value || null })} disabled={disabled}>
          <option value="">紐づけなし</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="予定日時（日本時間）" htmlFor="f-at" error={pastSchedule ? '過去の日時です。新しい日時を設定してください' : null} hint={scheduleLocked ?? '空欄のままにすると「日時未定」の原稿になります'}>
        <DateTimeInput id="f-at" value={value.scheduledAt} onChange={(v) => onChange({ scheduledAt: v })} disabled={disabled} />
      </Field>
      <Field label="原稿期限" htmlFor="f-draft-due">
        <DateTimeInput id="f-draft-due" value={value.draftDue} onChange={(v) => onChange({ draftDue: v })} disabled={disabled} />
      </Field>
      <Field label="承認期限" htmlFor="f-approval-due">
        <DateTimeInput id="f-approval-due" value={value.approvalDue} onChange={(v) => onChange({ approvalDue: v })} disabled={disabled} />
      </Field>
    </div>
  )
}
