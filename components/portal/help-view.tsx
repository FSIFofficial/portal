'use client'

import { ChevronDown, ExternalLink, Mail, MessageCircleQuestion, Pencil } from 'lucide-react'
import { can, type BootstrapData } from '@/lib/types'
import type { Navigate } from './router'
import { EmptyState } from './ui'
import { LegalFooter } from './legal-page'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** 問い合わせ先の値を、メールならメール作成、URLならリンクとして表示する */
export function ContactValue({ value }: { value: string }) {
  if (EMAIL.test(value)) {
    return <a href={`mailto:${value}`} className="inline-flex items-center gap-1.5 font-semibold text-[var(--brand-fg)] hover:underline"><Mail size={14} />{value}</a>
  }
  if (/^https?:\/\//i.test(value)) {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 break-all font-semibold text-[var(--brand-fg)] hover:underline">{value}<ExternalLink size={13} /></a>
  }
  return <span className="font-semibold text-[#38536f]">{value}</span>
}

export function HelpView({ data, navigate }: { data: BootstrapData; navigate: Navigate }) {
  const help = data.help ?? { intro: '', contacts: [], faqs: [] }
  const canEdit = can(data.me, 'announcements.manage')
  const empty = !help.intro && !help.contacts.length && !help.faqs.length
  return (
    <div className="max-w-[860px]">
      {canEdit && (
        <div className="mb-5 flex justify-end">
          <button onClick={() => navigate('/admin/help')} className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4ec] bg-white px-3.5 py-2.5 text-[12px] font-bold text-[#55708b] hover:bg-[#f7f9fb]">
            <Pencil size={14} />このページを編集
          </button>
        </div>
      )}
      {empty ? (
        <EmptyState title="ヘルプはまだ準備中です" message="お急ぎの場合はポータルの管理者に直接お問い合わせください。" />
      ) : (
        <>
          {help.intro && <p className="mb-6 whitespace-pre-wrap rounded-2xl border border-[#e4e9f0] bg-white p-5 text-[14px] leading-7 text-[#38536f]">{help.intro}</p>}
          {help.contacts.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-[16px] font-bold">問い合わせ先</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {help.contacts.map((c, i) => (
                  <div key={i} className="rounded-2xl border border-[#e4e9f0] bg-white p-4">
                    <p className="text-[12px] font-bold text-[#5b6b7c]">{c.label}</p>
                    <div className="mt-1 text-[13px]"><ContactValue value={c.value} /></div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {help.faqs.length > 0 && (
            <section>
              <h2 className="mb-3 text-[16px] font-bold">よくある質問</h2>
              <div className="flex flex-col gap-2">
                {help.faqs.map((f, i) => (
                  <details key={i} className="group rounded-2xl border border-[#e4e9f0] bg-white">
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-[14px] font-bold text-[#1b304b]">
                      <MessageCircleQuestion size={18} className="shrink-0 text-[#4285b8]" />
                      <span className="flex-1">{f.q}</span>
                      <ChevronDown size={16} className="shrink-0 text-[#5b6b7c] transition group-open:rotate-180" />
                    </summary>
                    <p className="whitespace-pre-wrap border-t border-[#eef1f4] px-4 py-3 pl-[46px] text-[13px] leading-6 text-[#52677d]">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <LegalFooter className="mt-2 justify-start" />
    </div>
  )
}
