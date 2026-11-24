/**
 * ホームページのニュース（FSIF のサイト・Cosmo Base のサイト）。
 * 投稿先が「ホームページ」のアカウントでは、本文に加えて記事の情報（WebArticle）を持つ。
 * 公開のときに GAS が、FSIF はニュースのスプレッドシートに1行書き、Cosmo Base はリポジトリの data/news.csv に1行足す。
 *
 * 本文の書き方（両サイト共通）：
 *   空行で段落を分ける。「## 見出し」の行から新しいまとまり（見出し付き）になる。
 *   「![代替テキスト](素材ID)」だけの行は画像（添付した素材）。そのまとまりの最後に入り、次の行からは新しいまとまりになる
 *   （FSIF のシートは1つのまとまりに画像1枚の構造のため）。画像はエディタの「本文に入れる」ボタンで入れる
 *   Cosmo Base は HTML のタグもそのまま使える（改行は <br>、見出しは <h3> にする）
 */
import type { AppState, Site, WebArticle } from './types'

export interface SiteConfig {
  label: string
  /** カテゴリの選択肢（FSIF は決まった値だけ、Cosmo Base は自由入力もできる） */
  categories: string[]
  freeCategory: boolean
  /** 事業分野・タグ・重要なお知らせ・外部リンクなどの項目があるか（FSIF だけ） */
  extended: boolean
  articleUrl: (slug: string) => string
}

export const SITES: Record<Site, SiteConfig> = {
  fsif: {
    label: 'FSIF ホームページ',
    categories: ['PRESS RELEASE', 'NEWS', 'EVENT', 'PARTNERSHIP', 'MEDIA', 'REPORT', 'PROJECT'],
    freeCategory: false,
    extended: true,
    articleUrl: (slug) => `https://www.fsif.jp/news/${slug}/`,
  },
  cb: {
    label: 'Cosmo Base ホームページ',
    categories: ['お知らせ', 'イベントレポート', 'メンバー紹介', 'コラム', 'パートナー情報'],
    freeCategory: true,
    extended: false,
    articleUrl: (slug) => `https://cosmobase.fsif.jp/news/${slug}`,
  },
}

/** FSIF のシートの relatedArea・relatedTag に入れられる値（FSIF のサイトの仕様に合わせる） */
export const FSIF_AREAS = [
  { value: 'community', label: 'コミュニティ' },
  { value: 'working-group', label: 'ワーキンググループ' },
  { value: 'event', label: 'イベント' },
  { value: 'thinktank', label: 'シンクタンク' },
] as const

export const FSIF_TAGS = [
  { value: 'cosmobase', label: 'Cosmo Base' },
  { value: 'orbit', label: 'Orbit' },
] as const

export function emptyArticle(site: Site, title = ''): WebArticle {
  return {
    slug: '',
    title,
    category: SITES[site].categories[0],
    excerpt: '',
    lead: '',
    thumbnailAlt: '',
    relatedArea: null,
    relatedTag: null,
    featured: false,
    important: false,
    externalUrl: null,
    relatedLink: null,
    pdf: null,
  }
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/
const URL_RE = /^(https?:\/\/|\/)\S+$/

/** 記事の入力チェック。問題があれば理由を返す */
export function validateArticle(s: AppState, site: Site, a: WebArticle | null | undefined, selfPostId?: string): string | null {
  if (!a) return '記事の情報がありません'
  if (!SLUG_RE.test(a.slug)) return 'URL用のID（スラッグ）は、半角英小文字・数字・ハイフンで入力してください（例：sbs2026-report）'
  if (!a.title.trim()) return '記事のタイトルを入力してください'
  const cfg = SITES[site]
  if (!a.category.trim()) return 'カテゴリを選んでください'
  if (!cfg.freeCategory && !cfg.categories.includes(a.category)) return 'カテゴリを選び直してください'
  const dup = s.posts.find(
    (p) => p.id !== selfPostId && p.status !== 'cancelled' && p.article?.slug === a.slug && s.accounts.find((x) => x.id === p.accountId)?.site === site,
  )
  if (dup) return `URL用のID「${a.slug}」は別の記事（${dup.id}）で使われています`
  for (const [label, link] of [
    ['外部リンク', a.externalUrl],
    ['関連リンク', a.relatedLink],
    ['添付PDF', a.pdf],
  ] as const) {
    if (link && link.href && !URL_RE.test(link.href)) return `${label}のURLは https:// か / で始めてください`
  }
  return null
}

export interface BodySection {
  heading?: string
  paragraphs: string[]
  /** 画像（素材ID） */
  image?: string
  imageAlt?: string
}

const IMAGE_LINE = /^!\[([^\]]*)\]\(([\w-]+)\)$/

/** 本文に入れた画像の素材ID（出てくる順、重複なし） */
export function bodyImageIds(text: string): string[] {
  return [...new Set(parseBody(text).flatMap((s) => (s.image ? [s.image] : [])))]
}

/** 本文の画像が、添付した画像の素材かを確かめる */
export function checkBodyImages(s: AppState, text: string, assetIds: string[]): string | null {
  for (const id of bodyImageIds(text)) {
    const a = s.assets.find((x) => x.id === id)
    if (!a || !assetIds.includes(id)) return `本文の画像（${id}）が添付されていません。素材に添付してから「本文に入れる」で入れてください`
    if (a.kind === 'text' || a.kind === 'video') return `「${a.name}」は画像ではないため本文に入れられません`
  }
  return null
}

/** 本文に入れる1行 */
export const imageLine = (assetId: string, alt: string) => `![${alt.replace(/[\[\]\n]/g, ' ').trim()}](${assetId})`

/** 本文の文章を、見出し付きのまとまりに分ける */
export function parseBody(text: string): BodySection[] {
  const sections: BodySection[] = []
  let cur: BodySection = { paragraphs: [] }
  let para: string[] = []
  const flushPara = () => {
    if (para.length) cur.paragraphs.push(para.join('\n'))
    para = []
  }
  const flushSection = () => {
    flushPara()
    if (cur.heading || cur.paragraphs.length || cur.image) sections.push(cur)
  }
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    const h = /^##\s+(.+)$/.exec(line.trim())
    const img = IMAGE_LINE.exec(line.trim())
    if (img) {
      flushPara()
      cur.image = img[2]
      if (img[1].trim()) cur.imageAlt = img[1].trim()
      flushSection()
      cur = { paragraphs: [] }
    } else if (h) {
      flushSection()
      cur = { heading: h[1].trim(), paragraphs: [] }
    } else if (!line.trim()) {
      flushPara()
    } else {
      para.push(line)
    }
  }
  flushSection()
  return sections
}

/** 素材ID → サイトでの画像のパス（GAS がリポジトリに置いた場所） */
export type ImagePaths = Record<string, string>

/** FSIF のシートの body 列（JSON 文字列） */
export function fsifBodyJson(text: string, images: ImagePaths = {}): string {
  return JSON.stringify(
    parseBody(text).map((s) => ({
      ...(s.heading ? { heading: s.heading } : {}),
      paragraphs: s.paragraphs,
      ...(s.image && images[s.image] ? { image: images[s.image], imageAlt: s.imageAlt ?? '' } : {}),
    })),
  )
}

/** Cosmo Base の既存の記事と同じ見出しの見た目 */
const CB_H3 = "<h3 class='text-xl font-bold text-white mt-6 mb-2 border-l-4 border-[#83CBEB] pl-2'>"

/** Cosmo Base の data/news.csv の content 列（HTML。改行は <br>、見出しは既存の記事と同じ <h3>） */
export function cbContentHtml(text: string, images: ImagePaths = {}): string {
  const attr = (v: string) => v.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;')
  return parseBody(text)
    .map((s) =>
      [
        s.heading ? `${CB_H3}${s.heading}</h3>` : '',
        s.paragraphs.map((p) => p.replace(/\n/g, '<br>')).join('<br><br>'),
        s.image && images[s.image] ? `<img src='${attr(images[s.image])}' alt='${attr(s.imageAlt ?? '')}' class='w-full rounded-lg my-4'>` : '',
      ]
        .filter(Boolean)
        .join(''),
    )
    .join('<br><br>')
}

/** 公開したときのシート・CSV の1行（列名 → 値）。date は公開日（日本時間の YYYY-MM-DD） */
export function siteRow(site: Site, a: WebArticle, body: string, date: string, thumbnail: string, images: ImagePaths = {}): Record<string, string> {
  if (site === 'fsif') {
    return {
      slug: a.slug,
      date,
      category: a.category,
      title: a.title.trim(),
      excerpt: a.excerpt.trim(),
      thumbnail,
      thumbnailAlt: a.thumbnailAlt.trim(),
      relatedArea: a.relatedArea ?? '',
      relatedTag: a.relatedTag ?? '',
      featured: a.featured ? 'TRUE' : 'FALSE',
      important: a.important ? 'TRUE' : 'FALSE',
      lead: a.lead.trim(),
      body: fsifBodyJson(body, images),
      externalUrlLabel: a.externalUrl?.label ?? '',
      externalUrlHref: a.externalUrl?.href ?? '',
      relatedLinkLabel: a.relatedLink?.label ?? '',
      relatedLinkHref: a.relatedLink?.href ?? '',
      pdfLabel: a.pdf?.label ?? '',
      pdfHref: a.pdf?.href ?? '',
    }
  }
  return {
    id: a.slug,
    title: a.title.trim(),
    date,
    category: a.category.trim(),
    excerpt: a.excerpt.trim().replace(/\n/g, '<br>'),
    content: cbContentHtml(body, images),
    image: thumbnail,
    featured: a.featured ? 'true' : 'false',
  }
}

/** ホームページのアカウント（FSIF・Cosmo Base の2つ）。無ければ一度だけ足す（本番の既存データにも後から足せるように。消したら足し直さない） */
export const SITE_ACCOUNTS: { id: string; brandId: string; site: Site; name: string; code: string }[] = [
  { id: 'acc-fsif-web', brandId: 'b-fsif', site: 'fsif', name: 'FSIF ホームページ', code: 'fsif_web' },
  { id: 'acc-cb-web', brandId: 'b-cb', site: 'cb', name: 'Cosmo Base ホームページ', code: 'cb_web' },
]

export function ensureSiteAccounts(s: AppState): boolean {
  if (s.settings.sitesAdded) return false
  s.settings.sitesAdded = true
  let changed = true
  for (const def of SITE_ACCOUNTS) {
    if (s.accounts.some((a) => a.site === def.site)) continue
    if (!s.brands.some((b) => b.id === def.brandId)) continue
    s.accounts.push({
      id: def.id,
      brandId: def.brandId,
      platform: 'web',
      site: def.site,
      name: def.name,
      code: def.code,
      connection: s.live ? 'disconnected' : 'connected_mock',
      defaultApproverId: null,
    })
    // 権限は、同じブランドの X アカウントの権限をそのまま写す（無ければ管理者だけ）
    const base = s.accounts.find((a) => a.brandId === def.brandId && a.platform === 'x')
    for (const u of s.users) {
      const p = base && s.permissions.find((x) => x.userId === u.id && x.accountId === base.id)
      s.permissions.push(
        p
          ? { ...p, accountId: def.id }
          : { userId: u.id, accountId: def.id, view: u.isAdmin, create: u.isAdmin, edit: u.isAdmin, approve: u.isAdmin, levelOverride: null },
      )
    }
    changed = true
  }
  return changed
}
