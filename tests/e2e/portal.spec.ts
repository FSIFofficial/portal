import { expect, test, type Page } from '@playwright/test'

// デモモード（GAS未接続）で、主な画面と権限の動きを確認する。
// テストごとにブラウザの保存領域は空になるので、毎回サンプルデータから始まる。

async function login(page: Page, name: string) {
  await page.goto('./')
  await page.getByRole('button', { name: new RegExp(name) }).click()
  // スマホ幅ではサイドメニューが隠れるので、ユーザーメニューの表示で判定する
  await expect(page.locator('header button[aria-expanded]').last()).toBeVisible()
}

async function logout(page: Page) {
  await page.locator('header button[aria-expanded]').last().click()
  await page.getByRole('button', { name: /ログアウト/ }).click()
}

test('メンバーは限定公開と管理画面が見えず、契約担当には見える', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await expect(page.getByRole('heading', { name: 'よく使うツール' })).toBeVisible()
  await expect(page.getByRole('button', { name: '管理画面' })).toHaveCount(0)
  await page.goto('./#/library')
  await expect(page.getByText('契約担当向け資料（サンプル）')).toHaveCount(0)

  await logout(page)
  await login(page, '契約 美咲')
  await page.goto('./#/library')
  await expect(page.getByText('契約担当向け資料（サンプル）')).toBeVisible()
})

test('お気に入りに追加したツールがホームの先頭に来る', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await page.goto('./#/tools')
  await page.getByRole('button', { name: 'サンプルツールEをお気に入りに追加' }).click()
  await page.goto('./#/')
  await expect(page.locator('article h3').first()).toContainText('サンプルツールE')
})

test('確認が必要なお知らせは「確認しました」で消え、管理画面で確認状況が見える', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await page.getByRole('button', { name: '確認しました' }).click()
  await expect(page.getByRole('button', { name: '確認しました' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText('PORTAL MENU')).toBeVisible()
  await expect(page.getByRole('button', { name: '確認しました' })).toHaveCount(0)

  await logout(page)
  await login(page, '管理 太郎')
  await page.goto('./#/admin/announcements')
  await page.getByRole('button', { name: /1人が確認/ }).click()
  await expect(page.getByRole('dialog')).toContainText('メンバー 一郎')
})

test('ツールを削除するとゴミ箱に入り、元に戻せる', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await login(page, '管理 太郎')
  await page.goto('./#/admin/tools')
  await page.getByRole('button', { name: 'サンプルツールDを削除' }).click()
  await expect(page.getByText('ツールを削除しました')).toBeVisible()
  await page.goto('./#/admin/trash')
  await page.getByRole('button', { name: '元に戻す' }).click()
  await expect(page.getByText('「サンプルツールD」を元に戻しました')).toBeVisible()
  await page.goto('./#/tools')
  await expect(page.locator('article h3', { hasText: 'サンプルツールD' })).toBeVisible()
})

test('同じツールを2つの画面で同時に編集すると、後から保存した方が止まる', async ({ page, context }) => {
  // デモのデータはブラウザ内に保存されるため、同じブラウザの2つのタブで「2人」を再現する
  // （衝突の判定は誰が保存したかではなく、編集を始めた時点の更新日時で行う）
  await login(page, '管理 太郎')
  const other = await context.newPage()
  await other.goto('./#/admin/tools')

  await page.goto('./#/admin/tools')
  await page.getByRole('button', { name: 'サンプルツールBを編集' }).click()
  await other.getByRole('button', { name: 'サンプルツールBを編集' }).click()
  await other.getByRole('dialog').locator('input').first().fill('先に保存した変更')
  await other.getByRole('dialog').getByRole('button', { name: '保存' }).click()
  await expect(other.getByText('ツールを更新しました')).toBeVisible()

  await page.getByRole('dialog').locator('input').first().fill('後から保存した変更')
  await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
  await expect(page.getByText(/他の人が先に更新しました/)).toBeVisible()
  await page.goto('./#/tools')
  await expect(page.locator('article h3', { hasText: '先に保存した変更' })).toBeVisible()
})

test('ヘルプページに問い合わせ先とよくある質問が表示される', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await page.getByRole('button', { name: 'ヘルプ・問い合わせ' }).first().click()
  await expect(page.getByRole('heading', { name: 'よくある質問' })).toBeVisible()
  await expect(page.locator('a[href="mailto:portal-admin@example.com"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'このページを編集' })).toHaveCount(0)
})

test('ポータル名と色を変えると、ヘッダーとログイン画面に反映される', async ({ page }) => {
  await login(page, '管理 太郎')
  await page.goto('./#/admin/settings')
  const panel = page.locator('div.rounded-xl', { hasText: 'ポータル名・ロゴ・色' }).last()
  await panel.locator('input').first().fill('テストポータル')
  await panel.getByLabel('カラーコード').fill('#aa3300')
  await panel.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.locator('header')).toContainText('テストポータル')
  await logout(page)
  await expect(page.getByRole('heading', { name: 'テストポータル' })).toBeVisible()
})

test('リンク集：カテゴリごとに表示され、限定公開は対象の人だけに見え、管理画面で追加できる', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await page.goto('./#/links')
  await expect(page.getByRole('heading', { name: /公式/ })).toBeVisible()
  await expect(page.getByText('経費精算フォーム（サンプル）')).toBeVisible()
  await expect(page.getByText('契約書テンプレート置き場（サンプル）')).toHaveCount(0)
  await page.getByRole('button', { name: '広報', exact: true }).click()
  await expect(page.getByText('公式SNS（サンプル）')).toBeVisible()
  await expect(page.getByText('経費精算フォーム（サンプル）')).toHaveCount(0)

  await logout(page)
  await login(page, '掲載 花子')
  await page.goto('./#/admin/links')
  await page.getByRole('button', { name: '新規追加' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('例：経費精算フォーム').fill('新しいリンク')
  await dialog.getByPlaceholder('https://').fill('https://example.com/new')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('リンクを追加しました')).toBeVisible()
  await page.goto('./#/links')
  await expect(page.getByText('新しいリンク')).toBeVisible()
})

test('リンクのURLをコピーでき、☆を付けたリンクがホームに表示される', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await login(page, 'メンバー 一郎')
  await page.goto('./#/links')
  await page.getByRole('button', { name: '経費精算フォーム（サンプル）のリンクをコピー' }).click()
  await expect(page.getByText('リンクをコピーしました')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('https://example.com/form')
  await page.getByRole('button', { name: '公式SNS（サンプル）をお気に入りに追加' }).click()
  await page.goto('./#/')
  await expect(page.getByRole('heading', { name: 'お気に入りのリンク' })).toBeVisible()
})

test('お知らせ一覧で、掲載が終わったものも読み返せて「確認しました」も押せる', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await page.goto('./#/announcements')
  await expect(page.getByText('先月のお知らせ（掲載終了・サンプル）')).toBeVisible()
  await expect(page.getByText('掲載終了').first()).toBeVisible()
  await page.locator('article', { hasText: '利用規約を確認してください' }).getByRole('button', { name: '確認しました' }).click()
  await expect(page.locator('article', { hasText: '利用規約を確認してください' }).getByText('確認済み')).toBeVisible()
})

test('ダークモードを選ぶと再読み込みしても保たれ、ログアウトで前回のデータが消える', async ({ page }) => {
  await login(page, 'メンバー 一郎')
  await page.locator('header button[aria-expanded]').last().click()
  await page.getByRole('radio', { name: /ダーク/ }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  expect(await page.evaluate(() => !!localStorage.getItem('fsif-portal-data-cache'))).toBe(true)
  await logout(page)
  expect(await page.evaluate(() => localStorage.getItem('fsif-portal-data-cache'))).toBeNull()
})

test('スマホ幅でも横にはみ出さない', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await login(page, 'メンバー 一郎')
  for (const path of ['./#/', './#/tools', './#/library', './#/links', './#/announcements', './#/help']) {
    await page.goto(path)
    await expect(page.locator('header')).toBeVisible()
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  }
})
