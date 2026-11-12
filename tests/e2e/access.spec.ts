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
