'use client'

// 管理画面の追加機能：ヘルプ編集・利用状況・アカウント一括登録・バックアップ・Driveへのアップロード
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, BellRing, CheckCircle2, Circle, DatabaseBackup, ExternalLink, LoaderCircle, Plus, Trash2, Upload } from 'lucide-react'
import { api, fileToBase64 } from '@/lib/api'
import { DEMO_MODE } from '@/lib/config'
import type { AckStatus, AdminData, Announcement, BackupStatus, ErrorDigestStatus, BulkAddResult, HelpContent, UploadResult, UsageStats } from '@/lib/types'
import { cn } from '@/lib/utils'
import { SectionHeader, Table, fmt, type Mutate } from './admin-shared'
import { useAuth } from './auth-provider'
import { Button, Field, Modal, RolePicker, TextArea, TextInput, useToast } from './ui'

type SectionInfo = { label: string; description: string }

// ---------------------------------------------------------------------------
// ヘルプ・問い合わせの編集
// ---------------------------------------------------------------------------

export function HelpAdmin({ section, data, mutate, loading, onReload }: { section: SectionInfo; data: AdminData; mutate: Mutate; loading: boolean; onReload: () => void }) {
  const [draft, setDraft] = useState<HelpContent>(() => data.help ?? { intro: '', contacts: [], faqs: [] })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    await mutate((t) => api.saveHelp(t, draft), 'ヘルプを保存しました')
    setSaving(false)
  }
  const moveFaq = (i: number, d: number) => {
    const faqs = [...draft.faqs]
    const j = i + d
    if (j < 0 || j >= faqs.length) return
    ;[faqs[i], faqs[j]] = [faqs[j], faqs[i]]
    setDraft({ ...draft, faqs })
  }
  return (
    <>
      <SectionHeader section={section} loading={loading} onReload={onReload} action={<Button onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</Button>} />
      <div className="max-w-[760px] p-5">
        <Field label="はじめの説明" hint="ヘルプページの一番上に表示されます。">
          <TextArea rows={4} value={draft.intro} onChange={(e) => setDraft({ ...draft, intro: e.target.value })} />
        </Field>
        <Field group label="問い合わせ先" hint="値にメールアドレスを入れるとメール作成、URLを入れるとリンクになります。">
          <div className="flex flex-col gap-2">
            {draft.contacts.map((c, i) => (
              <div key={i} className="flex gap-2">
                <TextInput aria-label="名前" placeholder="例：ポータル管理担当" value={c.label} className="sm:max-w-[220px]" onChange={(e) => setDraft({ ...draft, contacts: draft.contacts.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)) })} />
                <TextInput aria-label="連絡先" placeholder="メールアドレス・URL・電話番号など" value={c.value} onChange={(e) => setDraft({ ...draft, contacts: draft.contacts.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) })} />
                <Button variant="ghost" aria-label="この問い合わせ先を削除" onClick={() => setDraft({ ...draft, contacts: draft.contacts.filter((_, k) => k !== i) })}><Trash2 size={15} /></Button>
              </div>
            ))}
            <Button variant="secondary" className="self-start" onClick={() => setDraft({ ...draft, contacts: [...draft.contacts, { label: '', value: '' }] })}><Plus size={14} />問い合わせ先を追加</Button>
          </div>
        </Field>
        <Field group label="よくある質問">
          <div className="flex flex-col gap-3">
            {draft.faqs.map((f, i) => (
              <div key={i} className="rounded-xl border border-[#edf0f3] p-3">
                <div className="flex gap-2">
                  <TextInput aria-label={`質問${i + 1}`} placeholder="質問" value={f.q} onChange={(e) => setDraft({ ...draft, faqs: draft.faqs.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                  <Button variant="ghost" aria-label="上へ" onClick={() => moveFaq(i, -1)} disabled={i === 0}><ArrowUp size={14} /></Button>
                  <Button variant="ghost" aria-label="下へ" onClick={() => moveFaq(i, 1)} disabled={i === draft.faqs.length - 1}><ArrowDown size={14} /></Button>
                  <Button variant="ghost" aria-label="この質問を削除" onClick={() => setDraft({ ...draft, faqs: draft.faqs.filter((_, k) => k !== i) })}><Trash2 size={15} /></Button>
                </div>
                <TextArea className="mt-2" aria-label={`回答${i + 1}`} placeholder="回答" value={f.a} onChange={(e) => setDraft({ ...draft, faqs: draft.faqs.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} />
              </div>
            ))}
            <Button variant="secondary" className="self-start" onClick={() => setDraft({ ...draft, faqs: [...draft.faqs, { q: '', a: '' }] })}><Plus size={14} />質問を追加</Button>
          </div>
        </Field>
        <p className="text-[11px] text-[#8a99a9]">空欄の行は保存時に取り除かれます。</p>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// 利用状況
// ---------------------------------------------------------------------------

export function UsageAdmin({ section, data }: { section: SectionInfo; data: AdminData }) {
  const { run } = useAuth()
  const toast = useToast()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<'tool' | 'doc'>('tool')
  const load = useCallback(() => {
    setLoading(true)
    run((t) => api.usageStats(t))
      .then(setStats)
      .catch((e: Error) => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [run, toast])
  useEffect(load, [load])

  const rows = useMemo(() => {
    const items = kind === 'tool'
      ? data.tools.map((t) => ({ id: t.id, name: t.name, sub: t.category }))
      : data.documents.map((d) => ({ id: d.id, name: d.title, sub: d.type }))
    return items
      .map((it) => {
        const s = stats?.rows.find((r) => r.kind === kind && r.id === it.id)
        return { ...it, thisMonth: s?.thisMonth ?? 0, lastMonth: s?.lastMonth ?? 0, last3Months: s?.last3Months ?? 0, lastAt: s?.lastAt ?? '' }
      })
      .sort((a, b) => b.last3Months - a.last3Months || a.name.localeCompare(b.name, 'ja'))
  }, [data, stats, kind])
  const unused = rows.filter((r) => r.last3Months === 0).length

  return (
    <>
      <SectionHeader section={section} loading={loading} onReload={load} />
      <div className="flex flex-wrap items-center gap-2 border-b border-[#edf0f3] px-5 py-3">
        {(['tool', 'doc'] as const).map((k) => (
          <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={cn('rounded-full border px-3 py-1.5 text-[12px] font-semibold', kind === k ? 'border-[#1f6fba] bg-[#1f6fba] text-white' : 'border-[#dbe3ec] text-[#55708b]')}>
            {k === 'tool' ? 'ツール' : '資料'}
          </button>
        ))}
        {stats && unused > 0 && <span className="ml-auto text-[12px] text-[#92400e]">直近3か月で一度も使われていない{kind === 'tool' ? 'ツール' : '資料'}：{unused}件</span>}
      </div>
      {!stats ? (
        <div className="flex items-center justify-center gap-2 p-16 text-[13px] text-[#718096]"><LoaderCircle size={18} className="animate-spin" />読み込み中…</div>
      ) : (
        <Table head={['名前', `今月（${stats.months[0]}）`, `先月（${stats.months[1]}）`, '直近3か月', '最後に使われた日時']} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r.id} className={cn('border-t border-[#edf0f3]', r.last3Months === 0 && 'bg-[#fffbf2]')}>
              <td className="px-5 py-3 font-semibold text-[#38536f]">{r.name}<span className="block text-[11px] font-normal text-[#8a99a9]">{r.sub}</span></td>
              <td className="px-5 py-3 text-[#38536f]">{r.thisMonth}</td>
              <td className="px-5 py-3 text-[#718296]">{r.lastMonth}</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 text-right font-bold text-[#1b304b]">{r.last3Months}</span>
                  <span className="h-2 rounded-full bg-[#1f6fba]" style={{ width: `${Math.min(120, (r.last3Months / Math.max(1, rows[0]?.last3Months ?? 1)) * 120)}px` }} />
                  {r.last3Months === 0 && <span className="rounded bg-[#fff5df] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">利用なし</span>}
                </div>
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-[#718296]">{fmt(r.lastAt)}</td>
            </tr>
          ))}
        </Table>
      )}
      <p className="px-5 py-4 text-[11px] text-[#8a99a9]">「開く」「資料を開く」「ダウンロード」が押された回数です（同じ人が何度押しても数えます）。</p>
    </>
  )
}

// ---------------------------------------------------------------------------
// アカウントの一括登録
// ---------------------------------------------------------------------------

/** 表計算ソフトからのコピー（タブ区切り）やカンマ区切りの行から、名前とメールアドレスを取り出す */
export function parseUserLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(/\t|,|，/).map((c) => c.trim()).filter(Boolean)
      const email = cells.find((c) => c.includes('@')) ?? ''
      const name = cells.filter((c) => c !== email).join(' ')
      return { email: email.toLowerCase(), name, valid: /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(email) }
    })
    .filter((row) => !/^(メール|mail|e-?mail)/i.test(row.email))
}

export function BulkImportModal({ data, onClose, mutate }: { data: AdminData; onClose: () => void; mutate: Mutate }) {
  const { run } = useAuth()
  const toast = useToast()
  const [text, setText] = useState('')
  const [roles, setRoles] = useState<string[]>(['member'])
  const [result, setResult] = useState<BulkAddResult | null>(null)
  const [saving, setSaving] = useState(false)
  const rows = parseUserLines(text)
  const existing = new Set((data.users ?? []).map((u) => u.email))
  const toAdd = rows.filter((r) => r.valid && !existing.has(r.email))

  const submit = async () => {
    setSaving(true)
    try {
      const res = await run((t) => api.bulkAddUsers(t, toAdd.map(({ email, name }) => ({ email, name })), roles))
      // 画面側で除外した行（不正・登録済み）も結果に含める
      const excluded = rows.filter((r) => !toAdd.includes(r)).map((r) => ({
        email: r.email || '(メールアドレスなし)',
        reason: r.valid ? 'すでに登録されています' : 'メールアドレスが正しくありません',
      }))
      setResult({ ...res, skipped: [...excluded, ...res.skipped] })
      await mutate(async () => {}, `${res.added.length}件のアカウントを登録しました`)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal wide title="アカウントの一括登録" onClose={onClose} footer={result ? <Button onClick={onClose}>閉じる</Button> : (
      <>
        <Button variant="secondary" onClick={onClose} disabled={saving}>キャンセル</Button>
        <Button onClick={submit} disabled={saving || !toAdd.length}>{saving ? '登録中…' : `${toAdd.length}件を登録`}</Button>
      </>
    )}>
      {result ? (
        <div className="text-[13px] leading-6">
          <p className="font-bold text-[#1c7a43]">{result.added.length}件を登録しました。</p>
          {result.skipped.length > 0 && (
            <>
              <p className="mt-3 font-bold text-[#92400e]">登録しなかった行（{result.skipped.length}件）</p>
              <ul className="mt-1 list-disc pl-5 text-[12px] text-[#55708b]">{result.skipped.map((s, i) => <li key={i}>{s.email}：{s.reason}</li>)}</ul>
            </>
          )}
        </div>
      ) : (
        <>
          <Field label="名前とメールアドレス" hint="スプレッドシートから「名前」「メールアドレス」の2列をコピーして貼り付けられます。カンマ区切りでも大丈夫です。1行に1人ずつ。">
            <TextArea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={'山田 太郎\tyamada@example.com\n佐藤 花子, sato@example.com'} />
          </Field>
          <Field group label="割り当てるロール">
            <RolePicker roles={data.roles} value={roles} onChange={setRoles} emptyLabel="ロールなし" />
          </Field>
          {rows.length > 0 && (
            <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[#edf0f3]">
              <table className="w-full text-left text-[12px]">
                <thead className="sticky top-0 bg-[#fafbfd] text-[#8998a8]"><tr><th className="px-3 py-2">名前</th><th className="px-3 py-2">メールアドレス</th><th className="px-3 py-2">判定</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#edf0f3]">
                      <td className="px-3 py-2">{r.name || <span className="text-[#9aa7b5]">（メールアドレスを使用）</span>}</td>
                      <td className="px-3 py-2">{r.email || '—'}</td>
                      <td className="px-3 py-2">
                        {!r.valid ? <span className="text-[#b42318]">メールアドレスが不正</span> : existing.has(r.email) ? <span className="text-[#92400e]">登録済み（スキップ）</span> : <span className="text-[#1c7a43]">登録する</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// バックアップ（設定画面の中に表示）
// ---------------------------------------------------------------------------

export function BackupPanel({ initial, uploadFolderUrl }: { initial?: BackupStatus; uploadFolderUrl?: string }) {
  const { run } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<BackupStatus | undefined>(initial)
  const [busy, setBusy] = useState(false)
  const act = async (fn: (t: string) => Promise<BackupStatus>, message: string, isBackup = false) => {
    setBusy(true)
    try {
      const s = await run(fn)
      setStatus(s)
      // バックアップ自体の失敗はエラーとして返らず、状態に記録されて返ってくる
      if (isBackup && s.lastError) toast(s.lastError, 'error')
      else toast(message)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-8 rounded-xl border border-[#edf0f3] p-4">
      <h3 className="flex items-center gap-2 text-[14px] font-bold"><DatabaseBackup size={16} className="text-[#4285b8]" />バックアップ</h3>
      <p className="mt-1 text-[12px] leading-5 text-[#8a99a9]">スプレッドシートのコピーをGoogle Driveの「FSIF Portal バックアップ」フォルダに保存します。新しいものから{status?.keep ?? 10}個を残し、古いものはゴミ箱に移します（30日間は復元できます）。</p>
      <div className="mt-3 text-[12px] leading-6 text-[#38536f]">
        <p>自動バックアップ：<b>{status?.enabled ? '毎週月曜 4時ごろ' : 'オフ'}</b></p>
        <p>最後のバックアップ：{status?.lastAt ? <>{fmt(status.lastAt)}{status.lastUrl && <a href={status.lastUrl} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-[#1e6db8] hover:underline">開く<ExternalLink size={12} /></a>}</> : 'まだありません'}</p>
        {status?.lastError && <p className="text-[#b42318]">前回のエラー：{status.lastError}</p>}
        {status?.folderUrl && <a href={status.folderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1e6db8] hover:underline">バックアップのフォルダを開く<ExternalLink size={12} /></a>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => act((t) => api.backupNow(t), 'バックアップを作成しました', true)}>今すぐバックアップ</Button>
        <Button variant="secondary" disabled={busy} onClick={() => act((t) => api.setBackupSchedule(t, !status?.enabled), status?.enabled ? '自動バックアップをオフにしました' : '自動バックアップをオンにしました')}>
          {status?.enabled ? '自動バックアップをオフにする' : '毎週の自動バックアップをオンにする'}
        </Button>
      </div>
      {uploadFolderUrl && (
        <p className="mt-4 border-t border-[#edf0f3] pt-3 text-[12px] text-[#55708b]">
          画面からアップロードしたファイルの保存先：<a href={uploadFolderUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#1e6db8] hover:underline">FSIF Portal アップロード<ExternalLink size={12} /></a>
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drive へのアップロードボタン
// ---------------------------------------------------------------------------

const MAX_UPLOAD = 20 * 1024 * 1024

export function UploadButton({ purpose, onUploaded, label }: { purpose: 'document' | 'icon'; onUploaded: (r: UploadResult) => void; label: string }) {
  const { run } = useAuth()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const pick = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_UPLOAD) {
      toast('ファイルが大きすぎます（20MBまで）。大きなファイルはDriveに直接置いてリンクを貼ってください', 'error')
      return
    }
    if (purpose === 'icon' && !file.type.startsWith('image/')) {
      toast('アイコンには画像ファイルを選んでください', 'error')
      return
    }
    setBusy(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await run((t) => api.uploadFile(t, { name: file.name, mimeType: file.type || 'application/octet-stream', base64, purpose }))
      onUploaded(res)
      toast(res.warning || `「${file.name}」をDriveにアップロードしました`, res.warning ? 'error' : 'info')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <>
      <input ref={input} type="file" className="hidden" accept={purpose === 'icon' ? 'image/*' : undefined} onChange={(e) => void pick(e.target.files?.[0])} />
      <Button variant="secondary" type="button" disabled={busy || DEMO_MODE} title={DEMO_MODE ? 'デモモードではアップロードできません' : undefined} onClick={() => input.current?.click()}>
        {busy ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}{busy ? 'アップロード中…' : label}
      </Button>
    </>
  )
}


// ---------------------------------------------------------------------------
// お知らせの確認状況
// ---------------------------------------------------------------------------

export function AckStatusModal({ announcement, onClose }: { announcement: Announcement; onClose: () => void }) {
  const { run } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<AckStatus | null>(null)
  // 親が描画し直すたびに読み込み直さないよう、閉じる処理は ref で持つ
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    run((t) => api.announcementAcks(t, announcement.id)).then(setStatus).catch((e: Error) => {
      toast(e.message, 'error')
      closeRef.current()
    })
  }, [run, toast, announcement.id])
  const total = status ? status.acked.length + status.pending.length : 0
  return (
    <Modal wide title={`確認状況：${announcement.title}`} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>閉じる</Button>}>
      {!status ? (
        <div className="flex items-center justify-center gap-2 p-10 text-[13px] text-[#718096]"><LoaderCircle size={18} className="animate-spin" />読み込み中…</div>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-[13px] font-bold text-[#1b304b]">{status.acked.length} / {total}人が確認済み</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef1f5]"><div className="h-full rounded-full bg-[#1c7a43]" style={{ width: `${total ? (status.acked.length / total) * 100 : 0}%` }} /></div>
            <p className="mt-1 text-[11px] text-[#8a99a9]">対象：このお知らせを見られる有効なアカウント</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[12px] font-bold text-[#b42318]">未確認（{status.pending.length}人）</p>
              <ul className="flex flex-col gap-1 text-[12px]">
                {status.pending.map((u) => <li key={u.email} className="flex items-center gap-2"><Circle size={12} className="shrink-0 text-[#c2ccd6]" /><span className="font-semibold">{u.name}</span><span className="truncate text-[#8a99a9]">{u.email}</span></li>)}
                {!status.pending.length && <li className="text-[#8a99a9]">全員が確認しました</li>}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-[12px] font-bold text-[#1c7a43]">確認済み（{status.acked.length}人）</p>
              <ul className="flex flex-col gap-1 text-[12px]">
                {status.acked.map((u) => <li key={u.email} className="flex items-center gap-2"><CheckCircle2 size={12} className="shrink-0 text-[#1c7a43]" /><span className="font-semibold">{u.name}</span><span className="text-[#8a99a9]">{fmt(u.ackAt)}</span></li>)}
                {!status.acked.length && <li className="text-[#8a99a9]">まだいません</li>}
              </ul>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// エラー通知メール（設定画面の中に表示）
// ---------------------------------------------------------------------------

export function ErrorDigestPanel({ initial }: { initial?: ErrorDigestStatus }) {
  const { run } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<ErrorDigestStatus | undefined>(initial)
  const [busy, setBusy] = useState(false)
  const toggle = async () => {
    setBusy(true)
    try {
      const s = await run((t) => api.setErrorDigest(t, !status?.enabled))
      setStatus(s)
      toast(s.enabled ? 'エラー通知メールをオンにしました' : 'エラー通知メールをオフにしました')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="mt-8 rounded-xl border border-[#edf0f3] p-4">
      <h3 className="flex items-center gap-2 text-[14px] font-bold"><BellRing size={16} className="text-[#4285b8]" />エラー通知メール</h3>
      <p className="mt-1 text-[12px] leading-5 text-[#8a99a9]">毎朝8時ごろ、直近24時間に想定外のエラー（GASの不具合・Driveの共有失敗・バックアップ失敗など）があったときだけ、全権管理者（{status?.recipients ?? 0}人）にメールでまとめて知らせます。エラーがなければ送りません。</p>
      <div className="mt-3 text-[12px] leading-6 text-[#38536f]">
        <p>通知：<b>{status?.enabled ? '毎朝' : 'オフ'}</b>{status?.lastSentAt && <span className="ml-3 text-[#8a99a9]">最後に送った日時：{fmt(status.lastSentAt)}</span>}</p>
      </div>
      <Button variant="secondary" className="mt-3" disabled={busy} onClick={() => void toggle()}>{status?.enabled ? 'エラー通知をオフにする' : 'エラー通知をオンにする'}</Button>
    </div>
  )
}
