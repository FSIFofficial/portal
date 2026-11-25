import { expect, test } from '@playwright/test'

// 広報管理（/kouhou/）をデモモードで確認する。デモは「管理者A」でログイン済みの状態から始まる。

test('広報管理：各画面を開け、投稿詳細を直接開いても表示される', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('./kouhou/')
  await expect(page).toHaveURL(/\/kouhou\/calendar\/$/)
  await expect(page.getByRole('heading', { name: 'カレンダー' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'メイン' })
  for (const name of ['ダッシュボード', '投稿一覧', '承認待ち', 'イベント', '企画スペース', '繰り返し予約', '素材・テンプレート', '投稿分析', '管理者設定']) {
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

test('広報管理：投稿の種類は名前を変えられ、使われていなければ削除できる', async ({ page }) => {
  await page.goto('./kouhou/admin/')
  const types = page.locator('#types')
  // 使われている種類は削除できない（確認ダイアログを出さずに理由を表示する）
  await types.getByRole('listitem').filter({ has: page.getByLabel('イベント告知の名前') }).getByRole('button', { name: '削除' }).click()
  await expect(page.getByText(/「イベント告知」は投稿 \d+件.*で使われているため削除できません/)).toBeVisible()
  // 追加 → 名前を変更 → 削除
  await types.getByLabel('新しい投稿種類名').fill('テスト種類')
  await types.getByRole('button', { name: '追加' }).click()
  const input = types.getByLabel('テスト種類の名前')
  await input.fill('テスト種類2')
  await input.press('Enter')
  await expect(page.getByText('種類名を変更しました')).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await types.getByRole('listitem').filter({ has: page.getByLabel('テスト種類2の名前') }).getByRole('button', { name: '削除' }).click()
  await expect(page.getByText('「テスト種類2」を削除しました')).toBeVisible()
  await expect(types.getByLabel('テスト種類2の名前')).toHaveCount(0)
})

test('広報管理：ブランド・アカウント・チャンネルを削除でき、使われていれば止まる。チャンネルは折りたためる', async ({ page }) => {
  await page.goto('./kouhou/admin/')
  // ブランド：使われているものは削除できない／追加したものは削除できる
  await page.getByRole('button', { name: 'ブランド「FSIF」を削除' }).click()
  await expect(page.getByText(/「FSIF」はSNSアカウント \d+件.*で使われているため削除できません/)).toBeVisible()
  const brands = page.locator('#brands')
  await brands.getByPlaceholder('ブランド名').fill('テストブランド')
  await brands.getByPlaceholder('CODE').fill('TB')
  await brands.getByRole('button', { name: '追加' }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'ブランド「テストブランド」を削除' }).click()
  await expect(page.getByText('ブランド「テストブランド」を削除しました')).toBeVisible()

  // アカウント：投稿があるものは削除できない／投稿の無いものは削除できる
  await page.getByRole('button', { name: 'アカウント「FSIF公式X」を削除' }).click()
  await expect(page.getByText(/「FSIF公式X」は投稿 \d+件.*で使われているため削除できません/)).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'アカウント「FSIF Discord」を削除' }).click()
  await expect(page.getByText('アカウント「FSIF Discord」を削除しました')).toBeVisible()

  // チャンネル：最初は折りたたまれていて、開くと操作できる
  const discord = page.locator('#discord')
  const fsif = discord.locator('section').filter({ hasText: 'FSIF コミュニティ' })
  await expect(fsif.getByLabel('#イベントを投稿先にする')).toBeHidden()
  await fsif.getByText(/全2件・投稿可能/).click()
  page.once('dialog', (d) => d.accept())
  await fsif.getByRole('button', { name: '#イベントを削除' }).click()
  await expect(page.getByText('#イベント を削除しました')).toBeVisible()
  const cb = discord.locator('section').filter({ hasText: 'Cosmo Base コミュニティ' })
  await cb.getByText(/全\d+件・投稿可能/).click()
  await cb.getByRole('button', { name: '#広報管理通知を削除' }).click()
  await expect(page.getByText(/通知先チャンネルのため削除できません/)).toBeVisible()
})

test('広報管理：ホームページのニュース記事を作り、承認して公開できる', async ({ page }) => {
  await page.goto('./kouhou/posts/new/')
  await page.getByLabel(/FSIF ホームページ/).check()
  await page.getByLabel('管理用タイトル').fill('SBS 参加レポート')
  await page.getByLabel('URL用のID').fill('SBS 2026 Report!')
  await expect(page.getByLabel('URL用のID')).toHaveValue('sbs2026report')
  await page.getByLabel('URL用のID').fill('sbs2026-report')
  await page.getByLabel('記事のタイトル').fill('SBS2026に出展しました')
  await page.getByLabel('カテゴリ').selectOption('REPORT')
  await page.getByLabel('本文').fill('一段落目。\n\n## 展示の内容\nFSIFの活動を紹介しました。')
  // 本文の途中に画像を入れる（添付してから「本文に入れる」）
  await page.getByRole('button', { name: '素材を選ぶ' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /観測会の様子/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /1件を添付/ }).click()
  await page.getByRole('button', { name: '「観測会の様子」を本文に入れる' }).click()
  await expect(page.getByLabel('本文')).toHaveValue(/!\[観測会の様子\]\(as-photo-1\)/)
  await expect(page.locator('figure img[alt="観測会の様子"]').last()).toBeVisible()
  // プレビューに見出しとURLが出る
  await expect(page.getByRole('heading', { name: '展示の内容' })).toBeVisible()
  await expect(page.getByText('https://www.fsif.jp/news/sbs2026-report/').last()).toBeVisible()
  await page.getByLabel('予定日時（日本時間）').fill('2026-11-06T12:00')
  await page.getByRole('button', { name: '原稿を作成' }).first().click()
  await expect(page).toHaveURL(/posts\/detail\/\?id=FSIF-WEB-/)
  await page.getByRole('tab', { name: /承認/ }).click()
  await page.getByRole('button', { name: '内容を完了' }).click()
  await page.getByRole('button', { name: 'この日時を承認' }).click()
  await page.getByRole('button', { name: '予約を確定' }).click()
  await page.getByRole('button', { name: 'デモ操作' }).click()
  await page.getByRole('button', { name: /次の予約/ }).click()
  await page.keyboard.press('Escape')
  await page.reload()
  await expect(page.getByText('公開済み').first()).toBeVisible()

  // 公開後に直す：保存 → 内容を完了（自動承認）→ サイトの記事を修正する予定になる
  await page.getByRole('tab', { name: '原稿' }).click()
  await expect(page.getByText('公開中の記事です')).toBeVisible()
  await page.getByLabel('記事のタイトル').fill('SBS2026に出展しました（修正）')
  await page.getByRole('button', { name: /保存/ }).first().click()
  await page.getByRole('tab', { name: /承認/ }).click()
  await page.getByRole('button', { name: '内容を完了' }).click()
  await expect(page.getByText(/サイトの記事を修正します/)).toBeVisible()

  // 取り下げを申請できる
  await page.getByRole('button', { name: '記事の取り下げを申請' }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('内容に誤りがあるため')
  await page.getByRole('dialog').getByRole('button', { name: '取り下げを申請' }).click()
  await expect(page.getByText('取り下げを申請しました。承認されるとサイトから取り下げます')).toBeVisible()
  await expect(page.getByText('記事の取り下げ申請')).toBeVisible()
})

test('広報管理：イベントを追加・編集・削除でき、Discord のイベントにも登録できる', async ({ page }) => {
  await page.goto('./kouhou/events/')
  await expect(page.getByRole('heading', { level: 1, name: 'イベント' })).toBeVisible()
  // デモの「公開ミーティング」は Discord に登録済み
  await expect(page.getByRole('listitem', { name: 'Cosmo Base 公開ミーティング' }).getByText(/Discord：.*登録済み/)).toBeVisible()

  await page.getByRole('button', { name: 'イベントを追加' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('イベント名').fill('星空観察オンライン')
  await dialog.getByLabel('ブランド').selectOption({ label: 'Cosmo Base' })
  await dialog.getByLabel('開始').fill('2026-11-20T20:00')
  await dialog.getByRole('switch', { name: 'Discordのイベントにも登録' }).click()
  // 場所を指定するときは場所と終了日時が必要
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('場所を入力してください')).toBeVisible()
  await dialog.getByRole('radio', { name: 'ボイス・ステージ' }).click()
  await dialog.getByLabel('チャンネル').selectOption({ label: '🔊ラウンジ（ボイス）' })
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(dialog).toBeHidden()
  const row = page.getByRole('listitem', { name: '星空観察オンライン' })
  await expect(row.getByText('Discord：登録待ち')).toBeVisible()
  await expect(row.getByText(/ラウンジ/)).toBeVisible()

  // カレンダーにも出る
  await page.goto('./kouhou/calendar/')
  await expect(page.getByText('星空観察オンライン').first()).toBeVisible()
  await page.goto('./kouhou/events/')

  // 編集
  await row.getByRole('button', { name: '編集' }).click()
  await dialog.getByLabel('イベント名').fill('星空観察オンライン（拡大版）')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByRole('listitem', { name: '星空観察オンライン（拡大版）' })).toBeVisible()

  // 削除
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '星空観察オンライン（拡大版）を削除' }).click()
  await expect(page.getByRole('listitem', { name: '星空観察オンライン（拡大版）' })).toBeHidden()
})
