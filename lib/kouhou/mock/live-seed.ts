/**
 * 本番の最初の状態（GAS の setup で一度だけ作る）。
 * ブランド・投稿種類・背景テンプレート・ロゴ・文章テンプレートはデモと同じものを入れ、
 * SNSアカウント・投稿・企画などは空から始める。管理者は GAS のスクリプトプロパティ KOUHOU_ADMIN_EMAILS の人。
 */
import type { AppState, JstDateTime, User } from '../domain/types'
import { SEED_ASSETS, SEED_BRANDS, SEED_POST_TYPES } from './seed'

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
  return {
    now,
    currentUserId: null,
    brands: structuredClone(SEED_BRANDS),
    accounts: [],
    // ブランドごとに Discord サーバーの枠を用意（サーバーIDは管理者設定で入れる）
    servers: SEED_BRANDS.map((b) => ({ id: `srv-${b.id}`, brandId: b.id, name: `${b.name} Discord` })),
    channels: [],
    users,
    permissions: [],
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
