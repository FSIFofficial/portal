/**
 * 本番の最初の状態（GAS の setup で一度だけ作る）。
 * ブランド・投稿種類・背景テンプレート・ロゴ・文章テンプレートはデモと同じものを入れる。
 * SNSアカウントは X・Discord を FSIF と Cosmo Base の2つずつ用意し（未接続。管理者設定で接続する）、投稿・企画などは空から始める。管理者は GAS のスクリプトプロパティ KOUHOU_ADMIN_EMAILS の人。
 */
import type { Account, AppState, JstDateTime, User } from '../domain/types'
import { SEED_ACCOUNTS, SEED_ASSETS, SEED_BRANDS, SEED_POST_TYPES, SEED_SERVERS } from './seed'

export function createLiveSeed(admins: { email: string; name: string }[], now: JstDateTime): AppState {
  const users: User[] = admins.map((a, i) => ({
    id: `u-${i + 1}`,
    name: a.name || a.email.split('@')[0],
    email: a.email.trim().toLowerCase(),
    isAdmin: true,
    level: 3,
    status: 'active',
    publishSuccessCount: 0,
  }))
  // X・Discord を FSIF と Cosmo Base の2つずつ（Instagram は自動送信が未対応なので、必要になったら管理者設定で追加する）
  const accounts: Account[] = SEED_ACCOUNTS.filter((a) => a.platform !== 'instagram').map((a) => ({
    ...a,
    connection: 'disconnected' as const,
    defaultApproverId: null,
  }))
  return {
    now,
    currentUserId: null,
    brands: structuredClone(SEED_BRANDS),
    accounts,
    // FSIF・Cosmo Base の Discord サーバー（サーバーIDは管理者設定で入れる）
    servers: structuredClone(SEED_SERVERS),
    channels: [],
    users,
    // 最初の管理者は全アカウントのすべての操作ができる
    permissions: users.flatMap((u) => accounts.map((a) => ({ userId: u.id, accountId: a.id, view: true, create: true, edit: true, approve: true, levelOverride: null }))),
    postTypes: structuredClone(SEED_POST_TYPES),
    posts: [],
    comments: [],
    history: [],
    plans: [],
    events: [],
    // 背景テンプレート・ロゴ・文章テンプレートだけ入れる（写真・動画・作例のサンプルは入れない）
    assets: structuredClone(SEED_ASSETS.filter((a) => a.kind === 'background' || a.kind === 'logo' || a.kind === 'text')).map((a) => ({
      ...a,
      updatedBy: users[0]?.id ?? 'system',
      updatedAt: now,
    })),
    recurrences: [],
    stops: [],
    notifications: [],
    settings: { notifyChannelId: '', notifyMentions: [], promotionThreshold: 20 },
    demo: { conflictOnNextSave: false, failNextDelivery: false },
    seq: 100,
    live: true,
  }
}
