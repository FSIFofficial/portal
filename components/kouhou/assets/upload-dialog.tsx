'use client'

// 本番：画像を Google Drive（広報管理の GAS のフォルダ）に保存して、素材として登録する

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Field, Input, Select } from '@/components/kouhou/kit/primitives'
import { toast, toastResult } from '@/components/kouhou/kit/toast'
import { runAction, useAppState } from '@/lib/kouhou/store/store'
import { registerUpload, type UploadInput } from '@/lib/kouhou/domain/commands'
import { uploadImage } from '@/lib/kouhou/live'

const MAX = 5 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export function UploadButton({ defaultKind }: { defaultKind: UploadInput['kind'] }) {
  const s = useAppState()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<UploadInput['kind']>(defaultKind)
  const [brandId, setBrandId] = useState(s.brands[0]?.id ?? '')
  const [purpose, setPurpose] = useState('')
  const [busy, setBusy] = useState(false)
  const error = file && !TYPES.includes(file.type) ? 'PNG・JPEG・GIF・WebP の画像を選んでください' : file && file.size > MAX ? '5MB以下の画像にしてください（Xの上限）' : null

  const close = () => {
    setOpen(false)
    setFile(null)
    setName('')
    setPurpose('')
  }
  const submit = async () => {
    if (!file || error) return
    setBusy(true)
    try {
      const fileId = await uploadImage(file, file.name)
      const r = await toastResult(runAction(registerUpload, { name: name || file.name.replace(/\.[^.]+$/, ''), kind, brandId, purpose, fileId }))
      if (r.ok) close()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'アップロードできませんでした', false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button className="gap-1 self-start" onClick={() => { setKind(defaultKind); setOpen(true) }}>
        <Upload className="size-4" aria-hidden />
        画像をアップロード
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="画像をアップロード"
        description="画像は広報管理の Google Drive フォルダに保存され、投稿に添付すると X・Discord にそのまま送信されます。"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={busy}>
              キャンセル
            </Button>
            <Button onClick={submit} disabled={!file || !!error || busy}>
              {busy ? 'アップロード中…' : 'アップロード'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="画像ファイル" htmlFor="up-file" error={error} hint="PNG・JPEG・GIF・WebP、5MBまで">
            <input
              id="up-file"
              type="file"
              accept={TYPES.join(',')}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null
                setFile(f)
                if (f && !name) setName(f.name.replace(/\.[^.]+$/, ''))
              }}
              className="text-sm"
            />
          </Field>
          <Field label="素材名" htmlFor="up-name">
            <Input id="up-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="種類" htmlFor="up-kind">
              <Select id="up-kind" value={kind} onChange={(e) => setKind(e.target.value as UploadInput['kind'])}>
                <option value="image">画像</option>
                <option value="logo">ロゴ</option>
                <option value="background">背景テンプレート</option>
              </Select>
            </Field>
            <Field label="ブランド" htmlFor="up-brand">
              <Select id="up-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                {s.brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="用途" htmlFor="up-purpose" hint="例：イベント告知・活動報告">
            <Input id="up-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </>
  )
}
