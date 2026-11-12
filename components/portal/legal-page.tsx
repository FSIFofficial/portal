import type { ReactNode } from 'react'
import { asset } from '@/lib/config'

// プライバシーポリシー・利用規約の共通の枠。ログインしていなくても読める静的なページ
// （Google の OAuth 同意画面に登録する URL なので、ログイン画面からもリンクする）。

export const LEGAL_LINKS = [
  { href: '/privacy/', label: 'プライバシーポリシー' },
  { href: '/terms/', label: '利用規約' },
] as const

export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: ReactNode; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f6f8fb] text-[#1b304b]">
      <header className="border-b border-[#e7ecf2] bg-white">
        <div className="mx-auto flex max-w-[860px] items-center gap-3 px-4 py-3.5">
          <a href={asset('/')} className="flex items-center gap-3">
            <img src={asset('/fsif-logo.png')} alt="" className="size-9 rounded-xl object-cover" />
            <span className="text-[16px] font-bold tracking-[-0.03em] text-[#132b4f]">FSIF Portal</span>
          </a>
        </div>
      </header>
      <article className="mx-auto max-w-[860px] px-4 py-8">
        <h1 className="text-[26px] font-bold tracking-[-0.03em]">{title}</h1>
        <p className="mt-2 text-[12px] text-[#5b6b7c]">{updated}</p>
        <div className="mt-6 rounded-2xl border border-[#e4e9f0] bg-white p-5 text-[14px] leading-7 text-[#334b67] sm:p-8">
          <div className="mb-6">{intro}</div>
          <div className="flex flex-col gap-7">{children}</div>
        </div>
        <LegalFooter />
      </article>
    </main>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 border-l-4 border-[var(--brand)] pl-3 text-[16px] font-bold text-[#1b304b]">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** ポータル内の「ヘルプ・問い合わせ」（ログインが必要） */
export const helpUrl = () => asset('/#/help')

export function LegalFooter({ className = 'mt-6' }: { className?: string }) {
  return (
    <nav aria-label="規約とポリシー" className={`flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-[#5b6b7c] ${className}`}>
      {LEGAL_LINKS.map((l) => (
        <a key={l.href} href={asset(l.href)} className="underline-offset-2 hover:text-[var(--brand-fg)] hover:underline">
          {l.label}
        </a>
      ))}
      <span>© 未来宇宙産業フォーラム（FSIF）</span>
    </nav>
  )
}
