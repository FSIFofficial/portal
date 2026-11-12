import { expect, test } from '@playwright/test'

// 広報管理（/kouhou/）をデモモードで確認する。デモは「管理者A」でログイン済みの状態から始まる。

test('広報管理：各画面を開け、投稿詳細を直接開いても表示される', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('./kouhou/')
  await expect(page).toHaveURL(/\/kouhou\/calendar\/$/)
  await expect(page.getByRole('heading', { name: 'カレンダー' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'メイン' })
  for (const name of ['ダッシュボード', '投稿一覧', '承認待ち', '企画スペース', '繰り返し予約', '素材・テンプレート', '投稿分析', '管理者設定']) {
    await nav.getByRole('link', { name }).click()
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
  }

  // 投稿詳細（/kouhou/posts/detail/?id=…）は再読み込みしても開ける
  await nav.getByRole('link', { name: '投稿一覧' }).click()
  const first = page.locator('a[href*="posts/detail"]:visible').first()
  await first.click()
  await expect(page).toHaveURL(/posts\/detail\/\?id=/)
  const title = (await page.getByRole('heading', { level: 1 }).innerText()).trim()
  expect(title.length).toBeGreaterThan(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)

  // 素材の画像がサブパス付きで読み込める
  await page.goto('./kouhou/assets/')
  await page.getByRole('tab', { name: /画像/ }).click()
  const img = page.locator('img[alt="観測会の様子"]')
  await expect(img).toBeVisible()
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)

  expect(errors).toEqual([])
})

test('広報管理：ログアウトするとデモのログイン画面になり、別のユーザーで入り直せる', async ({ page }) => {
  await page.goto('./kouhou/dashboard/')
  await page.getByRole('button', { name: /のメニュー$/ }).click()
  await page.getByRole('menuitem', { name: /ログアウト/ }).click()
  await expect(page.getByRole('heading', { name: 'FSIF 広報管理' })).toBeVisible()
  await page.getByRole('button', { name: /Googleでログイン/ }).click()
  await page.getByRole('button', { name: /Lv/ }).last().click()
  await expect(page.getByRole('heading', { name: 'カレンダー' })).toBeVisible()
})

test('広報管理：デモで基準日時を進めると、予約済みの投稿が公開される', async ({ page }) => {
  await page.goto('./kouhou/dashboard/')
  await page.getByRole('button', { name: 'デモ操作' }).click()
  await page.getByRole('button', { name: /次の予約/ }).click()
  await expect(page.getByText(/基準日時を .* に進めました（公開 [1-9]\d*件/)).toBeVisible()
})
