'use client'

import { useState } from 'react'
import { Lock, RefreshCw, Save, Undo2 } from 'lucide-react'
import type { Post } from '@/lib/kouhou/domain/types'
import { savePost, toggleEditOpen, type DraftFields, type EditPatch, type UnitFields } from '@/lib/kouhou/domain/actions'
import { canEditDraft, canToggleEditOpen, getAccount } from '@/lib/kouhou/domain/rules'
import { runAction, useAppState, useCurrentUser } from '@/lib/kouhou/store/store'
import { Button } from '@/components/kouhou/ui/button'
import { Notice, Panel, Switch } from '@/components/kouhou/kit/primitives'
import { toastResult } from '@/components/kouhou/kit/toast'
import { UserName } from '@/components/kouhou/domain/tags'
import { DraftFieldsForm } from './draft-fields'
import { UnitEditor } from './unit-editor'

function fieldsOf(p: Post): DraftFields {
  return {
    title: p.title,
    typeId: p.typeId,
    importantManual: p.importantManual,
    planId: p.planId,
    assigneeId: p.assigneeId,
    designatedApproverId: p.designatedApproverId,
    draftDue: p.draftDue,
    approvalDue: p.approvalDue,
    scheduledAt: p.scheduledAt,
  }
}

function unitOf(p: Post): UnitFields {
  return { accountId: p.accountId, channelId: p.channelId, body: p.body, assetIds: [...p.assetIds] }
}

function diffPatch(p: Post, f: DraftFields, u: UnitFields): EditPatch {
  const patch: EditPatch = {}
  const base = fieldsOf(p)
  for (const k of Object.keys(f) as (keyof DraftFields)[]) {
    if (f[k] !== base[k]) (patch as Record<string, unknown>)[k] = f[k]
  }
  if (u.body !== p.body) patch.body = u.body
  if (JSON.stringify(u.assetIds) !== JSON.stringify(p.assetIds)) patch.assetIds = u.assetIds
  if (u.channelId !== p.channelId) patch.channelId = u.channelId
  return patch
}

function EditForm({ post }: { post: Post }) {
  const s = useAppState()
  const user = useCurrentUser()
  const account = getAccount(s, post.accountId)!
  const [baseVersion, setBaseVersion] = useState(post.version)
  const [fields, setFields] = useState(() => fieldsOf(post))
  const [unit, setUnit] = useState(() => unitOf(post))
  const [conflict, setConflict] = useState(false)

  const edit = canEditDraft(s, user, post)
  const toggle = canToggleEditOpen(user, post)
  const readOnly = !edit.ok
  const patch = diffPatch(post, fields, unit)
  const dirty = Object.keys(patch).length > 0
  const behind = post.version !== baseVersion

  const reload = () => {
    setFields(fieldsOf(post))
    setUnit(unitOf(post))
    setBaseVersion(post.version)
    setConflict(false)
  }

  const save = async () => {
    const r = await toastResult(runAction(savePost, post.id, patch, baseVersion))
    if (!r.ok && r.conflict) setConflict(true)
    if (r.ok) {
      setConflict(false)
      setBaseVersion((v) => v + 1)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm">
              最終編集者：<span className="font-bold">
                <UserName s={s} id={post.lastEditorId} />
              </span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">v{post.version}</span>
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">最終編集者だけが編集できます。他の人に編集してもらう場合は「他の人の編集を許可」をONにしてください。別の人が保存すると最終編集者が交代し、許可は自動でOFFになります。</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="edit-open" label="他の人の編集を許可" checked={post.editOpen} disabled={!toggle.ok} onChange={(v) => toastResult(runAction(toggleEditOpen, post.id, v))} />
            <label htmlFor="edit-open" className="text-sm">
              他の人の編集を許可
            </label>
          </div>
        </div>
      </Panel>

      {readOnly && (
        <Notice tone="muted" title="閲覧のみ">
          <span className="flex items-center gap-1.5">
            <Lock className="size-3.5" aria-hidden />
            {edit.reason}
          </span>
        </Notice>
      )}
      {post.queued && !readOnly && (
        <Notice tone="warning" title="予約済みの投稿です">
          保存すると「予約後の変更」として扱われ、再承認されるまで公開が保留されます。
        </Notice>
      )}
      {(conflict || (behind && dirty)) && (
        <Notice tone="danger" title="他のユーザーが更新しました">
          <span className="flex flex-col gap-2">
            <span>編集中の内容は保存されていません。最新版（v{post.version}）を読み込んでから編集し直してください。</span>
            <span>
              <Button size="sm" variant="outline" onClick={reload}>
                <RefreshCw aria-hidden />
                最新版を読み込む
              </Button>
            </span>
          </span>
        </Notice>
      )}

      <Panel title="管理情報">
        <DraftFieldsForm value={fields} onChange={(p) => setFields((f) => ({ ...f, ...p }))} brandIds={[post.brandId]} disabled={readOnly} />
      </Panel>
      <Panel title={`投稿内容：${account.name}`}>
        <UnitEditor idPrefix={`e-${post.id}`} account={account} unit={unit} onChange={(p) => setUnit((u) => ({ ...u, ...p }))} disabled={readOnly} />
      </Panel>

      {!readOnly && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-lg md:border">
          <span className="mr-auto text-xs text-muted-foreground">{dirty ? '未保存の変更があります' : '変更はありません'}</span>
          <Button variant="outline" onClick={reload} disabled={!dirty}>
            <Undo2 aria-hidden />
            元に戻す
          </Button>
          <Button onClick={save} disabled={!dirty}>
            <Save aria-hidden />
            保存
          </Button>
        </div>
      )}
    </div>
  )
}

export function DraftEditor({ post }: { post: Post }) {
  return <EditForm key={post.id} post={post} />
}
