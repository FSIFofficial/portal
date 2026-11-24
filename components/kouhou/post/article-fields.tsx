'use client'

// 投稿先が「ホームページ」のときの記事の入力欄（FSIF・Cosmo Base で項目が少し違う）

import type { Site, WebArticle, WebLink } from '@/lib/kouhou/domain/types'
import { FSIF_AREAS, FSIF_TAGS, SITES } from '@/lib/kouhou/domain/web'
import { Field, Input, Select, Switch, Textarea } from '@/components/kouhou/kit/primitives'

function LinkFields({ label, value, onChange, disabled, idPrefix }: { label: string; value: WebLink | null; onChange: (v: WebLink | null) => void; disabled?: boolean; idPrefix: string }) {
  const set = (patch: Partial<WebLink>) => {
    const next = { label: value?.label ?? '', href: value?.href ?? '', ...patch }
    onChange(next.label || next.href ? next : null)
  }
  return (
    <fieldset className="grid gap-2 sm:grid-cols-[1fr_2fr]">
      <legend className="mb-1 text-sm font-medium">{label}（任意）</legend>
      <Input aria-label={`${label}の表示名`} placeholder="表示名" value={value?.label ?? ''} onChange={(e) => set({ label: e.target.value })} disabled={disabled} id={`${idPrefix}-l`} />
      <Input aria-label={`${label}のURL`} placeholder="https://… または /…" value={value?.href ?? ''} onChange={(e) => set({ href: e.target.value })} disabled={disabled} className="font-mono" />
    </fieldset>
  )
}

export function ArticleFields({
  site,
  article,
  onChange,
  disabled,
  idPrefix,
}: {
  site: Site
  article: WebArticle
  onChange: (a: WebArticle) => void
  disabled?: boolean
  idPrefix: string
}) {
  const cfg = SITES[site]
  const set = (patch: Partial<WebArticle>) => onChange({ ...article, ...patch })
  const catList = `${idPrefix}-cats`
  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{cfg.label}のニュース記事として公開します。公開日は、実際に公開した日（日本時間）になります。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="URL用のID" htmlFor={`${idPrefix}-slug`} required hint={`半角英小文字・数字・ハイフン。公開後のURL：${cfg.articleUrl(article.slug || '…')}`}>
          <Input id={`${idPrefix}-slug`} value={article.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} disabled={disabled} className="font-mono" placeholder="sbs2026-report" />
        </Field>
        <Field label="カテゴリ" htmlFor={`${idPrefix}-cat`} required>
          {cfg.freeCategory ? (
            <>
              <Input id={`${idPrefix}-cat`} list={catList} value={article.category} onChange={(e) => set({ category: e.target.value })} disabled={disabled} />
              <datalist id={catList}>
                {cfg.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          ) : (
            <Select id={`${idPrefix}-cat`} value={article.category} onChange={(e) => set({ category: e.target.value })} disabled={disabled}>
              {cfg.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="記事のタイトル" htmlFor={`${idPrefix}-title`} required>
        <Input id={`${idPrefix}-title`} value={article.title} onChange={(e) => set({ title: e.target.value })} disabled={disabled} />
      </Field>
      <Field label="要約（一覧のカードに出る文）" htmlFor={`${idPrefix}-excerpt`}>
        <Textarea id={`${idPrefix}-excerpt`} rows={2} value={article.excerpt} onChange={(e) => set({ excerpt: e.target.value })} disabled={disabled} />
      </Field>
      {cfg.extended && (
        <Field label="リード文（記事の冒頭）" htmlFor={`${idPrefix}-lead`}>
          <Textarea id={`${idPrefix}-lead`} rows={2} value={article.lead} onChange={(e) => set({ lead: e.target.value })} disabled={disabled} />
        </Field>
      )}
      <Field label="サムネイルの代替テキスト" htmlFor={`${idPrefix}-alt`} hint="サムネイルは、下の「素材」で最初に添付した画像です">
        <Input id={`${idPrefix}-alt`} value={article.thumbnailAlt} onChange={(e) => set({ thumbnailAlt: e.target.value })} disabled={disabled} />
      </Field>
      {cfg.extended && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="関連する事業（任意）" htmlFor={`${idPrefix}-area`}>
            <Select id={`${idPrefix}-area`} value={article.relatedArea ?? ''} onChange={(e) => set({ relatedArea: (e.target.value || null) as WebArticle['relatedArea'] })} disabled={disabled}>
              <option value="">なし</option>
              {FSIF_AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="タグ（任意）" htmlFor={`${idPrefix}-tag`}>
            <Select id={`${idPrefix}-tag`} value={article.relatedTag ?? ''} onChange={(e) => set({ relatedTag: (e.target.value || null) as WebArticle['relatedTag'] })} disabled={disabled}>
              <option value="">なし</option>
              {FSIF_TAGS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      {cfg.extended && article.featured && (
        <p className="text-xs text-muted-foreground">「注目記事」は、ホームの最新ニュースで大きく出る1件です。ほかの記事が注目になっている場合は、シートでそちらの featured を外してください。</p>
      )}
      <div className="flex flex-wrap gap-6">
        <span className="flex items-center gap-2 text-sm">
          {cfg.extended ? '注目記事にする' : 'トップに大きく出す'}
          <Switch label={cfg.extended ? '注目記事にする' : 'トップに大きく出す'} checked={article.featured} onChange={(v) => set({ featured: v })} disabled={disabled} />
        </span>
        {cfg.extended && (
          <span className="flex items-center gap-2 text-sm">
            重要なお知らせに出す
            <Switch label="重要なお知らせに出す" checked={article.important} onChange={(v) => set({ important: v })} disabled={disabled} />
          </span>
        )}
      </div>
      {cfg.extended && (
        <div className="flex flex-col gap-3">
          <LinkFields label="外部リンク" value={article.externalUrl} onChange={(v) => set({ externalUrl: v })} disabled={disabled} idPrefix={`${idPrefix}-ext`} />
          <LinkFields label="サイト内の関連リンク" value={article.relatedLink} onChange={(v) => set({ relatedLink: v })} disabled={disabled} idPrefix={`${idPrefix}-rel`} />
          <LinkFields label="添付PDF" value={article.pdf} onChange={(v) => set({ pdf: v })} disabled={disabled} idPrefix={`${idPrefix}-pdf`} />
        </div>
      )}
    </div>
  )
}
