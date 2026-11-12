'use client'

import { useCurrentUser } from '@/lib/kouhou/store/store'
import { Notice } from '@/components/kouhou/kit/primitives'
import { AccountsSection, BrandsSection, DiscordSection, PostTypesSection } from '@/components/kouhou/admin/org-sections'
import { PermissionsSection, PromotionSection, UsersSection } from '@/components/kouhou/admin/people-sections'
import { EmergencySection, NotifySection } from '@/components/kouhou/admin/ops-sections'

const NAV = [
  ['brands', 'ブランド'],
  ['accounts', 'SNSアカウント'],
  ['discord', 'Discord'],
  ['users', '利用者'],
  ['permissions', '権限'],
  ['types', '投稿の種類'],
  ['promotion', '昇格検討'],
  ['notify', 'Discord通知'],
  ['stop', '緊急停止'],
] as const

export function AdminScreen() {
  const user = useCurrentUser()
  const isAdmin = Boolean(user?.isAdmin)
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">管理者設定</h1>
        <p className="text-sm text-muted-foreground">変更はデモ環境の全画面にすぐ反映されます。</p>
      </header>
      {!isAdmin && <Notice tone="warning">管理者ではないため閲覧のみです。右上のデモ操作から「管理者A」に切り替えると変更できます。</Notice>}
      <nav aria-label="設定セクション" className="flex gap-1.5 overflow-x-auto pb-1">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted">
            {label}
          </a>
        ))}
      </nav>
      <fieldset disabled={!isAdmin} className="flex min-w-0 flex-col gap-4">
        <legend className="sr-only">管理者設定</legend>
        <BrandsSection />
        <AccountsSection />
        <DiscordSection />
        <UsersSection />
        <PermissionsSection />
        <PostTypesSection />
        <PromotionSection />
        <NotifySection />
      </fieldset>
      <EmergencySection isAdmin={isAdmin} />
    </div>
  )
}
