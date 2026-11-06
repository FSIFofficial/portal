// ダークモード用のCSSを自動で作る。
// 画面の部品で使っている色クラス（bg-[#xxxxxx] / text-[#xxxxxx] / border-[#xxxxxx] / bg-white など）を集め、
// html.dark のときに使う暗い配色の上書きを app/dark.css に書き出す。
// ビルド（pnpm build / pnpm dev）のたびに実行されるので、新しい色を使っても自動で対応する。
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCES = ['components', 'app']
const OUT = 'app/dark.css'

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : []
  })
}

// ---- 色の変換 ----------------------------------------------------------------
const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
const hsl = (h, s, l) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** 背景：明るい色は暗く（白いカードは背景より少し明るく）。暗い色や鮮やかな色はそのまま */
function darkBg(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  if (l < 0.35) return null // もともと暗い（ナビの帯など）
  if (s > 0.45 && l < 0.7) return null // 鮮やかな色（ボタン・バッジ）
  if (hex === 'ffffff') return hsl(220, 0.2, 0.13)
  return hsl(h, Math.min(s, 0.35) * 0.7, clamp(0.07 + (1 - l) * 0.9, 0.06, 0.3))
}
/** 文字：暗い色は明るく。鮮やかな色は色味を残して明るく */
function darkText(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  if (l > 0.7) return null // もともと明るい文字（暗い背景の上で使われている）
  if (s > 0.35) return hsl(h, Math.min(s, 0.75), Math.max(l, 0.7))
  return hsl(h, Math.min(s, 0.2), clamp(0.95 - l * 0.6, 0.66, 0.92))
}
/** 枠線：明るいグレーは暗いグレーに */
function darkBorder(hex) {
  const [h, s, l] = rgbToHsl(hexToRgb(hex))
  if (s > 0.45 && l < 0.7) return null
  return hsl(h, Math.min(s, 0.25), clamp(0.16 + (1 - l) * 0.6, 0.16, 0.35))
}

// ---- クラスの収集 -------------------------------------------------------------
const CLASS_RE = /(?:^|[\s"'`{])((?:[a-z-]+:)*)(bg|text|border|from|to)-(\[#([0-9a-fA-F]{6})\]|white)(\/\d+)?(?=[\s"'`}]|$)/g
const VARIANTS = {
  '': (sel) => sel,
  'hover:': (sel) => `${sel}:hover`,
  'focus:': (sel) => `${sel}:focus`,
  'disabled:': (sel) => `${sel}:disabled`,
  'placeholder:': (sel) => `${sel}::placeholder`,
  'group-hover:': (sel) => `.group:hover ${sel}`,
}
const esc = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)

const found = new Map()
for (const file of SOURCES.flatMap(walk)) {
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(CLASS_RE)) {
    const [, variant, kind, value, hex, alpha] = m
    if (!(variant in VARIANTS)) continue
    const cls = `${variant}${kind}-${value}${alpha ?? ''}`
    found.set(cls, { variant, kind, hex: (hex ?? 'ffffff').toLowerCase(), alpha: alpha ? Number(alpha.slice(1)) / 100 : null, white: value === 'white' })
  }
}

const withAlpha = (color, alpha) => (alpha == null ? color : color.replace(')', ` / ${alpha})`))
const rules = []
for (const [cls, c] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
  if (c.white && c.kind !== 'bg') continue // text-white などはそのまま
  const color = c.kind === 'text' ? darkText(c.hex) : c.kind === 'border' ? darkBorder(c.hex) : darkBg(c.hex)
  if (!color) continue
  const sel = `html.dark ${VARIANTS[c.variant](`.${esc(cls)}`)}`
  const value = withAlpha(color, c.alpha)
  const prop = { bg: 'background-color', text: 'color', border: 'border-color', from: '--tw-gradient-from', to: '--tw-gradient-to' }[c.kind]
  rules.push(`${sel} { ${prop}: ${value}; }`)
}

const css = `/* このファイルは scripts/gen-dark-css.mjs が自動で作ります。直接編集しないでください。 */
html.dark {
  color-scheme: dark;
  --brand-soft: color-mix(in srgb, var(--brand) 22%, hsl(220 20% 13%));
  --brand-fg: color-mix(in srgb, var(--brand) 45%, white);
}
html.dark body { background-color: hsl(220 18% 8%); color: hsl(220 15% 88%); }
/* サイトのアイコンは白い背景を前提に描かれていることが多いので、枠は白のままにする */
html.dark .site-icon.site-icon { background-color: #fff; border-color: hsl(220 15% 30%); }
${rules.join('\n')}
`
writeFileSync(OUT, css)
console.log(`gen-dark-css: ${rules.length} rules -> ${OUT}`)
