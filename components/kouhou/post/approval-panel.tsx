'use client'

import { useState } from 'react'
import { Ban, Bell, CalendarClock, CalendarPlus, Check, CheckCircle2, CircleX, Plus, Send, ShieldAlert, Trash2, X } from 'lucide-react'
import type { Post } from '@/lib/kouhou/domain/types'
import {
  approveCancel,
  approveContent,
  approveSchedule,
  completeContent,
  confirmSchedule,
  proposeCandidates,
  rejectCancel,
  rejectContent,
  rejectSchedule,
  requestCancel,
  selectCandidate,
  type Result,
} from '@/lib/kouhou/domain/actions'
import {
  approversFor,
  canApproveContent,
  canApprovePendingChange,
  canApproveSchedule,
  canDecideSchedule,
  canEditDraft,
  canRequestAfterSchedule,
  canSchedule,
  canSelectCandidate,
  contentRequirement,
  contentRequirementLabel,
  scheduleChecks,
} from '@/lib/kouhou/domain/rules'
import { isBefore, formatDateTime } from '@/lib/kouhou/domain/time'
import { runAction, useAppState, useCurrentUser } from '@/lib/kouhou/store/store'
import { Button } from '@/components/kouhou/ui/button'
import { DisabledReason, Notice, Panel, Pill } from '@/components/kouhou/kit/primitives'
import { DateTimeInput, ReasonDialog } from '@/components/kouhou/kit/form-bits'
import { toastResult } from '@/components/kouhou/kit/toast'
import { ContentBadge, ScheduleBadge, UserName } from '@/components/kouhou/domain/tags'
import { BeforeAfter } from './history-list'
import { cn } from '@/lib/utils'

type DialogKind = null | 'rejectContent' | 'rejectSchedule' | 'requestCancel' | 'rejectCancel'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

function ActionButton({ verdict, children, ...props }: React.ComponentProps<typeof Button> & { verdict: { ok: boolean; reason?: string } }) {
  return (
    <Button {...props} disabled={!verdict.ok || props.disabled} title={verdict.ok ? undefined : verdict.reason}>
      {children}
    </Button>
  )
}

function ContentCard({ post, open }: { post: Post; open: (k: DialogKind) => void }) {
  const s = useAppState()
  const user = useCurrentUser()
  const req = contentRequirement(s, post)
  const edit = canEditDraft(s, user, post)
  const approve = canApproveContent(s, user, post)
  const canComplete = edit.ok && (post.content.state === 'draft' || post.content.state === 'rejected')
  const approvers = approversFor(s, post)
  const c = post.content

  return (
    <Panel title="内容承認" actions={<ContentBadge post={post} compact />}>
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2">
          <Row label="判定">{post.mode === 'manual' ? '手動記録のため承認対象外' : contentRequirementLabel(req)}</Row>
          {post.designatedApproverId && (
            <Row label="指定承認者">
              <UserName s={s} id={post.designatedApproverId} />
            </Row>
          )}
          <Row label="承認できる人">{approvers.length ? approvers.map((u) => u.name).join('、') : '—'}</Row>
          {c.decidedBy && (
            <Row label={c.state === 'rejected' ? '差し戻し' : '承認'}>
              <UserName s={s} id={c.decidedBy} /> ・ <span className="tabular">{formatDateTime(c.decidedAt)}</span> ・ <span className="font-mono">v{c.decidedVersion}</span>
            </Row>
          )}
          {c.requestedAt && c.state === 'pending' && <Row label="依頼日時"><span className="tabular">{formatDateTime(c.requestedAt)}</span></Row>}
        </dl>
        {c.reason && (
          <Notice tone={c.state === 'rejected' ? 'danger' : 'warning'} title={c.state === 'rejected' ? '差し戻し理由' : 'お知らせ'}>
            {c.reason}
          </Notice>
        )}
        {post.mode !== 'manual' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {canComplete && (
                <Button onClick={() => toastResult(runAction(completeContent, post.id))}>
                  <Send aria-hidden />
                  内容を完了
                </Button>
              )}
              {c.state === 'pending' && (
                <>
                  <ActionButton verdict={approve} onClick={() => toastResult(runAction(approveContent, post.id))}>
                    <Check aria-hidden />
                    内容を承認
                  </ActionButton>
                  <ActionButton verdict={approve} variant="destructive" onClick={() => open('rejectContent')}>
                    <CircleX aria-hidden />
                    差し戻し
                  </ActionButton>
                </>
              )}
            </div>
            {c.state === 'pending' && <DisabledReason reason={approve.ok ? undefined : approve.reason} />}
            {(c.state === 'draft' || c.state === 'rejected') && !edit.ok && <DisabledReason reason={`内容を完了できません：${edit.reason}`} />}
            {canComplete && <DisabledReason reason={req === 'auto' ? '完了すると自動承認されます。' : '完了すると承認者へ依頼が届きます。'} />}
          </div>
        )}
      </div>
    </Panel>
  )
}

function CandidateForm({ post }: { post: Post }) {
  const s = useAppState()
  const [times, setTimes] = useState<(string | null)[]>([null])
  const submit = async () => {
    const r = await toastResult(runAction(proposeCandidates, post.id, times.filter((t): t is string => !!t)))
    if (r.ok) setTimes([null])
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <p className="text-xs font-bold">候補日時を提示（承認者）</p>
      {times.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <DateTimeInput label={`候補 ${i + 1}`} value={t} onChange={(v) => setTimes((arr) => arr.map((x, j) => (j === i ? v : x)))} />
          {t && !isBefore(s.now, t) && <span className="shrink-0 text-xs text-danger">過去</span>}
          {times.length > 1 && (
            <Button variant="ghost" size="icon" aria-label={`候補 ${i + 1} を削除`} onClick={() => setTimes((arr) => arr.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setTimes((a) => [...a, null])}>
          <Plus aria-hidden />
          候補を追加
        </Button>
        <Button size="sm" onClick={submit} disabled={!times.some(Boolean)}>
          <CalendarPlus aria-hidden />
          候補を提示
        </Button>
      </div>
    </div>
  )
}

function ScheduleCard({ post, open }: { post: Post; open: (k: DialogKind) => void }) {
  const s = useAppState()
  const user = useCurrentUser()
  const sc = post.schedule
  const decide = canDecideSchedule(s, user, post)
  const approve = canApproveSchedule(s, user, post)
  const notifications = s.notifications.filter((n) => n.postId === post.id && n.text.startsWith('【日時確定】'))

  if (post.mode === 'manual') {
    return (
      <Panel title="日時承認" actions={<ScheduleBadge post={post} compact />}>
        <p className="text-sm">実公開日時：<span className="tabular">{formatDateTime(post.publishedAt)}</span>（手動記録）</p>
      </Panel>
    )
  }

  return (
    <Panel title="日時承認" actions={<ScheduleBadge post={post} compact />}>
      <div className="flex flex-col gap-4">
        <dl className="flex flex-col gap-2">
          <Row label="現在の予定">
            <span className={cn('tabular font-bold', post.scheduledAt && !isBefore(s.now, post.scheduledAt) && post.status !== 'published' && 'text-danger')}>{formatDateTime(post.scheduledAt)}</span>
            {post.scheduledAt && !isBefore(s.now, post.scheduledAt) && post.status !== 'published' && <span className="ml-2 text-xs text-danger">過去の日時です</span>}
          </Row>
          {sc.approvedFor && (
            <Row label="承認済み日時">
              <span className="tabular">{formatDateTime(sc.approvedFor)}</span>
              {sc.approvedFor !== post.scheduledAt && <span className="ml-2 text-xs text-warning">現在の予定と異なるため再承認が必要</span>}
            </Row>
          )}
          {sc.decidedBy && (
            <Row label="成立">
              {sc.via === 'candidate' ? '候補から選択' : '承認者が承認'} ・ <UserName s={s} id={sc.decidedBy} /> ・ <span className="tabular">{formatDateTime(sc.decidedAt)}</span>
            </Row>
          )}
        </dl>
        {sc.reason && sc.state === 'rejected' && (
          <Notice tone="danger" title="日時の差し戻し理由">
            {sc.reason}
          </Notice>
        )}

        {sc.candidates.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold">提示された候補日時</p>
            <ul className="flex flex-col gap-1.5">
              {sc.candidates.map((c) => {
                const v = canSelectCandidate(s, user, post, c.at)
                const chosen = post.scheduledAt === c.at && sc.state === 'approved'
                const past = !isBefore(s.now, c.at)
                return (
                  <li key={c.at} className={cn('flex flex-wrap items-center gap-2 rounded-md border px-3 py-2', chosen && 'border-success/40 bg-success-soft')}>
                    <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                    <span className={cn('tabular text-sm font-medium', past && 'text-muted-foreground line-through')}>{formatDateTime(c.at)}</span>
                    <span className="text-xs text-muted-foreground">
                      提示：<UserName s={s} id={c.proposedBy} />
                    </span>
                    {past && <Pill tone="muted">過去のため選択不可</Pill>}
                    <span className="ml-auto">
                      {chosen ? (
                        <Pill tone="success" icon={<CheckCircle2 className="size-3" aria-hidden />}>
                          選択済み
                        </Pill>
                      ) : (
                        !past && (
                          <Button size="sm" variant="outline" disabled={!v.ok || post.queued} title={v.reason} onClick={() => toastResult(runAction(selectCandidate, post.id, c.at))}>
                            この日時を選ぶ
                          </Button>
                        )
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground">候補から選ぶと、その時点で日時承認が成立します。候補外の日時にしたい場合は「原稿」で予定日時を変更すると日時承認の依頼になります。</p>
          </div>
        )}

        {sc.state === 'pending' && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <ActionButton verdict={approve} onClick={() => toastResult(runAction(approveSchedule, post.id))}>
                <Check aria-hidden />
                この日時を承認
              </ActionButton>
              <ActionButton verdict={decide} variant="destructive" onClick={() => open('rejectSchedule')}>
                <CircleX aria-hidden />
                日時を差し戻し
              </ActionButton>
            </div>
            <DisabledReason reason={approve.ok ? undefined : approve.reason} />
          </div>
        )}

        {decide.ok && !post.queued && post.status !== 'published' && post.status !== 'cancelled' && <CandidateForm post={post} />}

        {notifications.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-md border bg-muted/50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <Bell className="size-3.5" aria-hidden />
              {s.live ? '通知' : '確定通知プレビュー（デモ・未送信）'}
            </p>
            {notifications.slice(-2).map((n) => (
              <p key={n.id} className="text-xs leading-relaxed">
                <span className="tabular text-muted-foreground">{formatDateTime(n.at)}</span> {n.text}
              </p>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}

function BookingCard({ post, open }: { post: Post; open: (k: DialogKind) => void }) {
  const s = useAppState()
  const user = useCurrentUser()
  if (post.mode === 'manual') return null
  const checks = scheduleChecks(s, post)
  const can = canSchedule(s, user, post)
  const after = canRequestAfterSchedule(s, user, post)
  const terminal = post.status === 'published' || post.status === 'cancelled'

  return (
    <Panel title="予約">
      <div className="flex flex-col gap-4">
        {post.status === 'published' ? (
          <p className="text-sm">
            <span className="tabular">{formatDateTime(post.publishedAt)}</span> に公開済み{s.live ? '' : '（デモ）'}
          </p>
        ) : post.status === 'cancelled' ? (
          <p className="text-sm text-muted-foreground">この投稿は取り消されました</p>
        ) : (
          <>
            <ul className="flex flex-col gap-1.5" aria-label="予約の条件">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
                  <span className="sr-only">{c.ok ? '満たしている' : '未達'}</span>
                  <span className="font-medium">{c.label}</span>
                  <span className="text-muted-foreground">{c.detail}</span>
                </li>
              ))}
            </ul>
            {post.hold && (
              <Notice tone="warning" title="公開保留中">
                {post.hold.reason}
              </Notice>
            )}
            {post.status === 'failed' && post.deliveryError && (
              <Notice tone="danger" title="投稿失敗">
                {post.deliveryError}。原因を確認し、条件を満たしたら再度予約を確定できます。
              </Notice>
            )}
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {!post.queued && (
                  <ActionButton verdict={can} onClick={() => toastResult(runAction(confirmSchedule, post.id))}>
                    <CalendarClock aria-hidden />
                    予約を確定
                  </ActionButton>
                )}
                {(post.queued || post.status === 'held') && !post.pendingChange && (
                  <ActionButton verdict={after} variant="destructive" onClick={() => open('requestCancel')}>
                    <Ban aria-hidden />
                    取り消しを申請
                  </ActionButton>
                )}
              </div>
              {!post.queued && <DisabledReason reason={can.ok ? (s.live ? '確定すると、予定日時に自動で送信されます（5分ごとに確認するため、最大5分ほど遅れます）' : '確定しても実際のSNSには送信されません（デモ）') : can.reason} />}
              {post.queued && (
                <p className="text-xs leading-relaxed text-muted-foreground">予約後に原稿・日時を保存すると「変更申請」として扱われ、再承認まで公開が保留されます。保留中に予定日時を過ぎた場合は自動公開せず、新しい日時の設定が必要です。</p>
              )}
            </div>
          </>
        )}
        {terminal && post.publicUrl && (
          <a href={post.publicUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-2">
            公開URLを開く
          </a>
        )}
      </div>
    </Panel>
  )
}

function PendingChangeCard({ post, open }: { post: Post; open: (k: DialogKind) => void }) {
  const s = useAppState()
  const user = useCurrentUser()
  const pc = post.pendingChange
  if (!pc) return null
  const v = canApprovePendingChange(s, user, post)
  const diff = s.history
    .filter((h) => h.postId === post.id && h.kind === 'body_changed' && h.version > pc.fromVersion)
    .sort((a, b) => a.version - b.version)
  const first = diff[0]
  const last = diff[diff.length - 1]

  return (
    <Panel
      title={
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="size-4 text-warning" aria-hidden />
          {pc.kind === 'cancel' ? '取り消し申請' : '予約後の変更申請'}
        </span>
      }
      className="border-warning/40"
    >
      <div className="flex flex-col gap-3">
        <dl className="flex flex-col gap-2">
          <Row label="申請者">
            <UserName s={s} id={pc.requestedBy} /> ・ <span className="tabular">{formatDateTime(pc.requestedAt)}</span>
          </Row>
          <Row label="理由">{pc.reason}</Row>
          <Row label="版">
            <span className="font-mono">
              v{pc.fromVersion} → v{post.version}
            </span>
          </Row>
        </dl>
        {pc.kind === 'edit' && first && <BeforeAfter before={first.before} after={last.after} />}
        {pc.kind === 'edit' ? (
          <p className="text-xs leading-relaxed text-muted-foreground">変更内容は上の「内容承認」「日時承認」で承認します。両方が揃うと保留が解除され、予約を確定し直せます。</p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <ActionButton verdict={v} variant="destructive" onClick={() => toastResult(runAction(approveCancel, post.id))}>
                <Ban aria-hidden />
                取り消しを承認
              </ActionButton>
              <ActionButton verdict={v} variant="outline" onClick={() => open('rejectCancel')}>
                申請を却下
              </ActionButton>
            </div>
            <DisabledReason reason={v.ok ? undefined : v.reason} />
          </div>
        )}
      </div>
    </Panel>
  )
}

export function ApprovalPanel({ post }: { post: Post }) {
  const [dialog, setDialog] = useState<DialogKind>(null)
  const done = (r: Promise<Result>) => toastResult(r).then((x) => x.ok)

  return (
    <div className="flex flex-col gap-4">
      <PendingChangeCard post={post} open={setDialog} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ContentCard post={post} open={setDialog} />
        <ScheduleCard post={post} open={setDialog} />
      </div>
      <BookingCard post={post} open={setDialog} />

      <ReasonDialog
        open={dialog === 'rejectContent'}
        onClose={() => setDialog(null)}
        title="内容を差し戻す"
        description="差し戻すと作成者に通知され、修正後に再度「内容を完了」で依頼できます。"
        confirmLabel="差し戻す"
        onConfirm={(r) => done(runAction(rejectContent, post.id, r))}
      />
      <ReasonDialog
        open={dialog === 'rejectSchedule'}
        onClose={() => setDialog(null)}
        title="日時を差し戻す"
        description="必要に応じて候補日時を提示してください。"
        confirmLabel="差し戻す"
        onConfirm={(r) => done(runAction(rejectSchedule, post.id, r))}
      />
      <ReasonDialog
        open={dialog === 'requestCancel'}
        onClose={() => setDialog(null)}
        title="予約の取り消しを申請"
        description="申請した時点で公開は保留されます。承認者が承認すると取り消しが確定します。"
        confirmLabel="取り消しを申請"
        onConfirm={(r) => done(runAction(requestCancel, post.id, r))}
      />
      <ReasonDialog
        open={dialog === 'rejectCancel'}
        onClose={() => setDialog(null)}
        title="取り消し申請を却下"
        description="却下後、担当者が「予約を確定」すると予約に戻ります。"
        confirmLabel="却下する"
        destructive={false}
        onConfirm={(r) => done(runAction(rejectCancel, post.id, r))}
      />
    </div>
  )
}
