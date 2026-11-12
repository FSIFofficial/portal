'use client'

import { useState } from 'react'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Field, Input, Textarea } from './primitives'

/** 日本時間の壁時計 "YYYY-MM-DDTHH:mm" を入出力する */
export function DateTimeInput({ value, onChange, id, min, disabled, label }: { value: string | null; onChange: (v: string | null) => void; id?: string; min?: string; disabled?: boolean; label?: string }) {
  return (
    <Input
      id={id}
      type="datetime-local"
      aria-label={label}
      value={value ?? ''}
      min={min}
      step={300}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
      className="tabular"
    />
  )
}

export function ReasonDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: React.ReactNode
  confirmLabel: string
  onConfirm: (reason: string) => boolean | Promise<boolean>
  destructive?: boolean
}) {
  const [reason, setReason] = useState('')
  const close = () => {
    setReason('')
    onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close}>
            キャンセル
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!reason.trim()}
            onClick={() => {
              void Promise.resolve(onConfirm(reason)).then((ok) => ok && close())
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label="理由" htmlFor="reason-input" required hint="依頼者に表示されます">
        <Textarea id="reason-input" data-autofocus value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-24" />
      </Field>
    </Dialog>
  )
}
