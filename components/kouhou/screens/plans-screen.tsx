'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Link2, Plus, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/kouhou/ui/button'
import { useScope } from '@/lib/kouhou/store/hooks'
import { runAction } from '@/lib/kouhou/store/store'
import type { AppState, Plan, PlanStatus } from '@/lib/kouhou/domain/types'
import { PLAN_STATUS } from '@/lib/kouhou/domain/labels'
import { canEditPlan, movePlan, savePlan, type PlanInput } from '@/lib/kouhou/domain/actions'
import { formatDate, isBefore } from '@/lib/kouhou/domain/time'
import { Dialog, EmptyState, Field, Input, Notice, Panel, Pill, Segmented, Select, Textarea } from '@/components/kouhou/kit/primitives'
import { BrandTag, PostId, StatusBadge, UserName } from '@/components/kouhou/domain/tags'
import { CommentsPanel } from '@/components/kouhou/domain/comments'
import { toast, toastResult } from '@/components/kouhou/kit/toast'

const STATUSES: PlanStatus[] = ['idea', 'review', 'production', 'done']

export function PlansScreen() {
  const { s, user, brand } = useScope()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const plans = useMemo(() => s.plans.filter((p) => brand === 'all' || p.brandId === brand), [s.plans, brand])
  const editableBrands = s.brands.filter((b) => canEditPlan(s, user, b.id))
  const open = s.plans.find((p) => p.id === openId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">企画スペース</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented label="表示切り替え" value={view} onChange={setView} items={[{ value: 'board', label: 'ボード' }, { value: 'list', label: '一覧' }]} />
          <Button size="sm" onClick={() => setCreating(true)} disabled={!editableBrands.length}>
            <Plus className="size-4" aria-hidden />
            企画を追加
          </Button>
        </div>
      </div>
      {!editableBrands.length && <p className="text-xs text-muted-foreground">投稿作成権限のあるアカウントがないため、企画は閲覧のみです。</p>}

      {plans.length === 0 ? (
        <EmptyState title="企画がありません">「企画を追加」から最初の企画を登録できます。</EmptyState>
      ) : view === 'board' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((st) => {
            const items = plans.filter((p) => p.status === st)
            return (
              <section key={st} className="flex flex-col gap-2 rounded-lg border bg-muted/50 p-2" aria-label={PLAN_STATUS[st]}>
                <h2 className="flex items-center justify-between px-1 text-sm font-bold">
                  {PLAN_STATUS[st]}
                  <span className="tabular text-xs font-normal text-muted-foreground">{items.length}件</span>
                </h2>
                {items.map((p) => (
                  <PlanCard key={p.id} s={s} plan={p} onOpen={() => setOpenId(p.id)} canEdit={canEditPlan(s, user, p.brandId)} />
                ))}
                {!items.length && <p className="px-1 py-3 text-xs text-muted-foreground">なし</p>}
              </section>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">企画名</th>
                <th className="px-3 py-2 font-medium">ブランド</th>
                <th className="px-3 py-2 font-medium">状態</th>
                <th className="px-3 py-2 font-medium">担当者</th>
                <th className="px-3 py-2 font-medium">期限</th>
                <th className="px-3 py-2 text-right font-medium">関連投稿</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-accent/40">
                  <td className="px-3 py-2.5">
                    <button type="button" className="font-bold hover:underline" onClick={() => setOpenId(p.id)}>
                      {p.title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5"><BrandTag brand={s.brands.find((b) => b.id === p.brandId)} /></td>
                  <td className="px-3 py-2.5"><Pill>{PLAN_STATUS[p.status]}</Pill></td>
                  <td className="px-3 py-2.5"><UserName s={s} id={p.ownerId} /></td>
                  <td className="px-3 py-2.5 tabular"><Due s={s} date={p.dueDate} done={p.status === 'done'} /></td>
                  <td className="px-3 py-2.5 text-right tabular">{s.posts.filter((x) => x.planId === p.id).length}件</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <PlanEditor
          s={s}
          initial={{ title: '', brandId: editableBrands[0]?.id ?? '', description: '', status: 'idea', ownerId: user?.id ?? '', dueDate: null, links: [] }}
          brands={editableBrands}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false)
            setOpenId(id)
          }}
        />
      )}
      {open && <PlanDetail s={s} plan={open} canEdit={canEditPlan(s, user, open.brandId)} brands={editableBrands} onClose={() => setOpenId(null)} />}
    </div>
  )
}

function Due({ s, date, done }: { s: AppState; date: string | null; done: boolean }) {
  if (!date) return <span className="text-muted-foreground">—</span>
  const late = !done && isBefore(`${date}T23:59`, s.now)
  return <span className={late ? 'font-bold text-danger' : undefined}>{formatDate(date)}{late && '（超過）'}</span>
}

function PlanCard({ s, plan, onOpen, canEdit }: { s: AppState; plan: Plan; onOpen: () => void; canEdit: boolean }) {
  const related = s.posts.filter((p) => p.planId === plan.id).length
  return (
    <article className="flex flex-col gap-2 rounded-md border bg-card p-3">
      <button type="button" onClick={onOpen} className="text-left text-sm font-bold hover:underline">
        {plan.title}
      </button>
      {plan.description && <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <BrandTag brand={s.brands.find((b) => b.id === plan.brandId)} />
        <span className="text-muted-foreground">担当 <UserName s={s} id={plan.ownerId} /></span>
        <span className="tabular text-muted-foreground">期限 <Due s={s} date={plan.dueDate} done={plan.status === 'done'} /></span>
        <span className="tabular text-muted-foreground">投稿 {related}件</span>
      </div>
      {canEdit && (
        <label className="flex items-center gap-2 text-xs">
          <span className="sr-only">{plan.title}の状態</span>
          <Select
            value={plan.status}
            onChange={(e) => {
              void runAction(movePlan, plan.id, e.target.value as PlanStatus).then((r) => {
                if (!r.ok) void toastResult(r)
              })
            }}
            className="h-8 text-xs md:h-8"
          >
            {STATUSES.map((st) => (
              <option key={st} value={st}>{PLAN_STATUS[st]}へ移動</option>
            ))}
          </Select>
        </label>
      )}
    </article>
  )
}

function PlanDetail({ s, plan, canEdit, brands, onClose }: { s: AppState; plan: Plan; canEdit: boolean; brands: AppState['brands']; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  const related = s.posts.filter((p) => p.planId === plan.id)
  if (editing) return <PlanEditor s={s} initial={plan} brands={brands} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={plan.title}
      description={<span className="flex flex-wrap items-center gap-2"><BrandTag brand={s.brands.find((b) => b.id === plan.brandId)} /> {PLAN_STATUS[plan.status]}</span>}
      footer={
        <>
          {canEdit && <Button variant="outline" onClick={() => setEditing(true)}>編集</Button>}
          <Link href={`/kouhou/posts/new?plan=${encodeURIComponent(plan.id)}`} className={buttonVariants()}>
            <Plus className="size-4" aria-hidden />
            投稿を作成
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">担当者</dt><dd><UserName s={s} id={plan.ownerId} /></dd></div>
          <div><dt className="text-xs text-muted-foreground">期限</dt><dd className="tabular"><Due s={s} date={plan.dueDate} done={plan.status === 'done'} /></dd></div>
        </dl>
        <section className="flex flex-col gap-1">
          <h3 className="text-xs font-bold">説明</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{plan.description || '（説明なし）'}</p>
        </section>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold">関連資料URL</h3>
          {plan.links.length ? (
            <ul className="flex flex-col gap-1">
              {plan.links.map((l) => (
                <li key={l.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="shrink-0">{l.label || '資料'}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{l.url}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">登録なし</p>
          )}
          <p className="text-xs text-muted-foreground">URLは管理のみで、このツールから外部へはアクセスしません。</p>
        </section>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold">関連投稿（{related.length}件）</h3>
          {related.length ? (
            <ul className="flex flex-col divide-y rounded-md border">
              {related.map((p) => (
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
            <p className="text-sm text-muted-foreground">まだ投稿はありません。「投稿を作成」で企画を引き継いだ原稿を作れます。</p>
          )}
        </section>
        <section className="flex flex-col gap-1.5">
          <h3 className="text-xs font-bold">コメント</h3>
          <CommentsPanel target={{ type: 'plan', id: plan.id }} />
        </section>
      </div>
    </Dialog>
  )
}

function PlanEditor({ s, initial, brands, onClose, onSaved }: { s: AppState; initial: PlanInput; brands: AppState['brands']; onClose: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<PlanInput>(initial)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<PlanInput>) => setF((v) => ({ ...v, ...patch }))
  const save = async () => {
    const r = await runAction(savePlan, f)
    if (!r.ok) return setError(r.message)
    toast(r.message ?? '保存しました')
    onSaved(r.id!)
  }
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={initial.id ? '企画を編集' : '企画を追加'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>キャンセル</Button>
          <Button onClick={save}>保存</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error && <Notice tone="danger">{error}</Notice>}
        <Field label="企画名" htmlFor="pl-title" required>
          <Input id="pl-title" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="ブランド" htmlFor="pl-brand">
            <Select id="pl-brand" value={f.brandId} onChange={(e) => set({ brandId: e.target.value })}>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="状態" htmlFor="pl-status">
            <Select id="pl-status" value={f.status} onChange={(e) => set({ status: e.target.value as PlanStatus })}>
              {STATUSES.map((st) => <option key={st} value={st}>{PLAN_STATUS[st]}</option>)}
            </Select>
          </Field>
          <Field label="担当者" htmlFor="pl-owner">
            <Select id="pl-owner" value={f.ownerId} onChange={(e) => set({ ownerId: e.target.value })}>
              {s.users.filter((u) => u.status === 'active').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          </Field>
          <Field label="期限" htmlFor="pl-due">
            <Input id="pl-due" type="date" value={f.dueDate ?? ''} onChange={(e) => set({ dueDate: e.target.value || null })} />
          </Field>
        </div>
        <Field label="説明" htmlFor="pl-desc">
          <Textarea id="pl-desc" value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </Field>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-bold">関連資料URL</legend>
          {f.links.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2">
              <Input aria-label={`資料${i + 1}の名前`} placeholder="名前" value={l.label} className="w-32 shrink-0" onChange={(e) => set({ links: f.links.map((x) => (x.id === l.id ? { ...x, label: e.target.value } : x)) })} />
              <Input aria-label={`資料${i + 1}のURL`} placeholder="https://" value={l.url} onChange={(e) => set({ links: f.links.map((x) => (x.id === l.id ? { ...x, url: e.target.value } : x)) })} />
              <Button variant="ghost" size="icon" aria-label={`資料${i + 1}を削除`} onClick={() => set({ links: f.links.filter((x) => x.id !== l.id) })}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => set({ links: [...f.links, { id: `l-${Date.now()}`, label: '', url: '' }] })}>
            <Plus className="size-4" aria-hidden />
            URLを追加
          </Button>
        </fieldset>
      </div>
    </Dialog>
  )
}
