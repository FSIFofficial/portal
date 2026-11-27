/**
 * 素材の整理：名前・グループ（用途）・ブランド・種類の変更、まとめてグループ分け、削除。
 * グループやブランドを変えても、投稿の「素材を選ぶ」からはすべて選べる（絞り込みの初期値が変わるだけ）。
 */
import type { AppState, Asset, AssetKind } from './types'
import type { Result } from './actions'
import { canCreate, getUser } from './rules'
import { bodyImageIds } from './web'

/** そのブランドの素材を整理できるか（管理者か、そのブランドのアカウントで投稿を作れる人） */
export function canEditAssetsOf(s: AppState, userId: string | null, brandId: string) {
  const user = getUser(s, userId)
  if (!user || user.status !== 'active') return false
  return user.isAdmin || s.accounts.some((a) => a.brandId === brandId && canCreate(s, user, a.id).ok)
}

export interface AssetPatch {
  name?: string
  /** グループ（用途） */
  purpose?: string
  brandId?: string
  kind?: Extract<AssetKind, 'image' | 'logo' | 'background'>
}

/** グループ名の整え方（空ならその他） */
export const groupName = (v: string) => v.trim().replace(/\s+/g, ' ').slice(0, 40) || 'その他'

function applyPatch(s: AppState, a: Asset, patch: AssetPatch): string | null {
  if (!canEditAssetsOf(s, s.currentUserId, a.brandId)) return `「${a.name}」を変更する権限がありません`
  if (patch.name !== undefined && !patch.name.trim()) return '素材名を入力してください'
  if (patch.brandId !== undefined) {
    if (!s.brands.some((b) => b.id === patch.brandId)) return 'ブランドが見つかりません'
    if (!canEditAssetsOf(s, s.currentUserId, patch.brandId)) return '移動先のブランドの素材を整理する権限がありません'
  }
  if (patch.kind !== undefined) {
    if (a.kind === 'text' || a.kind === 'video' || a.edit) return `「${a.name}」は種類を変えられません`
    if (!['image', 'logo', 'background'].includes(patch.kind)) return '種類が正しくありません'
    if (a.kind === 'background' && patch.kind !== 'background' && s.assets.some((x) => x.edit?.backgroundAssetId === a.id)) return `「${a.name}」は文字入り画像の背景に使われているため、背景テンプレートから変えられません`
  }
  if (patch.name !== undefined) a.name = patch.name.trim().slice(0, 80)
  if (patch.purpose !== undefined) a.purpose = groupName(patch.purpose)
  if (patch.brandId !== undefined) a.brandId = patch.brandId
  if (patch.kind !== undefined) a.kind = patch.kind
  a.updatedBy = s.currentUserId ?? a.updatedBy
  a.updatedAt = s.now
  return null
}

export function updateAsset(s: AppState, id: string, patch: AssetPatch): Result {
  const a = s.assets.find((x) => x.id === id)
  if (!a) return { ok: false, message: '素材が見つかりません' }
  const err = applyPatch(s, a, patch)
  return err ? { ok: false, message: err } : { ok: true, message: '素材を更新しました' }
}

/** 選んだ素材をまとめて、同じグループ（・ブランド）に入れる */
export function groupAssets(s: AppState, ids: string[], patch: Pick<AssetPatch, 'purpose' | 'brandId'>): Result {
  if (!ids.length) return { ok: false, message: '素材を選んでください' }
  for (const id of ids) {
    const a = s.assets.find((x) => x.id === id)
    if (!a) return { ok: false, message: '素材が見つかりません' }
    const err = applyPatch(s, a, patch)
    if (err) return { ok: false, message: err }
  }
  const where = [patch.purpose !== undefined ? `グループ「${groupName(patch.purpose)}」` : '', patch.brandId ? s.brands.find((b) => b.id === patch.brandId)?.name ?? '' : ''].filter(Boolean).join('・')
  return { ok: true, message: `${ids.length}件を${where}に移しました` }
}

/** 素材が使われていれば、削除できない理由を返す */
export function assetInUse(s: AppState, id: string): string | null {
  const a = s.assets.find((x) => x.id === id)
  const posts = s.posts.filter((p) => p.status !== 'cancelled' && (p.assetIds.includes(id) || bodyImageIds(p.body).includes(id))).length
  const templates = s.assets.filter((x) => x.edit?.backgroundAssetId === id).length
  const events = s.events.filter((e) => !e.deleted && e.discord?.imageAssetId === id).length
  const parts = [posts && `投稿 ${posts}件`, templates && `文字入り画像 ${templates}件`, events && `イベント ${events}件`].filter(Boolean)
  return parts.length ? `「${a?.name ?? id}」は${parts.join('・')}で使われているため削除できません` : null
}

export function deleteAsset(s: AppState, id: string): Result {
  const a = s.assets.find((x) => x.id === id)
  if (!a) return { ok: false, message: '素材が見つかりません' }
  if (!canEditAssetsOf(s, s.currentUserId, a.brandId)) return { ok: false, message: 'この素材を削除する権限がありません' }
  const used = assetInUse(s, id)
  if (used) return { ok: false, message: used }
  s.assets = s.assets.filter((x) => x.id !== id)
  // 取り消した投稿などに残っている参照も外す
  for (const p of s.posts) if (p.assetIds.includes(id)) p.assetIds = p.assetIds.filter((x) => x !== id)
  for (const x of s.assets) if (x.sourceAssetId === id) x.sourceAssetId = null
  return { ok: true, message: `「${a.name}」を削除しました` }
}
