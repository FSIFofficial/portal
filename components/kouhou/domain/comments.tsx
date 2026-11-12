'use client'

import { useMemo, useRef, useState } from 'react'
import { CheckCircle2, CornerDownRight, MessageSquare, RotateCcw } from 'lucide-react'
import type { Comment, CommentTarget } from '@/lib/kouhou/domain/types'
import { addComment, toggleResolved } from '@/lib/kouhou/domain/actions'
import { runAction, useAppState } from '@/lib/kouhou/store/store'
import { getUser } from '@/lib/kouhou/domain/rules'
import { formatDateTime } from '@/lib/kouhou/domain/time'
import { Button } from '@/components/kouhou/ui/button'
import { Pill, Segmented, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { toastResult } from '@/components/kouhou/kit/toast'
import { cn } from '@/lib/utils'

type Category = 'content' | 'schedule' | null
const CATEGORY_LABEL: Record<'content' | 'schedule', string> = { content: '内容', schedule: '投稿日時' }

function MentionTextarea({ value, onChange, placeholder, label, id }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; id?: string }) {
  const s = useAppState()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [query, setQuery] = useState<string | null>(null)
  const candidates = useMemo(
    () => (query === null ? [] : s.users.filter((u) => u.status === 'active' && u.name.includes(query)).slice(0, 5)),
    [query, s.users],
  )

  const detect = (text: string, caret: number) => {
    const m = /@([^\s@]*)$/.exec(text.slice(0, caret))
    setQuery(m ? m[1] : null)
  }

  const insert = (name: string) => {
    const el = ref.current
    const caret = el?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([^\s@]*)$/, `@${name} `)
    const next = before + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(before.length, before.length)
    })
  }

  return (
    <div className="relative">
      <Textarea
        id={id}
        ref={ref}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        className="min-h-20"
        onChange={(e) => {
          onChange(e.target.value)
          detect(e.target.value, e.target.selectionStart)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && query !== null) {
            e.stopPropagation()
            setQuery(null)
          }
        }}
      />
      {candidates.length > 0 && (
        <div role="listbox" aria-label="メンション候補" className="absolute top-full left-0 z-10 mt-1 flex w-56 flex-col rounded-md border bg-card py-1 shadow-lg">
          {candidates.map((u) => (
            <button key={u.id} type="button" role="option" aria-selected={false} onClick={() => insert(u.name)} className="px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
              @{u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function renderBody(body: string) {
  return body.split(/(@\S+)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium text-primary">
        {part}
      </span>
    ) : (
      part
    ),
  )
}

function CommentView({ c, replies, onReply, withCategory }: { c: Comment; replies: Comment[]; onReply: (id: string) => void; withCategory: boolean }) {
  const s = useAppState()
  return (
    <li className={cn('flex flex-col gap-2 rounded-md border p-3', c.resolved ? 'bg-muted/60' : 'bg-card')}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-bold text-foreground">{getUser(s, c.authorId)?.name}</span>
        <span className="tabular text-muted-foreground">{formatDateTime(c.createdAt)}</span>
        {withCategory && c.category && <Pill tone="neutral">{CATEGORY_LABEL[c.category]}</Pill>}
        {c.resolved && (
          <Pill tone="success" icon={<CheckCircle2 className="size-3" aria-hidden />}>
            解決済み
          </Pill>
        )}
      </div>
      <p className={cn('text-sm leading-relaxed break-words whitespace-pre-wrap', c.resolved && 'text-muted-foreground')}>{renderBody(c.body)}</p>
      {replies.length > 0 && (
        <ul className="flex flex-col gap-2 border-l-2 pl-3">
          {replies.map((r) => (
            <li key={r.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-xs">
                <CornerDownRight className="size-3 text-muted-foreground" aria-hidden />
                <span className="font-bold">{getUser(s, r.authorId)?.name}</span>
                <span className="tabular text-muted-foreground">{formatDateTime(r.createdAt)}</span>
              </div>
              <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{renderBody(r.body)}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => onReply(c.id)}>
          <CornerDownRight aria-hidden />
          返信
        </Button>
        <Button variant="ghost" size="sm" onClick={() => toastResult(runAction(toggleResolved, c.id))}>
          {c.resolved ? <RotateCcw aria-hidden /> : <CheckCircle2 aria-hidden />}
          {c.resolved ? '未解決に戻す' : '解決済みにする'}
        </Button>
      </div>
    </li>
  )
}

export function CommentsPanel({ target, withCategory = false, canComment = true }: { target: { type: CommentTarget; id: string }; withCategory?: boolean; canComment?: boolean }) {
  const s = useAppState()
  const [filter, setFilter] = useState<'open' | 'all' | 'resolved'>('open')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState<Category>(withCategory ? 'content' : null)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

  const all = s.comments.filter((c) => c.targetType === target.type && c.targetId === target.id)
  const roots = all.filter((c) => !c.parentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const shown = roots.filter((c) => (filter === 'all' ? true : filter === 'open' ? !c.resolved : c.resolved))
  const repliesOf = (id: string) => all.filter((c) => c.parentId === id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const submit = async () => {
    const r = await toastResult(runAction(addComment, target, body, null, withCategory ? category : null))
    if (r.ok) setBody('')
  }
  const submitReply = async () => {
    if (!replyTo) return
    const r = await toastResult(runAction(addComment, target, replyBody, replyTo, null))
    if (r.ok) {
      setReplyBody('')
      setReplyTo(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-muted-foreground">コメントでは承認は成立せず、最終編集者・内容の版も変わりません。「@」で利用者をメンションできます。</p>
      {canComment ? (
        <div className="flex flex-col gap-2">
          <MentionTextarea id={`comment-${target.id}`} label="コメントを入力" value={body} onChange={setBody} placeholder="コメントを入力（@でメンション）" />
          <div className="flex flex-wrap items-center justify-end gap-2">
            {withCategory && (
              <Select aria-label="コメントの区分" value={category ?? ''} onChange={(e) => setCategory((e.target.value || null) as Category)} className="w-auto">
                <option value="content">区分：内容</option>
                <option value="schedule">区分：投稿日時</option>
                <option value="">区分なし</option>
              </Select>
            )}
            <Button onClick={submit} disabled={!body.trim()}>
              <MessageSquare aria-hidden />
              コメントする
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">このアカウントの閲覧権限がないためコメントできません</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <Segmented
          label="コメントの表示"
          size="sm"
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'open', label: `未解決 ${roots.filter((c) => !c.resolved).length}` },
            { value: 'resolved', label: `解決済み ${roots.filter((c) => c.resolved).length}` },
            { value: 'all', label: 'すべて' },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">表示するコメントはありません</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((c) => (
            <div key={c.id} className="flex flex-col gap-2">
              <CommentView c={c} replies={repliesOf(c.id)} onReply={setReplyTo} withCategory={withCategory} />
              {replyTo === c.id && (
                <div className="ml-4 flex flex-col gap-2 border-l-2 border-primary/40 pl-3">
                  <MentionTextarea label="返信を入力" value={replyBody} onChange={setReplyBody} placeholder={`${getUser(s, c.authorId)?.name}さんへ返信`} />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setReplyTo(null)}>
                      キャンセル
                    </Button>
                    <Button onClick={submitReply} disabled={!replyBody.trim()}>
                      返信する
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </ul>
      )}
    </div>
  )
}
