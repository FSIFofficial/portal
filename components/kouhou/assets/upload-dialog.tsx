'use client'

// 素材・テンプレート画面の「画像をアップロード」。ブランド・グループ・種類を決めて、画像をまとめて入れる。

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Field, Input, Select } from '@/components/kouhou/kit/primitives'
import { toast } from '@/components/kouhou/kit/toast'
import { useAppState } from '@/lib/kouhou/store/store'
import type { UploadInput } from '@/lib/kouhou/domain/commands'
import { canEditAssetsOf } from '@/lib/kouhou/domain/assets'
import { UploadZone, useImageUploader } from './upload-zone'

/** 既存のグループ（用途）の一覧。入力欄の候補に出す */
export function GroupOptions({ id, brandId }: { id: string; brandId?: string }) {
  const s = useAppState()
  const groups = [...new Set(s.assets.filter((a) => !brandId || a.brandId === brandId).map((a) => a.purpose))].sort((a, b) => a.localeCompare(b, 'ja'))
  return (
    <datalist id={id}>
      {groups.map((g) => (
        <option key={g} value={g} />
      ))}
    </datalist>
  )
}

export function UploadButton({ defaultKind, defaultBrandId, defaultGroup }: { defaultKind: UploadInput['kind']; defaultBrandId?: string; defaultGroup?: string }) {
  const s = useAppState()
  const brands = s.brands.filter((b) => canEditAssetsOf(s, s.currentUserId, b.id))
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<UploadInput['kind']>(defaultKind)
  const [brandId, setBrandId] = useState('')
  const [group, setGroup] = useState('')
  const [done, setDone] = useState(0)
  const uploader = useImageUploader(
    () => (brandId ? { kind, brandId, purpose: group } : 'ブランドを選んでください'),
    () => setDone((n) => n + 1),
  )
  const close = () => {
    if (uploader.busy && !window.confirm('アップロード中の画像があります。閉じても続きはアップロードされます。閉じますか？')) return
    if (done) toast(`${done}件の画像を追加しました`, true)
    setOpen(false)
    uploader.clear()
    setDone(0)
  }

  return (
    <>
      <Button
        className="gap-1 self-start"
        disabled={!brands.length}
        onClick={() => {
          setKind(defaultKind)
          setBrandId(defaultBrandId && brands.some((b) => b.id === defaultBrandId) ? defaultBrandId : brands[0]?.id ?? '')
          setGroup(defaultGroup ?? '')
          setOpen(true)
        }}
      >
        <Upload className="size-4" aria-hidden />
        画像をアップロード
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="画像をアップロード"
        description={s.live ? '画像は広報管理の Google Drive フォルダに保存され、投稿に添付すると X・Discord にそのまま送信されます。' : 'デモでは、縮小した画像をこのブラウザの中にだけ保存します。'}
        footer={
          <Button variant="outline" onClick={close}>
            {uploader.busy ? 'アップロード中…' : '閉じる'}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="ブランド" htmlFor="up-brand">
              <Select id="up-brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="種類" htmlFor="up-kind">
              <Select id="up-kind" value={kind} onChange={(e) => setKind(e.target.value as UploadInput['kind'])}>
                <option value="image">画像</option>
                <option value="logo">ロゴ</option>
                <option value="background">背景テンプレート</option>
              </Select>
            </Field>
          </div>
          <Field label="グループ" htmlFor="up-group" hint="例：イベント告知・活動報告・11月観測会。空ならその他。あとから変えられます">
            <Input id="up-group" list="up-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="その他" />
            <GroupOptions id="up-groups" brandId={brandId} />
          </Field>
          <UploadZone uploader={uploader} />
          <p className="text-xs text-muted-foreground">素材名はファイル名になります（素材を開くと変えられます）。</p>
        </div>
      </Dialog>
    </>
  )
}
