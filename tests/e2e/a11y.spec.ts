import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// アクセシビリティの点検（axe）。主な画面をライト・ダークの両方で調べ、
// 「重大（critical）」「深刻（serious）」な問題（色の差が足りない・ボタンや入力欄に名前がない など）がないことを確かめる。

const PAGES = [
  { name: 'ログイン', path: null },
  { name: 'ホーム', path: './#/' },
  { name: 'ツール', path: './#/tools' },
  { name: '資料館', path: './#/library' },
  { name: 'リンク集', path: './#/links' },
  { name: 'お知らせ一覧', path: './#/announcements' },
  { name: 'ヘルプ', path: './#/help' },
  { name: '検索', path: './#/search?q=サンプル' },
  { name: '管理：ツール', path: './#/admin/tools' },
  { name: '管理：設定', path: './#/admin/settings' },
  { name: '管理：変更履歴', path: './#/admin/logs' },
  { name: '管理：バージョン確認', path: './#/admin/system' },
]

async function scan(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return result.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => `${v.id}（${v.impact}）: ${v.help}\n    ${v.nodes.slice(0, 5).map((n) => n.target.join(' ')).join('\n    ')}`)
}

for (const theme of ['light', 'dark'] as const) {
  test(`アクセシビリティ（${theme === 'light' ? 'ライト' : 'ダーク'}）`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.addInitScript((t) => window.localStorage.setItem('fsif-portal-theme', t), theme)
    await page.goto('./')
    await expect(page.getByRole('heading', { name: 'FSIF Portal' })).toBeVisible()
    const problems: string[] = []
    for (const p of PAGES) {
      if (p.path) {
        if (p.path !== PAGES[1].path || !(await page.locator('header').count())) {
          // 最初の画面に移るときだけログインする
          if (!(await page.locator('header').count())) {
            await page.getByRole('button', { name: /管理 太郎/ }).click()
            await expect(page.locator('header')).toBeVisible()
          }
        }
        await page.goto(p.path)
        await page.waitForTimeout(400)
      }
      for (const v of await scan(page)) problems.push(`[${p.name}] ${v}`)
    }
    expect(problems, problems.join('\n')).toEqual([])
  })
}
