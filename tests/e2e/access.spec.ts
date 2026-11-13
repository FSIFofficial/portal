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

test('アクセス権限管理：ポータルのロールを作り、メンバーに割り当て、一括追加できる', async ({ page }) => {
  await page.goto('./access/')
  // ロールを作る
  await page.getByRole('button', { name: 'ポータルのロール' }).click()
  await expect(page.getByLabel('ポータルのロール').getByText('全権管理者')).toBeVisible()
  await page.getByRole('button', { name: 'ロールを作成' }).click()
  await page.getByLabel('ロールID').fill('pr-team')
  await page.getByLabel('ロール名').fill('広報チーム')
  await page.getByLabel('お知らせの追加・編集').check()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('ロールを作成しました')).toBeVisible()
  await expect(page.getByLabel('ポータルのロール').getByRole('listitem').filter({ hasText: '広報チーム' })).toContainText('お知らせの追加・編集')

  // メンバーに割り当てる（メンバーの情報は変えず、ロールだけ）
  await page.getByRole('button', { name: 'メンバー', exact: true }).click()
  const row = page.getByRole('listitem').filter({ hasText: '森下 花音' })
  await expect(row).toContainText('メンバー')
  await row.getByRole('button', { name: '編集' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '広報チーム' }).click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(row).toContainText('広報チーム')
  await page.getByLabel('ポータルのロールで絞り込み').selectOption({ label: '広報チーム' })
  await expect(page.getByRole('listitem').filter({ hasText: '@' })).toHaveCount(1)
  await page.getByLabel('ポータルのロールで絞り込み').selectOption({ label: 'すべてのロール' })

  // 一括追加
  await page.getByRole('button', { name: '一括追加' }).click()
  await page.getByLabel('名前・メールアドレス').fill('一括 一郎\tikkatsu1@example.com\n一括 二郎, ikkatsu2@example.com\nkanon.morishita@example.com\nまちがい')
  await expect(page.getByRole('status')).toContainText('追加：2人')
  await expect(page.getByRole('status')).toContainText('登録済みのため飛ばす：1人')
  await page.getByRole('button', { name: '2人を追加' }).click()
  await expect(page.getByText('2人を追加しました')).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: '一括 二郎' })).toContainText('メンバー')
})

test('アクセス権限管理：親の部署のテンプレートは子の部署のメンバーにも付与される', async ({ page }) => {
  await page.goto('./access/')
  await page.getByRole('button', { name: '所属・自動付与' }).click()
  await page.getByRole('button', { name: '部署を追加' }).click()
  await page.getByLabel('部署名').fill('SNS班')
  await page.getByLabel('親の部署').selectOption({ label: '広報部' })
  await page.getByRole('button', { name: '保存する' }).click()
  // 子の部署の画面に、広報部のテンプレート（kodama 編集者など）が「引き継ぐもの」として出る
  const inherited = page.getByLabel('上の部署から引き継ぐテンプレート')
  await expect(inherited).toContainText('kodama：編集者')

  // 子の部署に所属させると、親のテンプレートどおりに付与される
  await page.getByRole('button', { name: 'メンバー', exact: true }).click()
  await page.getByRole('button', { name: 'メンバーを追加' }).click()
  await page.getByLabel('氏名', { exact: true }).fill('引継 太郎')
  await page.getByLabel('メールアドレス', { exact: true }).fill('hikitsugi@example.com')
  await page.getByRole('dialog').getByText('SNS班').click()
  await expect(page.getByRole('dialog')).toContainText('kodama：編集者 を付与（SNS班）')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByText('メンバーを追加しました')).toBeVisible()
  await page.getByRole('button', { name: '権限一覧' }).click()
  const row = page.getByRole('row').filter({ hasText: '引継 太郎' })
  await expect(row).toContainText('編集者')
})

test('アクセス権限管理：完全削除は申請者以外の承認がそろってから予約され、取り消しも実行もできる', async ({ page }) => {
  await page.goto('./access/')
  // 天野 湊 に全権管理者のロールを付ける（承認できる人を増やす）
  await page.getByRole('button', { name: 'メンバー', exact: true }).click()
  await page.getByLabel('メンバー一覧').getByRole('listitem').filter({ hasText: '天野 湊' }).getByRole('button', { name: '編集' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '全権管理者' }).click()
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(page.getByLabel('メンバー一覧').getByRole('listitem').filter({ hasText: '天野 湊' })).toContainText('全権管理者')

  // 退会済みの 水谷 遥 の完全削除を申請
  const target = page.getByLabel('メンバー一覧').getByRole('listitem').filter({ hasText: '水谷 遥' })
  await target.getByRole('button', { name: '完全削除を申請' }).click()
  await page.getByLabel('理由').fill('本人からの削除依頼')
  await page.getByRole('button', { name: '申請する' }).click()
  await expect(target).toContainText('完全削除の承認待ち（0/2）')
  // 自分の申請は承認できない。承認の人数を1人にする
  const panel = page.getByLabel('完全削除の申請')
  await expect(panel.getByRole('button', { name: '承認' })).toHaveCount(0)
  await page.getByRole('button', { name: '必要な承認：2人' }).click()
  await page.getByLabel('必要な承認の人数').selectOption('1')
  await expect(target).toContainText('完全削除の承認待ち（0/1）')

  // 天野 湊 に切り替えて承認 → 90日後に削除予約
  await page.getByRole('button', { name: 'デモユーザーを切り替える' }).click()
  await page.getByRole('menuitem', { name: /天野 湊/ }).click()
  await page.getByRole('button', { name: 'メンバー', exact: true }).click()
  await page.getByLabel('完全削除の申請').getByRole('button', { name: '承認' }).click()
  await expect(target).toContainText('以降に完全削除')

  // （デモ）期限にして実行 → メンバーから消え、変更履歴の名前も置き換わる
  await page.getByRole('button', { name: '（デモ）期限にして実行' }).click()
  await expect(page.getByText('完全削除しました（デモ）')).toBeVisible()
  await expect(target).toHaveCount(0)
  await page.getByRole('button', { name: '変更履歴' }).click()
  await expect(page.getByText('水谷 遥')).toHaveCount(0)
  await expect(page.getByText(/削除済みメンバー を退会に変更/)).toBeVisible()
})
