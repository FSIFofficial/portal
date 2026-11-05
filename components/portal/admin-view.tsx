'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Bell, ChartColumn, CheckCircle2, ChevronRight, FileText, History, KeyRound, LifeBuoy, Link2Off, LoaderCircle, Plus, RefreshCcw, Settings2, ShieldCheck, UserCog, Users, Wrench, XCircle } from 'lucide-react'
import { DEMO_MODE, EXPECTED_GAS_VERSION } from '@/lib/config'
import { ApiError, api } from '@/lib/api'
import { downloadUrl, driveKindLabel, parseDriveUrl } from '@/lib/drive'
import {
  PERMISSION_LABELS, can, type AdminData, type Announcement, type LogEntry, type Me, type Permission, type PortalDocument,
  type Role, type Settings, type SystemCheck, type Tool, type User,
} from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth } from './auth-provider'
import { ModalFooter, RowActions, SectionHeader, Table, confirmDelete, fmt, useEditor, type Mutate } from './admin-shared'
import { AckStatusModal, BackupPanel, BulkImportModal, ErrorDigestPanel, HelpAdmin, UploadButton, UsageAdmin } from './admin-extra'
import type { Navigate } from './router'
import {
  Button, Checkbox, EmptyState, Field, Modal, RoleBadges, RolePicker, Select, StatusBadge, TONES, TOOL_ICONS, TextArea, TextInput,
  ToolIcon, useToast,
} from './ui'

type Section = 'tools' | 'documents' | 'announcements' | 'help' | 'users' | 'roles' | 'settings' | 'stats' | 'logs' | 'system'

const SECTIONS: { id: Section; label: string; icon: typeof Wrench; allowed: (me: Me) => boolean; description: string }[] = [
  { id: 'tools', label: 'ツール管理', icon: Wrench, allowed: (me) => can(me, 'tools.manage'), description: 'ポータルに掲載するツールと接続先URL・公開範囲を管理します。' },
  { id: 'documents', label: '資料管理', icon: FileText, allowed: (me) => can(me, 'documents.manage'), description: '資料館に掲載するGoogle Driveの資料と公開範囲を管理します。' },
  { id: 'announcements', label: 'お知らせ', icon: Bell, allowed: (me) => can(me, 'announcements.manage'), description: 'ページ上部に表示するお知らせを管理します。' },
  { id: 'help', label: 'ヘルプ編集', icon: LifeBuoy, allowed: (me) => can(me, 'announcements.manage'), description: 'ヘルプ・問い合わせページの内容（問い合わせ先・よくある質問）を編集します。' },
  { id: 'users', label: 'アカウント', icon: UserCog, allowed: (me) => me.isSuper, description: 'ログインできるGoogleアカウントと、割り当てるロールを管理します。' },
  { id: 'roles', label: 'ロールと権限', icon: KeyRound, allowed: (me) => me.isSuper, description: 'ロール（権限のまとまり）を作成し、できる操作を設定します。' },
  { id: 'settings', label: '設定', icon: Settings2, allowed: (me) => me.isSuper, description: '未登録アカウントの扱いなど、ポータル全体の設定です。' },
  { id: 'stats', label: '利用状況', icon: ChartColumn, allowed: (me) => can(me, 'logs.view'), description: 'ツールと資料がどれくらい使われているかを月ごとに集計しています。' },
  { id: 'logs', label: '変更履歴', icon: History, allowed: (me) => can(me, 'logs.view'), description: '画面から行われた変更の履歴です（新しい順・最大300件）。' },
  { id: 'system', label: 'バージョン確認', icon: ShieldCheck, allowed: () => true, description: '画面とGASの版名・シート構成・初期設定が合っているかを確認します。' },
]

export function AdminView({ me, section, navigate }: { me: Me; section: string; navigate: Navigate }) {
  const { run, refresh } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const allowed = SECTIONS.filter((s) => s.allowed(me))
  const current = allowed.find((s) => s.id === section) ?? allowed[0]

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await run((t) => api.adminData(t)))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }, [run, toast])

  useEffect(() => {
    void reload()
  }, [reload])

  /** 保存・削除の共通処理。成功したら管理データと画面全体のデータを再読み込みする */
  const mutate = useCallback(async (fn: (token: string) => Promise<unknown>, message: string) => {
    try {
      await run(fn)
      toast(message)
      await Promise.all([reload(), refresh()])
      return true
    } catch (e) {
      toast((e as Error).message, 'error')
      // 他の人が先に更新していた場合は、最新の内容を読み込み直す（編集中の入力はフォームに残す）
      if (e instanceof ApiError && e.code === 'CONFLICT') await Promise.all([reload(), refresh()]).catch(() => {})
      return false
    }
  }, [run, toast, reload, refresh])

  if (!current) return <EmptyState title="管理権限がありません" />

  return (
    <div className="grid gap-5 lg:grid-cols-[210px_1fr]">
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-[#e4e9f0] bg-white p-2 lg:flex-col lg:self-start lg:p-3" aria-label="管理メニュー">
        <p className="mb-2 hidden px-3 text-[11px] font-bold text-[#9aa8b8] lg:block">管理メニュー</p>
        {allowed.map((s) => {
          const Icon = s.icon
          const active = s.id === current.id
          return (
            <button key={s.id} onClick={() => navigate(`/admin/${s.id}`)} className={cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold', active ? 'bg-[#edf5fc] text-[#1e6db8]' : 'text-[#66788c] hover:bg-[#f6f8fa]')}>
              <Icon size={15} />
              <span className="flex-1">{s.label}</span>
              {active && <ChevronRight size={14} className="hidden lg:block" />}
            </button>
          )
        })}
      </nav>
      <div className="min-w-0 rounded-2xl border border-[#e4e9f0] bg-white">
        {!data ? (
          <div className="flex items-center justify-center gap-2 p-16 text-[13px] text-[#718096]"><LoaderCircle size={18} className="animate-spin" />読み込み中…</div>
        ) : (
          <>
            {current.id === 'tools' && <ToolsAdmin data={data} mutate={mutate} header={(action) => <SectionHeader section={current} action={action} loading={loading} onReload={reload} />} />}
            {current.id === 'documents' && <DocumentsAdmin data={data} mutate={mutate} header={(action) => <SectionHeader section={current} action={action} loading={loading} onReload={reload} />} />}
            {current.id === 'announcements' && <AnnouncementsAdmin data={data} mutate={mutate} header={(action) => <SectionHeader section={current} action={action} loading={loading} onReload={reload} />} />}
            {current.id === 'users' && <UsersAdmin me={me} data={data} mutate={mutate} header={(action) => <SectionHeader section={current} action={action} loading={loading} onReload={reload} />} />}
            {current.id === 'roles' && <RolesAdmin data={data} mutate={mutate} header={(action) => <SectionHeader section={current} action={action} loading={loading} onReload={reload} />} />}
            {current.id === 'settings' && <SettingsAdmin data={data} mutate={mutate} header={<SectionHeader section={current} loading={loading} onReload={reload} />} />}
            {current.id === 'help' && <HelpAdmin section={current} data={data} mutate={mutate} loading={loading} onReload={reload} />}
            {current.id === 'stats' && <UsageAdmin section={current} data={data} />}
            {current.id === 'logs' && <LogsAdmin section={current} />}
            {current.id === 'system' && <SystemAdmin section={current} />}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ツール
// ---------------------------------------------------------------------------

const emptyTool: Tool = { id: '', name: '', description: '', category: '', icon: 'Zap', tone: 'blue', status: '準備中', url: '', visibleRoles: [], order: 0, updatedAt: '', iconUrl: '' }

function ToolsAdmin({ data, mutate, header }: { data: AdminData; mutate: Mutate; header: (action: ReactNode) => ReactNode }) {
  const ed = useEditor<Tool>()
  const categories = useMemo(() => [...new Set(data.tools.map((t) => t.category).filter(Boolean))], [data.tools])
  const save = async () => {
    if (!ed.draft) return
    ed.setSaving(true)
    const ok = await mutate((t) => api.saveTool(t, ed.draft!, ed.isNew), ed.isNew ? 'ツールを追加しました' : 'ツールを更新しました')
    ed.setSaving(false)
    if (ok) ed.close()
  }
  return (
    <>
      {header(<Button onClick={() => ed.open({ ...emptyTool }, true)}><Plus size={15} />新規追加</Button>)}
      <Table head={['', 'ツール名', 'カテゴリ', '状態', '接続先', '公開範囲', '']} empty={!data.tools.length}>
        {data.tools.map((tool) => (
          <tr key={tool.id} className="border-t border-[#edf0f3]">
            <td className="py-3 pl-5"><ToolIcon name={tool.icon} tone={tool.tone} src={tool.iconUrl} size={16} className="size-9" /></td>
            <td className="px-5 py-3 font-semibold text-[#38536f]">{tool.name}<span className="block text-[11px] font-normal text-[#8a99a9]">{tool.description}</span></td>
            <td className="px-5 py-3 text-[#718296]">{tool.category}</td>
            <td className="px-5 py-3"><StatusBadge status={tool.status} /></td>
            <td className="px-5 py-3 text-[#9aa7b5]">{tool.url ? <a href={tool.url} target="_blank" rel="noopener noreferrer" className="text-[#1e6db8] hover:underline">設定済み</a> : '未設定'}</td>
            <td className="px-5 py-3"><RoleBadges ids={tool.visibleRoles} roles={data.roles} /></td>
            <td className="px-5 py-3"><RowActions label={tool.name} onEdit={() => ed.open({ ...tool })} onDelete={() => confirmDelete(tool.name) && void mutate((t) => api.deleteTool(t, tool.id), 'ツールを削除しました')} /></td>
          </tr>
        ))}
      </Table>
      <p className="px-5 py-4 text-[11px] text-[#8a99a9]">並び順は「ツール」画面の「並べ替え」から変更できます。</p>
      {ed.draft && (
        <Modal title={ed.isNew ? 'ツールを追加' : 'ツールを編集'} onClose={ed.close} footer={<ModalFooter onCancel={ed.close} onSave={save} saving={ed.saving} />}>
          <Field label="ツール名" required><TextInput value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} /></Field>
          <Field label="説明"><TextInput value={ed.draft.description} onChange={(e) => ed.set('description', e.target.value)} /></Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="カテゴリ">
              <TextInput list="tool-categories" value={ed.draft.category} onChange={(e) => ed.set('category', e.target.value)} />
              <datalist id="tool-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="状態">
              <Select value={ed.draft.status} onChange={(e) => ed.set('status', e.target.value as Tool['status'])}>
                <option>稼働中</option><option>準備中</option><option>停止中</option>
              </Select>
            </Field>
          </div>
          <Field label="接続先URL" hint="「開く」ボタンで新しいタブに開くURLです。"><TextInput type="url" placeholder="https://" value={ed.draft.url} onChange={(e) => ed.set('url', e.target.value)} /></Field>
          <Field group label="アイコン画像" hint="画像を設定するとアイコンの代わりに表示されます。「画像をアップロード」を使うとDriveに保存して自動で設定します（誰でも表示できるリンク共有になります）。Driveの共有リンクや画像のURLを貼ることもできます。正方形の画像がおすすめです。">
            <div className="flex items-center gap-3">
              <ToolIcon name={ed.draft.icon} tone={ed.draft.tone} src={ed.draft.iconUrl} />
              <TextInput type="url" aria-label="アイコン画像のURL" placeholder="https://drive.google.com/file/d/... または画像のURL" value={ed.draft.iconUrl} onChange={(e) => ed.set('iconUrl', e.target.value)} />
              {ed.draft.iconUrl && <Button variant="ghost" onClick={() => ed.set('iconUrl', '')}>クリア</Button>}
            </div>
            <div className="mt-2"><UploadButton purpose="icon" label="画像をアップロード" onUploaded={(res) => ed.set('iconUrl', res.url)} /></div>
          </Field>
          <Field group label={ed.draft.iconUrl ? 'アイコン（画像が表示できないときの代わり）' : 'アイコン'}>
            <div className="flex flex-wrap gap-2">
              {Object.keys(TOOL_ICONS).map((name) => (
                <button type="button" key={name} onClick={() => ed.set('icon', name)} aria-label={name} aria-pressed={ed.draft!.icon === name} className={cn('rounded-xl p-0.5 ring-2', ed.draft!.icon === name ? 'ring-[#1f6fba]' : 'ring-transparent')}>
                  <ToolIcon name={name} tone={ed.draft!.tone} size={16} className="size-9" />
                </button>
              ))}
            </div>
          </Field>
          <Field group label="色">
            <div className="flex flex-wrap gap-2">
              {Object.keys(TONES).map((tone) => (
                <button type="button" key={tone} onClick={() => ed.set('tone', tone)} aria-label={tone} aria-pressed={ed.draft!.tone === tone} className={cn('size-8 rounded-lg ring-2', TONES[tone], ed.draft!.tone === tone ? 'ring-[#1f6fba]' : 'ring-transparent')} />
              ))}
            </div>
          </Field>
          <Field group label="公開範囲" hint="選んだロールを持つアカウントだけに表示されます。">
            <RolePicker roles={data.roles} value={ed.draft.visibleRoles} onChange={(v) => ed.set('visibleRoles', v)} exclude={['superadmin']} emptyLabel="未選択：ログインできる全員に表示" />
          </Field>
        </Modal>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// 資料
// ---------------------------------------------------------------------------

/** Drive共有の同期結果の表示 */
function SyncBadge({ status, block }: { status: string; block?: boolean }) {
  const tone = status.startsWith('エラー') ? 'text-[#b42318]' : status.startsWith('警告') ? 'text-[#92400e]' : 'text-[#1c7a43]'
  const short = status.startsWith('エラー') ? '共有エラー' : status.startsWith('警告') ? 'リンク共有オン' : status ? '共有を同期中' : '未同期'
  if (block) return <p className={cn('font-semibold', tone)}>{status}</p>
  return <span title={status} className={cn('mt-0.5 block text-[10px] font-semibold', tone)}>{short}</span>
}

const emptyDoc = (): PortalDocument => ({
  id: '', title: '', type: 'マニュアル', tool: '共通', description: '', keywords: '', tags: [], driveUrl: '', downloadUrl: '', thumbnailUrl: '',
  date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }), pinned: false, visibleRoles: [], updatedAt: '',
})

function DocumentsAdmin({ data, mutate, header }: { data: AdminData; mutate: Mutate; header: (action: ReactNode) => ReactNode }) {
  const ed = useEditor<PortalDocument & { tagsText?: string }>()
  const [query, setQuery] = useState('')
  const types = useMemo(() => [...new Set(['オンボーディング', 'マニュアル', ...data.documents.map((d) => d.type)].filter(Boolean))], [data.documents])
  const toolNames = useMemo(() => [...new Set(['共通', ...data.tools.map((t) => t.name), ...data.documents.map((d) => d.tool)].filter(Boolean))], [data.tools, data.documents])
  const docs = [...data.documents].sort((a, b) => b.date.localeCompare(a.date)).filter((d) => `${d.title} ${d.type} ${d.tool}`.toLowerCase().includes(query.toLowerCase()))

  const save = async () => {
    if (!ed.draft) return
    const { tagsText, ...item } = ed.draft
    const payload = { ...item, tags: (tagsText ?? item.tags.join(', ')).split(/[,、]/).map((s) => s.trim()).filter(Boolean) }
    ed.setSaving(true)
    const ok = await mutate((t) => api.saveDocument(t, payload, ed.isNew), ed.isNew ? '資料を追加しました' : '資料を更新しました')
    ed.setSaving(false)
    if (ok) ed.close()
  }
  const syncCount = data.documents.filter((d) => d.driveSync).length
  const restrict = async (doc: PortalDocument) => {
    if (!window.confirm(`「${doc.title}」のDriveのリンク共有をオフにします。\nリンクを知っているだけの人は開けなくなり、ポータルで閲覧できる人だけに共有し直します。よろしいですか？`)) return
    const ok = await mutate((t) => api.restrictLinkSharing(t, doc.id), 'リンク共有をオフにしました')
    if (ok) ed.close()
  }
  const drive = ed.draft ? parseDriveUrl(ed.draft.driveUrl) : null
  const autoDownload = ed.draft ? downloadUrl({ driveUrl: ed.draft.driveUrl, downloadUrl: '' }) : ''

  return (
    <>
      {header(
        <>
          {syncCount > 0 && <Button variant="secondary" onClick={() => void mutate((t) => api.syncDrive(t), 'Driveの共有を同期しました')} title="共有を同期する資料すべてを、今の公開範囲に合わせ直します"><RefreshCcw size={15} />共有を同期</Button>}
          <Button onClick={() => ed.open(emptyDoc(), true)}><Plus size={15} />新規追加</Button>
        </>,
      )}
      <div className="border-b border-[#edf0f3] px-5 py-3"><TextInput placeholder="資料名・種類・ツールで絞り込み" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      <Table head={['資料名', '種類', '関連ツール', 'リンク', '公開範囲', '日付', '']} empty={!docs.length}>
        {docs.map((doc) => (
          <tr key={doc.id} className="border-t border-[#edf0f3]">
            <td className="px-5 py-3 font-semibold text-[#38536f]">{doc.pinned && <span className="mr-1 text-[#c2410c]">📌</span>}{doc.title}</td>
            <td className="px-5 py-3 text-[#718296]">{doc.type}</td>
            <td className="px-5 py-3 text-[#718296]">{doc.tool}</td>
            <td className="px-5 py-3 text-[#9aa7b5]">
              {doc.driveUrl ? <a href={doc.driveUrl} target="_blank" rel="noopener noreferrer" className="text-[#1e6db8] hover:underline">{driveKindLabel(doc.driveUrl)}</a> : '未設定'}
              {doc.driveSync && <SyncBadge status={doc.driveSyncStatus ?? ''} />}
            </td>
            <td className="px-5 py-3"><RoleBadges ids={doc.visibleRoles} roles={data.roles} /></td>
            <td className="whitespace-nowrap px-5 py-3 text-[#718296]">{doc.date}</td>
            <td className="px-5 py-3"><RowActions label={doc.title} onEdit={() => ed.open({ ...doc, tagsText: doc.tags.join(', ') })} onDelete={() => confirmDelete(doc.title) && void mutate((t) => api.deleteDocument(t, doc.id), '資料を削除しました')} /></td>
          </tr>
        ))}
      </Table>
      {ed.draft && (
        <Modal wide title={ed.isNew ? '資料を追加' : '資料を編集'} onClose={ed.close} footer={<ModalFooter onCancel={ed.close} onSave={save} saving={ed.saving} />}>
          <Field label="資料名" required><TextInput value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
          <Field group label="Google Drive のリンク" hint="ファイルをアップロードするか、Driveで「リンクをコピー」したURLを貼り付けてください（ファイル・ドキュメント・スプレッドシート・スライド・フォルダに対応）。">
            <div className="flex flex-col gap-2 sm:flex-row">
              <TextInput type="url" aria-label="Google Drive のリンク" placeholder="https://drive.google.com/file/d/..." value={ed.draft.driveUrl} onChange={(e) => ed.set('driveUrl', e.target.value)} />
              <UploadButton purpose="document" label="ファイルをアップロード" onUploaded={(res) => {
                ed.set('driveUrl', res.url)
                if (!ed.draft?.title) ed.set('title', res.name.replace(/\.[^.]+$/, ''))
                ed.set('driveSync', true)
              }} />
            </div>
            {ed.draft.driveUrl && (
              <span className="mt-2 block rounded-lg bg-[#f5f8fc] px-3 py-2 text-[11px] leading-5 text-[#55708b]">
                判定：<b>{driveKindLabel(ed.draft.driveUrl)}</b>
                {drive && <> ／ ダウンロード：{autoDownload ? <a href={autoDownload} target="_blank" rel="noopener noreferrer" className="text-[#1e6db8] underline">自動生成されたリンクを確認</a> : 'この種類は直接ダウンロードできません（Driveで開いてダウンロード）'}</>}
                {!drive && ' ／ Driveのリンクとして認識できませんでした（外部リンクとして開きます）'}
              </span>
            )}
          </Field>
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Field label="種類">
              <TextInput list="doc-types" value={ed.draft.type} onChange={(e) => ed.set('type', e.target.value)} />
              <datalist id="doc-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="関連ツール" hint="ツールの「使い方」から表示されます。">
              <TextInput list="doc-tools" value={ed.draft.tool} onChange={(e) => ed.set('tool', e.target.value)} />
              <datalist id="doc-tools">{toolNames.map((t) => <option key={t} value={t} />)}</datalist>
            </Field>
            <Field label="日付"><TextInput type="date" value={ed.draft.date} onChange={(e) => ed.set('date', e.target.value)} /></Field>
          </div>
          <Field label="概要"><TextArea value={ed.draft.description} onChange={(e) => ed.set('description', e.target.value)} /></Field>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Field label="タグ" hint="カンマ区切り（例：宇宙, ニュース）"><TextInput value={ed.draft.tagsText ?? ''} onChange={(e) => ed.set('tagsText', e.target.value)} /></Field>
            <Field label="検索キーワード" hint="一覧には表示されず、検索だけに使われます。"><TextInput value={ed.draft.keywords} onChange={(e) => ed.set('keywords', e.target.value)} /></Field>
          </div>
          <Checkbox checked={ed.draft.pinned} onChange={(v) => ed.set('pinned', v)} label="ピックアップに表示する（資料館の先頭・ホームの「はじめての方へ」）" />
          <div className="mt-3">
            <Field group label="公開範囲" hint="選んだロールを持つアカウントだけに表示されます。">
              <RolePicker roles={data.roles} value={ed.draft.visibleRoles} onChange={(v) => ed.set('visibleRoles', v)} exclude={['superadmin']} emptyLabel="未選択：ログインできる全員に表示" />
            </Field>
          </div>
          <div className="mb-4 rounded-xl border border-[#d9e8f3] bg-[#f7fafd] p-3">
            <Checkbox checked={!!ed.draft.driveSync} onChange={(v) => ed.set('driveSync', v)} label={<><b>Driveの共有を公開範囲に合わせる</b><span className="block text-[11px] leading-5 text-[#8a99a9]">オンにすると、この資料を見られるアカウントをDriveの閲覧者に自動で追加し、見られなくなった人は外します（ポータルが追加した人だけ。手動で共有した相手には触れません）。アカウントやロールを変更したときも自動で合わせ直します。</span></>} />
            {ed.draft.driveSyncStatus && (
              <div className="mt-2 border-t border-[#e4eef7] pt-2 text-[12px] leading-5">
                <SyncBadge status={ed.draft.driveSyncStatus} block />
                {ed.draft.driveSyncStatus.startsWith('警告') && !ed.isNew && (
                  <Button variant="danger" className="mt-2" onClick={() => void restrict(ed.draft!)}><Link2Off size={14} />リンク共有をオフにする</Button>
                )}
              </div>
            )}
          </div>
          <details className="rounded-lg border border-[#edf0f3] px-3 py-2">
            <summary className="cursor-pointer text-[12px] font-bold text-[#55708b]">詳細設定（通常は空欄のままでOK）</summary>
            <div className="mt-3">
              <Field label="ダウンロードURL（上書き）" hint="空欄ならDriveのリンクから自動で作ります。"><TextInput type="url" value={ed.draft.downloadUrl} onChange={(e) => ed.set('downloadUrl', e.target.value)} /></Field>
              <Field label="サムネイル画像URL（上書き）" hint="空欄ならDriveのサムネイルを使います。"><TextInput type="url" value={ed.draft.thumbnailUrl} onChange={(e) => ed.set('thumbnailUrl', e.target.value)} /></Field>
            </div>
          </details>
        </Modal>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// お知らせ
// ---------------------------------------------------------------------------

const emptyAnnouncement: Announcement = { id: '', title: '', body: '', level: 'info', active: true, startDate: '', endDate: '', visibleRoles: [], updatedAt: '' }

function AnnouncementsAdmin({ data, mutate, header }: { data: AdminData; mutate: Mutate; header: (action: ReactNode) => ReactNode }) {
  const ed = useEditor<Announcement>()
  const [ackOf, setAckOf] = useState<Announcement | null>(null)
  const save = async () => {
    if (!ed.draft) return
    ed.setSaving(true)
    const ok = await mutate((t) => api.saveAnnouncement(t, ed.draft!, ed.isNew), ed.isNew ? 'お知らせを追加しました' : 'お知らせを更新しました')
    ed.setSaving(false)
    if (ok) ed.close()
  }
  return (
    <>
      {header(<Button onClick={() => ed.open({ ...emptyAnnouncement }, true)}><Plus size={15} />新規追加</Button>)}
      {ackOf && <AckStatusModal announcement={ackOf} onClose={() => setAckOf(null)} />}
      <Table head={['タイトル', '種別', '表示', '期間', '公開範囲', '確認状況', '']} empty={!data.announcements.length}>
        {data.announcements.map((a) => (
          <tr key={a.id} className="border-t border-[#edf0f3]">
            <td className="px-5 py-3 font-semibold text-[#38536f]">{a.title}<span className="block text-[11px] font-normal text-[#8a99a9]">{a.body}</span></td>
            <td className="px-5 py-3">{a.level === 'important' ? <span className="rounded bg-[#f7d8d6] px-1.5 py-0.5 text-[10px] font-bold text-[#a13b3b]">重要</span> : <span className="rounded bg-[#e6f0fa] px-1.5 py-0.5 text-[10px] font-bold text-[#285b82]">通常</span>}</td>
            <td className="px-5 py-3 text-[#718296]">{a.active ? '表示中' : '非表示'}</td>
            <td className="whitespace-nowrap px-5 py-3 text-[#718296]">{a.startDate || a.endDate ? `${a.startDate || '…'} 〜 ${a.endDate || '…'}` : '常時'}</td>
            <td className="px-5 py-3"><RoleBadges ids={a.visibleRoles} roles={data.roles} /></td>
            <td className="whitespace-nowrap px-5 py-3">
              {a.requireAck ? (
                <button onClick={() => setAckOf(a)} className="font-semibold text-[#1e6db8] hover:underline">{data.ackCounts?.[a.id] ?? 0}人が確認 ›</button>
              ) : <span className="text-[11px] text-[#9aa7b5]">不要</span>}
            </td>
            <td className="px-5 py-3"><RowActions label={a.title} onEdit={() => ed.open({ ...a })} onDelete={() => confirmDelete(a.title) && void mutate((t) => api.deleteAnnouncement(t, a.id), 'お知らせを削除しました')} /></td>
          </tr>
        ))}
      </Table>
      {ed.draft && (
        <Modal title={ed.isNew ? 'お知らせを追加' : 'お知らせを編集'} onClose={ed.close} footer={<ModalFooter onCancel={ed.close} onSave={save} saving={ed.saving} />}>
          <Field label="タイトル" required><TextInput value={ed.draft.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
          <Field label="本文"><TextArea value={ed.draft.body} onChange={(e) => ed.set('body', e.target.value)} /></Field>
          <div className="grid gap-x-4 sm:grid-cols-3">
            <Field label="種別">
              <Select value={ed.draft.level} onChange={(e) => ed.set('level', e.target.value as Announcement['level'])}>
                <option value="info">通常</option><option value="important">重要</option>
              </Select>
            </Field>
            <Field label="表示開始日"><TextInput type="date" value={ed.draft.startDate} onChange={(e) => ed.set('startDate', e.target.value)} /></Field>
            <Field label="表示終了日"><TextInput type="date" value={ed.draft.endDate} onChange={(e) => ed.set('endDate', e.target.value)} /></Field>
          </div>
          <Checkbox checked={ed.draft.active} onChange={(v) => ed.set('active', v)} label="表示する" />
          <Checkbox checked={!!ed.draft.requireAck} onChange={(v) => ed.set('requireAck', v)} label={<><b>確認を求める</b><span className="block text-[11px] leading-5 text-[#8a99a9]">「確認しました」ボタンを表示し、押すまでお知らせが消えなくなります。誰が確認したかを一覧で見られます。</span></>} />
          <div className="mt-3">
            <Field group label="公開範囲"><RolePicker roles={data.roles} value={ed.draft.visibleRoles} onChange={(v) => ed.set('visibleRoles', v)} exclude={['superadmin']} emptyLabel="未選択：ログインできる全員に表示" /></Field>
          </div>
        </Modal>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// アカウント（全権管理者のみ）
// ---------------------------------------------------------------------------

const emptyUser: User = { email: '', name: '', roles: ['member'], active: true, note: '', createdAt: '', updatedAt: '', lastLoginAt: '' }

function UsersAdmin({ me, data, mutate, header }: { me: Me; data: AdminData; mutate: Mutate; header: (action: ReactNode) => ReactNode }) {
  const ed = useEditor<User>()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [bulk, setBulk] = useState(false)
  const users = (data.users ?? []).filter((u) => `${u.email} ${u.name} ${u.note}`.toLowerCase().includes(query.toLowerCase()) && (!roleFilter || u.roles.includes(roleFilter)))
  const save = async () => {
    if (!ed.draft) return
    ed.setSaving(true)
    const ok = await mutate((t) => api.saveUser(t, ed.draft!, ed.isNew), ed.isNew ? 'アカウントを追加しました' : 'アカウントを更新しました')
    ed.setSaving(false)
    if (ok) ed.close()
  }
  return (
    <>
      {header(
        <>
          <Button variant="secondary" onClick={() => setBulk(true)}><Users size={15} />一括登録</Button>
          <Button onClick={() => ed.open({ ...emptyUser }, true)}><Plus size={15} />アカウント追加</Button>
        </>,
      )}
      {bulk && <BulkImportModal data={data} mutate={mutate} onClose={() => setBulk(false)} />}
      <div className="flex flex-col gap-2 border-b border-[#edf0f3] px-5 py-3 sm:flex-row">
        <TextInput placeholder="名前・メールアドレス・メモで絞り込み" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="sm:w-[200px]" aria-label="ロールで絞り込み">
          <option value="">すべてのロール</option>
          {data.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </div>
      <Table head={['名前 / メールアドレス', 'ロール', '状態', '最終ログイン', '']} empty={!users.length}>
        {users.map((u) => (
          <tr key={u.email} className="border-t border-[#edf0f3]">
            <td className="px-5 py-3 font-semibold text-[#38536f]">{u.name}{u.email === me.email && <span className="ml-1 text-[10px] text-[#1e6db8]">（自分）</span>}<span className="block text-[11px] font-normal text-[#8a99a9]">{u.email}</span></td>
            <td className="px-5 py-3"><RoleBadges ids={u.roles} roles={data.roles} emptyLabel="なし" /></td>
            <td className="px-5 py-3">{u.active ? <span className="text-[#1c7a43]">有効</span> : <span className="text-[#b42318]">無効</span>}</td>
            <td className="whitespace-nowrap px-5 py-3 text-[#718296]">{fmt(u.lastLoginAt)}</td>
            <td className="px-5 py-3"><RowActions label={u.email} onEdit={() => ed.open({ ...u })} onDelete={u.email === me.email ? undefined : () => confirmDelete(u.email) && void mutate((t) => api.deleteUser(t, u.email), 'アカウントを削除しました')} /></td>
          </tr>
        ))}
      </Table>
      {ed.draft && (
        <Modal title={ed.isNew ? 'アカウントを追加' : 'アカウントを編集'} onClose={ed.close} footer={<ModalFooter onCancel={ed.close} onSave={save} saving={ed.saving} />}>
          <Field label="Googleアカウントのメールアドレス" required hint="このアドレスでGoogleログインした人がポータルを使えるようになります。">
            <TextInput type="email" value={ed.draft.email} disabled={!ed.isNew} onChange={(e) => ed.set('email', e.target.value)} placeholder="name@example.com" />
          </Field>
          <Field label="表示名"><TextInput value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} placeholder="未入力ならGoogleの名前を使います" /></Field>
          <Field group label="ロール" hint="複数選べます。権限と閲覧範囲は割り当てたロールの合計になります。">
            <RolePicker roles={data.roles} value={ed.draft.roles} onChange={(v) => ed.set('roles', v)} emptyLabel="ロールなし：公開範囲が「全員」のものだけ閲覧できます" />
          </Field>
          <Field label="メモ"><TextInput value={ed.draft.note} onChange={(e) => ed.set('note', e.target.value)} placeholder="所属・担当など" /></Field>
          <Checkbox checked={ed.draft.active} onChange={(v) => ed.set('active', v)} label="有効（オフにするとログインできなくなります）" />
        </Modal>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// ロールと権限（全権管理者のみ）
// ---------------------------------------------------------------------------

const emptyRole: Role = { id: '', name: '', description: '', permissions: [], builtin: false }

function RolesAdmin({ data, mutate, header }: { data: AdminData; mutate: Mutate; header: (action: ReactNode) => ReactNode }) {
  const ed = useEditor<Role>()
  const userCount = (id: string) => (data.users ?? []).filter((u) => u.roles.includes(id)).length
  const visibleCount = (id: string) =>
    data.tools.filter((t) => t.visibleRoles.includes(id)).length + data.documents.filter((d) => d.visibleRoles.includes(id)).length
  const save = async () => {
    if (!ed.draft) return
    ed.setSaving(true)
    const ok = await mutate((t) => api.saveRole(t, ed.draft!, ed.isNew), ed.isNew ? 'ロールを作成しました' : 'ロールを更新しました')
    ed.setSaving(false)
    if (ok) ed.close()
  }
  const togglePerm = (p: Permission, on: boolean) => ed.set('permissions', on ? [...ed.draft!.permissions, p] : ed.draft!.permissions.filter((x) => x !== p))
  return (
    <>
      {header(<Button onClick={() => ed.open({ ...emptyRole }, true)}><Plus size={15} />ロール作成</Button>)}
      <div className="border-b border-[#edf0f3] bg-[#f8fafc] px-5 py-3 text-[11px] leading-5 text-[#55708b]">
        <b>使い方：</b>①ロールを作る → ②「アカウント」でユーザーにロールを割り当てる → ③ツール・資料・お知らせの「公開範囲」でロールを選ぶと、そのロールを持つ人だけに表示されます。
      </div>
      <Table head={['ロール', 'できる操作', '割当人数', '限定公開の項目数', '']} empty={!data.roles.length}>
        {data.roles.map((r) => (
          <tr key={r.id} className="border-t border-[#edf0f3]">
            <td className="px-5 py-3 font-semibold text-[#38536f]">
              {r.name}{r.builtin && <span className="ml-1 rounded bg-[#eef1f5] px-1.5 py-0.5 text-[10px] text-[#6b7785]">標準</span>}
              <span className="block text-[11px] font-normal text-[#8a99a9]">ID: {r.id}{r.description && ` · ${r.description}`}</span>
            </td>
            <td className="px-5 py-3 text-[#55708b]">
              {r.permissions.includes('*') ? <b>すべての操作（アカウント・権限管理を含む）</b> : r.permissions.length ? r.permissions.map((p) => PERMISSION_LABELS[p as Exclude<Permission, '*'>] ?? p).join(' / ') : <span className="text-[#9aa7b5]">閲覧のみ</span>}
            </td>
            <td className="px-5 py-3 text-[#718296]">{userCount(r.id)}人</td>
            <td className="px-5 py-3 text-[#718296]">{visibleCount(r.id)}件</td>
            <td className="px-5 py-3">
              {r.id === 'superadmin' ? <span className="block text-right text-[11px] text-[#9aa7b5]">変更不可</span> : (
                <RowActions label={r.name} onEdit={() => ed.open({ ...r })} onDelete={r.builtin ? undefined : () => confirmDelete(r.name) && void mutate((t) => api.deleteRole(t, r.id), 'ロールを削除しました')} />
              )}
            </td>
          </tr>
        ))}
      </Table>
      {ed.draft && (
        <Modal title={ed.isNew ? 'ロールを作成' : 'ロールを編集'} onClose={ed.close} footer={<ModalFooter onCancel={ed.close} onSave={save} saving={ed.saving} />}>
          <Field label="ロールID" required hint="半角英小文字・数字・-_（例：contract, pr-team）。作成後は変更できません。">
            <TextInput value={ed.draft.id} disabled={!ed.isNew} onChange={(e) => ed.set('id', e.target.value.toLowerCase())} />
          </Field>
          <Field label="ロール名" required><TextInput value={ed.draft.name} onChange={(e) => ed.set('name', e.target.value)} placeholder="例：契約担当" /></Field>
          <Field label="説明"><TextInput value={ed.draft.description} onChange={(e) => ed.set('description', e.target.value)} /></Field>
          <Field group label="できる操作" hint="何もチェックしなければ「閲覧のみ」のロールになります。アカウントと権限の管理は全権管理者だけができます。">
            <div className="rounded-lg border border-[#edf0f3] px-3 py-2">
              {(Object.keys(PERMISSION_LABELS) as Exclude<Permission, '*'>[]).map((p) => (
                <Checkbox key={p} checked={ed.draft!.permissions.includes(p)} onChange={(v) => togglePerm(p, v)} label={PERMISSION_LABELS[p]} />
              ))}
            </div>
          </Field>
        </Modal>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// 設定（全権管理者のみ）
// ---------------------------------------------------------------------------

function SettingsAdmin({ data, mutate, header }: { data: AdminData; mutate: Mutate; header: ReactNode }) {
  const [draft, setDraft] = useState<Settings & { domainsText: string }>(() => {
    const s = data.settings ?? { allowUnregistered: false, defaultRoles: ['member'], allowedDomains: [] }
    return { ...s, domainsText: s.allowedDomains.join(', ') }
  })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    const { domainsText, ...rest } = draft
    await mutate((t) => api.saveSettings(t, { ...rest, allowedDomains: domainsText.split(/[,\s]+/).filter(Boolean) }), '設定を保存しました')
    setSaving(false)
  }
  return (
    <>
      {header}
      <div className="max-w-[620px] p-5">
        <Checkbox checked={draft.allowUnregistered} onChange={(v) => setDraft({ ...draft, allowUnregistered: v })} label={<><b>未登録のGoogleアカウントのログインを許可する</b><span className="block text-[11px] text-[#8a99a9]">オフ（推奨）の場合、「アカウント」に登録した人だけがログインできます。オンにすると初回ログイン時に自動登録されます。</span></>} />
        {draft.allowUnregistered && (
          <div className="mt-4 rounded-xl border border-[#edf0f3] p-4">
            <Field label="自動登録を許可するドメイン" hint="カンマ区切り（例：fsif.jp）。空欄だとすべてのGoogleアカウントが対象になるので注意してください。">
              <TextInput value={draft.domainsText} onChange={(e) => setDraft({ ...draft, domainsText: e.target.value })} placeholder="example.com" />
            </Field>
            <Field group label="自動登録時のロール">
              <RolePicker roles={data.roles} value={draft.defaultRoles} onChange={(v) => setDraft({ ...draft, defaultRoles: v })} exclude={['superadmin']} emptyLabel="ロールなし" />
            </Field>
          </div>
        )}
        <div className="mt-6"><Button onClick={save} disabled={saving}>{saving ? '保存中…' : '設定を保存'}</Button></div>
        <ErrorDigestPanel initial={data.errorDigest} />
        <BackupPanel initial={data.backup} uploadFolderUrl={data.uploadFolderUrl} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// 変更履歴
// ---------------------------------------------------------------------------

const ACTION_LABELS: Record<string, string> = {
  create: '追加', update: '更新', delete: '削除', reorder: '並べ替え', autoRegister: '自動登録',
}
const SHEET_LABELS: Record<string, string> = {
  Tools: 'ツール', Documents: '資料', Announcements: 'お知らせ', Users: 'アカウント', Roles: 'ロール', Settings: '設定', user: 'アカウント',
}
const actionLabel = (action: string) => {
  const [sheet, op] = action.split('.')
  return `${SHEET_LABELS[sheet] ?? sheet}の${ACTION_LABELS[op] ?? op}`
}

function LogsAdmin({ section }: { section: (typeof SECTIONS)[number] }) {
  const { run } = useAuth()
  const toast = useToast()
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    run((t) => api.listLogs(t))
      .then(setLogs)
      .catch((e: Error) => {
        toast(e.message, 'error')
        setLogs([])
      })
      .finally(() => setLoading(false))
  }, [run, toast])
  useEffect(load, [load])
  return (
    <>
      <SectionHeader section={section} loading={loading} onReload={load} />
      {!logs ? (
        <div className="flex items-center justify-center gap-2 p-16 text-[13px] text-[#718096]"><LoaderCircle size={18} className="animate-spin" />読み込み中…</div>
      ) : (
        <Table head={['日時', '操作者', '操作', '対象', '内容']} empty={!logs.length}>
          {logs.map((l, i) => (
            <tr key={i} className="border-t border-[#edf0f3]">
              <td className="whitespace-nowrap px-5 py-3 text-[#718296]">{fmt(l.timestamp)}</td>
              <td className="px-5 py-3 text-[#38536f]">{l.email}</td>
              <td className="whitespace-nowrap px-5 py-3 font-semibold text-[#38536f]">{actionLabel(l.action)}</td>
              <td className="max-w-[160px] truncate px-5 py-3 text-[#718296]">{l.target}</td>
              <td className="max-w-[260px] truncate px-5 py-3 text-[#718296]" title={l.detail}>{l.detail}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// バージョン確認（画面とGASの版名・シート構成の照合）
// ---------------------------------------------------------------------------

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-[#edf0f3] px-5 py-3.5 first:border-t-0">
      {ok ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#1c7a43]" /> : <XCircle size={18} className="mt-0.5 shrink-0 text-[#b42318]" />}
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-[#1b304b]">{label}</p>
        <div className="mt-0.5 text-[12px] leading-5 text-[#55708b]">{detail}</div>
      </div>
    </div>
  )
}

function SystemAdmin({ section }: { section: (typeof SECTIONS)[number] }) {
  const { run } = useAuth()
  const toast = useToast()
  const [info, setInfo] = useState<SystemCheck | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const load = useCallback(() => {
    setLoading(true)
    setError('')
    run((t) => api.systemCheck(t))
      .then(setInfo)
      .catch((e: Error) => {
        setInfo(null)
        setError(e.message)
        toast(e.message, 'error')
      })
      .finally(() => setLoading(false))
  }, [run, toast])
  useEffect(load, [load])

  const versionOk = !!info && info.version === EXPECTED_GAS_VERSION
  const badSheets = info?.sheets.filter((s) => !s.ok) ?? []
  const allOk = !!info && versionOk && !badSheets.length && info.clientIdSet && info.superAdminCount > 0

  return (
    <>
      <SectionHeader section={section} loading={loading} onReload={load} />
      {!info && !error ? (
        <div className="flex items-center justify-center gap-2 p-16 text-[13px] text-[#718096]"><LoaderCircle size={18} className="animate-spin" />確認中…</div>
      ) : (
        <div className="p-5">
          <div className={cn('mb-5 flex items-start gap-3 rounded-xl p-4 text-[13px] leading-6', allOk ? 'bg-[#eaf7ef] text-[#1c5c37]' : 'bg-[#fff5f4] text-[#9b2c2c]')}>
            {allOk ? <CheckCircle2 size={20} className="mt-0.5 shrink-0" /> : <AlertTriangle size={20} className="mt-0.5 shrink-0" />}
            <div>
              <p className="font-bold">{allOk ? 'すべて正常です' : '確認が必要な項目があります'}</p>
              {!allOk && <p className="text-[12px]">GASコードを最新版に差し替えて「新バージョン」でデプロイし直し、エディタで setup() を実行してください。</p>}
              {DEMO_MODE && <p className="text-[12px]">※ デモモードのため、GASには接続していません。</p>}
            </div>
          </div>
          <div className="rounded-xl border border-[#edf0f3]">
            <CheckRow
              ok={!error && versionOk}
              label="GASの版名"
              detail={error ? <>GASに接続できませんでした：{error}</> : <>画面が想定している版：<b>{EXPECTED_GAS_VERSION}</b> ／ 動いているGASの版：<b>{info?.version || '不明（古い版の可能性）'}</b>{!versionOk && <span className="block">→ 版が一致しません。GASコード1行目の GAS_VERSION を確認してください。</span>}</>}
            />
            {info && (
              <>
                <CheckRow
                  ok={!badSheets.length}
                  label="スプレッドシートの構成"
                  detail={badSheets.length ? (
                    <ul className="list-disc pl-4">
                      {badSheets.map((s) => (
                        <li key={s.name}><b>{s.name}</b>：{s.missing.length ? `列が足りない・順番が違う（${s.missing.join(', ')}）` : ''}{s.extra.length ? ` 余分な列（${s.extra.join(', ')}）` : ''}</li>
                      ))}
                    </ul>
                  ) : <>{info.sheets.length}シートすべて想定どおりです（{info.sheets.map((s) => s.name).join(' / ')}）</>}
                />
                <CheckRow ok={info.clientIdSet} label="GoogleログインのクライアントID" detail={info.clientIdSet ? 'スクリプトプロパティ GOOGLE_CLIENT_ID が設定されています' : 'スクリプトプロパティ GOOGLE_CLIENT_ID が未設定です'} />
                <CheckRow ok={info.superAdminCount > 0} label="全権管理者（固定）" detail={info.superAdminCount > 0 ? `SUPER_ADMIN_EMAILS に ${info.superAdminCount} 件登録されています` : 'スクリプトプロパティ SUPER_ADMIN_EMAILS が未設定です（ロックアウト防止のため設定を推奨）'} />
                {info.recentErrors && (
                  <CheckRow
                    ok={!info.recentErrors.length}
                    label="直近7日間のエラー"
                    detail={info.recentErrors.length ? (
                      <ul className="list-disc pl-4">
                        {info.recentErrors.map((e, i) => <li key={i}><span className="text-[#8a99a9]">{fmt(e.timestamp)}</span> [{e.code}] {e.message}</li>)}
                      </ul>
                    ) : 'エラーは記録されていません'}
                  />
                )}
              </>
            )}
          </div>
          {info && <p className="mt-3 text-[11px] text-[#9aa7b5]">確認日時：{fmt(info.checkedAt)}</p>}
        </div>
      )}
    </>
  )
}
