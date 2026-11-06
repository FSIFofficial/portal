'use client'

import { useState } from 'react'
import { Download, Eye, ExternalLink, FileText, FolderOpen, Pin } from 'lucide-react'
import { downloadLabel, downloadUrl, driveKindLabel, parseDriveUrl, previewUrl, thumbnailUrl, viewUrl } from '@/lib/drive'
import { isNew, type PortalDocument } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth, useTrack } from './auth-provider'
import { Button, Modal, NewBadge } from './ui'

export function DocThumb({ doc, className }: { doc: PortalDocument; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = thumbnailUrl(doc)
  const isFolder = parseDriveUrl(doc.driveUrl)?.kind === 'folder'
  if (!src || failed) {
    const Icon = isFolder ? FolderOpen : FileText
    return (
      <div className={cn('grid place-items-center bg-gradient-to-br from-[var(--brand-soft)] to-[#f5f8fc] text-[#7ca0bd]', className)}>
        <Icon size={32} strokeWidth={1.5} />
      </div>
    )
  }
  // Drive のサムネイルは Google にログインしていて閲覧権限があるときだけ表示される。失敗したらアイコンにする
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}

export function DocActions({ doc, compact }: { doc: PortalDocument; compact?: boolean }) {
  const track = useTrack()
  const [preview, setPreview] = useState(false)
  const open = viewUrl(doc)
  const dl = downloadUrl(doc)
  const embed = previewUrl(doc)
  const size = compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3 py-2 text-[12px]'
  return (
    <div className="flex flex-wrap gap-2">
      {embed && (
        <button onClick={() => { setPreview(true); track('doc', doc.id) }} className={cn('inline-flex items-center gap-1.5 rounded-lg border border-[#cfdeeb] bg-white font-bold text-[#285b82] hover:bg-[#f2f7fc]', size)}>
          <Eye size={12} />プレビュー
        </button>
      )}
      {preview && (
        <Modal xl title={doc.title} onClose={() => setPreview(false)} footer={
          <>
            {open && <a href={open} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#dbe4ec] bg-white px-3.5 py-2.5 text-[12px] font-bold text-[#55708b] hover:bg-[#f7f9fb]">新しいタブで開く<ExternalLink size={12} /></a>}
            <Button variant="secondary" onClick={() => setPreview(false)}>閉じる</Button>
          </>
        }>
          <div className="flex h-full flex-col">
            <iframe src={embed} title={doc.title} className="min-h-[60vh] w-full flex-1 rounded-lg border border-[#e4e9f0] bg-[#f6f8fb]" allow="autoplay" referrerPolicy="no-referrer-when-downgrade" />
            <p className="mt-2 text-[11px] text-[#8a99a9]">表示されないときは、ブラウザで閲覧権限のあるGoogleアカウントにログインしているか確認するか、「新しいタブで開く」を使ってください。</p>
          </div>
        </Modal>
      )}
      {open ? (
        <a href={open} target="_blank" rel="noopener noreferrer" onClick={() => track('doc', doc.id)} className={cn('inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] font-bold text-white hover:bg-[var(--brand-dark)]', size)}>
          資料を開く<ExternalLink size={12} />
        </a>
      ) : (
        <span className={cn('inline-flex items-center rounded-lg bg-[#eef1f5] font-bold text-[#6b7785]', size)}>リンク未設定</span>
      )}
      {dl && (
        <a href={dl} target="_blank" rel="noopener noreferrer" onClick={() => track('doc', doc.id)} className={cn('inline-flex items-center gap-1.5 rounded-lg border border-[#cfdeeb] bg-white font-bold text-[#285b82] hover:bg-[#f2f7fc]', size)}>
          <Download size={12} />{downloadLabel(doc)}
        </a>
      )}
    </div>
  )
}

export function DocCard({ doc, restricted }: { doc: PortalDocument; restricted?: boolean }) {
  const { data } = useAuth()
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[#e4e9f0] bg-white shadow-[0_2px_10px_rgba(25,50,80,0.03)] transition hover:border-[#bdd4e7] hover:shadow-md">
      <DocThumb doc={doc} className="h-36 w-full border-b border-[#eef1f4]" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          {doc.pinned && <Pin size={14} className="mt-0.5 shrink-0 text-[#c2410c]" aria-label="ピン留め" />}
          <h3 className="flex-1 text-[14px] font-bold leading-6 text-[#1b304b]">{doc.title}</h3>
          {isNew(doc, data?.me) && <span className="mt-1"><NewBadge /></span>}
        </div>
        <p className="mt-1 text-[11px] text-[#8593a2]">{doc.date} · {doc.type}{doc.tool && doc.tool !== '共通' ? ` · ${doc.tool}` : ''}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {restricted && <span className="rounded bg-[#fff5df] px-1.5 py-0.5 text-[10px] font-semibold text-[#92400e]">限定公開</span>}
          {doc.tags.map((tag) => <span key={tag} className="rounded border border-[#d5e3ef] px-1.5 py-0.5 text-[10px] text-[#55708b]">{tag}</span>)}
        </div>
        <p className="mt-2 line-clamp-3 text-[12px] leading-5 text-[#52677d]">{doc.description}</p>
        <div className="mt-auto pt-4">
          <DocActions doc={doc} compact />
          {doc.driveUrl && <p className="mt-2 text-[10px] text-[#a1acb8]">{driveKindLabel(doc.driveUrl)}</p>}
        </div>
      </div>
    </article>
  )
}
