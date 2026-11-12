'use client'

import { useState } from 'react'
import { Button } from '@/components/kouhou/ui/button'
import { Dialog, Field, Input, Notice, Select, Switch } from '@/components/kouhou/kit/primitives'
import { toast, toastResult } from '@/components/kouhou/kit/toast'
import { mutate, resetDemo, runAction, useAppState, useStoreMeta } from '@/lib/kouhou/store/store'
import { failEarliestQueued, setNow } from '@/lib/kouhou/domain/actions'
import { addHours, formatDateTime } from '@/lib/kouhou/domain/time'

export function DemoMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useAppState()
  const meta = useStoreMeta()
  const [target, setTarget] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const nextQueued = s.posts
    .filter((p) => p.queued && p.scheduledAt)
    .map((p) => p.scheduledAt!)
    .sort()[0]

  const advance = (to: string) => toastResult(runAction(setNow, to))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="デモ操作"
      description="デモ環境専用の操作です。実際の認証・送信・取得は一切行いません。"
      size="md"
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">ユーザー切替</h3>
          <Select
            aria-label="操作するユーザー"
            value={s.currentUserId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              mutate((d) => {
                d.currentUserId = id
              })
              toast(`${s.users.find((u) => u.id === id)?.name} に切り替えました`)
            }}
          >
            {s.users
              .filter((u) => u.status === 'active')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}（{u.isAdmin ? '管理者・' : ''}レベル{u.level}）
                </option>
              ))}
          </Select>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">基準日時を進める</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            現在：<span className="tabular font-bold text-foreground">{formatDateTime(s.now)}</span>。進めると、予約済みの投稿は公開（デモ）され、承認が間に合わない投稿は保留になります。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => advance(addHours(s.now, 1))}>
              +1時間
            </Button>
            <Button variant="outline" onClick={() => advance(addHours(s.now, 24))}>
              +1日
            </Button>
            <Button variant="outline" disabled={!nextQueued} onClick={() => nextQueued && advance(nextQueued)}>
              次の予約時刻まで
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <Field label="日時を指定" htmlFor="demo-now" className="flex-1">
              <Input id="demo-now" type="datetime-local" value={target} onChange={(e) => setTarget(e.target.value)} />
            </Field>
            <Button onClick={() => target && advance(target)} disabled={!target}>
              移動
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-bold">競合・失敗の再現</h3>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="leading-relaxed">次の保存で、他のユーザーが先に保存した状態を再現する</span>
            <Switch
              label="次の保存で競合を再現"
              checked={s.demo.conflictOnNextSave}
              onChange={(v) =>
                mutate((d) => {
                  d.demo.conflictOnNextSave = v
                })
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="leading-relaxed">次の公開予定時刻の配信を失敗させる</span>
            <Switch
              label="次の配信を失敗させる"
              checked={s.demo.failNextDelivery}
              onChange={(v) =>
                mutate((d) => {
                  d.demo.failNextDelivery = v
                })
              }
            />
          </label>
          <Button variant="outline" onClick={() => toastResult(runAction(failEarliestQueued))}>
            最も近い予約を今すぐ「投稿失敗」にする
          </Button>
        </section>

        <section className="flex flex-col gap-3 border-t pt-4">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="leading-relaxed">操作内容をこのブラウザ内のみ保存する（localStorage）</span>
            <Switch label="このブラウザに保存" checked={meta.persist} onChange={meta.setPersist} />
          </label>
          {confirmReset ? (
            <Notice tone="danger" title="初期状態に戻しますか？">
              <p>作成・承認・コメントなど、デモで行った操作はすべて失われます。</p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => {
                    resetDemo()
                    setConfirmReset(false)
                    toast('デモを初期状態に戻しました')
                  }}
                >
                  リセットする
                </Button>
                <Button variant="outline" onClick={() => setConfirmReset(false)}>
                  やめる
                </Button>
              </div>
            </Notice>
          ) : (
            <Button variant="outline" onClick={() => setConfirmReset(true)}>
              デモを初期状態に戻す
            </Button>
          )}
        </section>
      </div>
    </Dialog>
  )
}
