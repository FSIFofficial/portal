'use client'

// 管理画面：リンク集の管理
import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import type { AdminData, PortalLink } from '@/lib/types'
import { ModalFooter, RowActions, Table, confirmDelete, useEditor, type Mutate } from './admin-shared'
import { IconImageField } from './icon-field'
import { SiteIcon } from './links-view'
import { Field, Modal, RoleBadges, RolePicker, TextInput } from './ui'
import { Button } from './ui'

const emptyLink: PortalLink = { id: '', title: '', url: '', description: '', category: '', visibleRoles: [], order: 0, updatedAt: '', iconUrl: '' }

export function LinksAdmin({ data, mutate, header }: { data: AdminData; mutate: Mutate; header: (action: ReactNode) => ReactNode }) {
  const ed = useEditor<PortalLink>()
  const [moving, setMoving] = useState(false)
  const links = useMemo(() => data.links ?? [], [data.links])
  const categories = useMemo(() => [...new Set(links.map((l) => l.category).filter(Boolean))], [links])

  const save = async () => {
    if (!ed.draft) return
    ed.setSaving(true)
    const ok = await mutate((t) => api.saveLink(t, ed.draft!, ed.isNew), ed.isNew ? 'リンクを追加しました' : 'リンクを更新しました')
    ed.setSaving(false)
    if (ok) ed.close()
  }

  /** 1つ上・下に動かして、すぐ保存する（並べ替え中に他の人が変更していたら止まる） */
  const move = async (index: number, delta: number) => {
    const to = index + delta
    if (to < 0 || to >= links.length) return
    const ids = links.map((l) => l.id)
    const next = [...ids]
    ;[next[index], next[to]] = [next[to], next[index]]
    setMoving(true)
    await mutate((t) => api.reorderLinks(t, next, ids), '並び順を変更しました')
    setMoving(false)
  }

  return (
    <>
      {header(<Button onClick={() => ed.open({ ...emptyLink }, true)}><Plus size={15} />新規追加</Button>)}
      <Table head={['並び順', 'リンク名', 'カテゴリ', 'URL', '公開範囲', '']} empty={!links.length}>
        {links.map((l, i) => (
          <tr key={l.id} className="border-t border-[#edf0f3]">
            <td className="whitespace-nowrap px-5 py-3">
              <div className="flex items-center gap-1">
                <span className="w-5 text-right text-[11px] font-bold text-[#5b6b7c]">{i + 1}</span>
                <button onClick={() => void move(i, -1)} disabled={moving || i === 0} aria-label={`${l.title}を上へ`} className="rounded p-1 text-[#55708b] hover:bg-[#f1f5f8] disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => void move(i, 1)} disabled={moving || i === links.length - 1} aria-label={`${l.title}を下へ`} className="rounded p-1 text-[#55708b] hover:bg-[#f1f5f8] disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
            </td>
            <td className="px-5 py-3 font-semibold text-[#38536f]">{l.title}<span className="block text-[11px] font-normal text-[#5b6b7c]">{l.description}</span></td>
            <td className="px-5 py-3 text-[#4f5f70]">{l.category || 'その他'}</td>
            <td className="max-w-[220px] truncate px-5 py-3"><a href={l.url} target="_blank" rel="noopener noreferrer" className="text-[var(--brand-fg)] hover:underline">{l.url}</a></td>
            <td className="px-5 py-3"><RoleBadges ids={l.visibleRoles} roles={data.roles} /></td>
            <td className="px-5 py-3"><RowActions label={l.title} onEdit={() => ed.open({ ...l })} onDelete={() => confirmDelete(l.title) && void mutate((t) => api.deleteLink(t, l.id), 'リンクを削除しました（ゴミ箱から元に戻せます）')} /></td>
          </tr>
        ))}
      </Table>
      <p className="px-5 py-4 text-[11px] text-[#5b6b7c]">リンク集ではカテゴリごとにまとめて表示されます。同じカテゴリの中では、この並び順で表示されます。</p>
      {ed.draft && (
        <Modal title={ed.isNew ? 'リンクを追加' : 'リンクを編集'} onClose={ed.close} footer={<ModalFooter onCancel={ed.close} onSave={save} saving={ed.saving} />}>
          <Field label="リンク名" required><TextInput value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} placeholder="例：経費精算フォーム" /></Field>
          <Field label="URL" required><TextInput type="url" value={ed.draft.url} onChange={(e) => ed.set('url', e.target.value)} placeholder="https://" /></Field>
          <Field label="説明"><TextInput value={ed.draft.description} onChange={(e) => ed.set('description', e.target.value)} placeholder="どんなときに使うか" /></Field>
          <Field group label="アイコン画像（任意）" hint="空欄ならサイトのアイコンを自動で表示します。社内サイトなどでアイコンが出ないときは、画像のURLを入れるかアップロードしてください。貼るかアップロードすると、表示する位置と大きさを決める画面が開きます。">
            <IconImageField
              value={ed.draft.iconUrl ?? ''}
              onChange={(v) => ed.set('iconUrl', v)}
              placeholder="https://… または Driveの共有リンク"
              preview={(v) => <SiteIcon link={{ url: ed.draft!.url, iconUrl: v, title: ed.draft!.title }} />}
            />
          </Field>
          <Field label="カテゴリ" hint="同じカテゴリのリンクがまとめて表示されます。空欄なら「その他」になります。">
            <TextInput list="link-categories" value={ed.draft.category} onChange={(e) => ed.set('category', e.target.value)} />
            <datalist id="link-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field group label="公開範囲" hint="選んだロールを持つアカウントだけに表示されます。">
            <RolePicker roles={data.roles} value={ed.draft.visibleRoles} onChange={(v) => ed.set('visibleRoles', v)} exclude={['superadmin']} emptyLabel="未選択：ログインできる全員に表示" />
          </Field>
        </Modal>
      )}
    </>
  )
}
