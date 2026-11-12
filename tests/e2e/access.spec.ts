import { expect, test } from '@playwright/test'

// アクセス権限管理（/access/）をデモモードで確認する。デモは代表「星野 葵」として開く。

test('アクセス権限管理：権限一覧が表示され、役割の定義・部署の追加ができる', async ({ page }) => {
  await page.goto('./access/')
  await expect(page.getByRole('heading', { name: '権限一覧' })).toBeVisible()
  await expect(page.getByText('デモ環境：実際のツール権限には反映されません').first()).toBeVisible()

  // ツールの役割を定義（付与で使われていない役割は追加できる）
  await page.getByRole('button', { name: 'ツール・同期' }).click()
  await page.getByRole('button', { name: '役割・連携を設定' }).nth(1).click()
  await page.getByRole('button', { name: '役割を追加' }).click()
  await page.getByLabel('4番目の役割キー').fill('owner')
  await page.getByLabel('4番目の表示名').fill('オーナー')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByLabel('kodama の内部役割')).toContainText('オーナー')

  // 付与で使われている役割は削除できない
  await page.getByRole('button', { name: '役割・連携を設定' }).nth(1).click()
  await page.getByRole('button', { name: 'この役割を削除' }).first().click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText(/使われているため削除できません/)).toBeVisible()
  await page.keyboard.press('Escape')

  // 部署の追加
  await page.getByRole('button', { name: '所属・自動付与' }).click()
  await page.getByRole('button', { name: '部署を追加' }).click()
  await page.getByLabel('部署名').fill('新規事業部')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByRole('heading', { name: '新規事業部' })).toBeVisible()
})

test('アクセス権限管理：一般メンバーには管理メニューが出ない', async ({ page }) => {
  await page.goto('./access/')
  await page.getByRole('button', { name: 'デモユーザーを切り替える' }).click()
  await page.getByRole('menuitem', { name: /森下 花音/ }).click()
  await expect(page.getByRole('heading', { name: /自分の権限/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '権限一覧' })).toHaveCount(0)
})

test('アクセス権限管理：部署を階層で登録でき、上の部署で絞り込むと配下のメンバーも出る', async ({ page }) => {
  await page.goto('./access/')
  await page.getByRole('button', { name: '所属・自動付与' }).click()
  await page.getByRole('button', { name: '部署を追加' }).click()
  await page.getByLabel('部署名').fill('SNS班')
  await page.getByLabel('親の部署').selectOption({ label: '広報部' })
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('広報部 / SNS班')).toBeVisible()

  // 親を自分の配下にはできない（選択肢に出ない）
  await page.getByRole('button', { name: /広報部/ }).first().click()
  await page.getByRole('button', { name: '編集' }).click()
  await expect(page.getByLabel('親の部署').locator('option', { hasText: 'SNS班' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // 配下の部署にメンバーを所属させ、上の部署で絞り込むと出る
  await page.getByRole('button', { name: 'メンバー', exact: true }).click()
  await page.getByRole('button', { name: 'メンバーを追加' }).click()
  await page.getByLabel('氏名', { exact: true }).fill('階層 太郎')
  await page.getByLabel('メールアドレス', { exact: true }).fill('kaisou@example.com')
  await page.getByRole('dialog').getByText('SNS班').click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('メンバーを追加しました')).toBeVisible()
  await page.getByRole('button', { name: '権限一覧' }).click()
  await page.getByLabel('所属').selectOption({ label: '広報部' })
  await expect(page.getByRole('table').getByText('階層 太郎')).toBeVisible()
})

test('アクセス権限管理：1人にメールアドレスを複数登録でき、他の人と重なると止まる', async ({ page }) => {
  await page.goto('./access/')
  await page.getByRole('button', { name: 'メンバー', exact: true }).click()
  await page.getByRole('listitem').filter({ hasText: '森下 花音' }).getByRole('button', { name: '編集' }).click()
  const alt = page.getByLabel('追加のメールアドレス（任意）')
  await alt.fill('aoi.hoshino@example.com')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText(/他のメンバーに登録されています/)).toBeVisible()
  await alt.fill('kanon.personal@example.org\nkanon.work@example.net')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('メンバー情報を保存しました')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: '森下 花音' })).toContainText('kanon.work@example.net')
  // 追加のアドレスでも検索できる
  await page.getByLabel('氏名・メールで検索').fill('kanon.personal')
  await expect(page.getByRole('listitem').filter({ hasText: '森下 花音' })).toBeVisible()
})

test('アクセス権限管理：代表を変更でき、団体垢は代表・事業部長の候補に出ない', async ({ page }) => {
  await page.goto('./access/')
  await page.getByRole('button', { name: '管理権限設定' }).click()
  // 団体垢にする
  await page.getByRole('button', { name: '追加' }).first().click()
  await page.getByLabel('アカウント').selectOption({ label: '森下 花音（kanon.morishita@example.com）' })
  await page.getByRole('button', { name: '団体垢にする' }).click()
  await expect(page.getByText('団体垢にしました')).toBeVisible()
  // 代表の後任候補に団体垢は出ない
  await page.getByRole('button', { name: '代表を譲渡' }).click()
  await expect(page.getByLabel('後任').locator('option', { hasText: '森下 花音' })).toHaveCount(0)
  await page.getByLabel('後任').selectOption({ label: '天野 湊' })
  await page.getByRole('button', { name: '影響を確認' }).click()
  await page.getByRole('button', { name: '譲渡する' }).click()
  await expect(page.getByText('役割を譲渡しました')).toBeVisible()
})
