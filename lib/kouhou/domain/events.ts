/**
 * イベント（カレンダーに出る予定）の作成・編集・削除と、Discord のイベント（サーバーの「イベント」）への登録。
 * 「Discord のイベントにも登録」をオンにすると、保存のたびに次の定期処理で Discord に作成・更新し、削除すると Discord からも消す。
 */
import type { AppState, CalendarEvent, EventDiscord, JstDateTime } from './types'
import type { Result } from './actions'
import { getUser, canCreate } from './rules'
import { isBefore, isValidDateTime } from './time'
import { newId } from './actions'

export interface EventInput {
  id?: string
  title: string
  brandId: string
  at: JstDateTime
  endAt: JstDateTime | null
  description: string
  location: string
  discord: Omit<EventDiscord, 'externalId' | 'url' | 'sync'> | null
}

/** イベントを編集できるか（そのブランドのアカウントで投稿を作れる人） */
export function canEditEvent(s: AppState, userId: string | null, brandId: string) {
  const user = getUser(s, userId)
  if (!user || user.status !== 'active') return false
  return user.isAdmin || s.accounts.some((a) => a.brandId === brandId && canCreate(s, user, a.id).ok)
}

export const visibleEvents = (s: AppState) => s.events.filter((e) => !e.deleted)

function validate(s: AppState, input: EventInput): string | null {
  if (!input.title.trim()) return 'イベント名を入力してください'
  if (!s.brands.some((b) => b.id === input.brandId)) return 'ブランドを選んでください'
  if (!isValidDateTime(input.at)) return '開始日時を入力してください'
  if (input.endAt && !isValidDateTime(input.endAt)) return '終了日時の形式が正しくありません'
  if (input.endAt && !isBefore(input.at, input.endAt)) return '終了日時は開始日時より後にしてください'
  const d = input.discord
  if (!d) return null
  if (input.title.trim().length > 100) return 'Discord のイベント名は100文字までです'
  if (input.description.length > 1000) return 'Discord のイベントの説明は1000文字までです'
  if (!isBefore(s.now, input.at)) return 'Discord のイベントは、これからの日時にしてください'
  if (!s.servers.some((x) => x.id === d.serverId)) return 'Discord のサーバーを選んでください'
  if (d.place === 'external') {
    if (!input.location.trim()) return 'Discord のイベント（場所を指定）には、場所を入力してください'
    if (input.location.trim().length > 100) return '場所は100文字までです'
    if (!input.endAt) return 'Discord のイベント（場所を指定）には、終了日時が必要です'
  } else {
    const ch = s.channels.find((c) => c.id === d.channelId)
    if (!ch || ch.serverId !== d.serverId || (ch.kind !== 'voice' && ch.kind !== 'stage')) return 'ボイスまたはステージのチャンネルを選んでください'
  }
  if (d.imageAssetId) {
    const a = s.assets.find((x) => x.id === d.imageAssetId)
    if (!a || a.kind === 'text' || a.kind === 'video') return '表紙には画像の素材を選んでください'
  }
  return null
}

const discordChanged = (a: CalendarEvent, input: EventInput) =>
  JSON.stringify([a.title, a.at, a.endAt ?? null, a.description ?? '', a.location ?? '', a.discord ? { ...a.discord, externalId: undefined, url: undefined, sync: undefined } : null]) !==
  JSON.stringify([input.title.trim(), input.at, input.endAt, input.description, input.location.trim(), input.discord ? { ...input.discord, externalId: undefined, url: undefined, sync: undefined } : null])

export function saveEvent(s: AppState, input: EventInput): Result {
  if (!canEditEvent(s, s.currentUserId, input.brandId)) return { ok: false, message: 'このブランドのイベントを編集する権限がありません' }
  const err = validate(s, input)
  if (err) return { ok: false, message: err }
  const existing = input.id ? s.events.find((e) => e.id === input.id && !e.deleted) : undefined
  if (input.id && !existing) return { ok: false, message: 'イベントが見つかりません' }
  if (existing && existing.brandId !== input.brandId && !canEditEvent(s, s.currentUserId, existing.brandId)) return { ok: false, message: '元のブランドのイベントを編集する権限がありません' }
  const base = {
    title: input.title.trim(),
    brandId: input.brandId,
    at: input.at,
    endAt: input.endAt,
    description: input.description,
    location: input.location.trim(),
    updatedBy: s.currentUserId ?? undefined,
    updatedAt: s.now,
  }
  if (existing) {
    const changed = discordChanged(existing, input)
    const prev = existing.discord
    Object.assign(existing, base)
    if (input.discord) {
      // サーバーを変えたら、前のサーバーのイベントは作り直しになる（ID を引き継がない）
      const sameServer = prev && prev.serverId === input.discord.serverId
      existing.discord = {
        ...input.discord,
        externalId: sameServer ? prev?.externalId ?? null : null,
        url: sameServer ? prev?.url ?? null : null,
        sync: changed || !prev?.externalId ? { action: 'upsert', state: 'queued', at: s.now } : prev?.sync ?? null,
      }
      if (prev?.externalId && !sameServer) return { ok: false, message: 'Discord に登録済みのイベントは、サーバーを変えられません。いったん登録を外してから選び直してください' }
    } else if (prev?.externalId) {
      // 登録を外した：Discord のイベントを消す
      existing.discord = { ...prev, sync: { action: 'delete', state: 'queued', at: s.now } }
    } else {
      existing.discord = null
    }
    return { ok: true, message: existing.discord?.sync?.state === 'queued' ? demoNote(s, 'イベントを保存しました。Discord にも反映します（数分）') : 'イベントを保存しました', id: existing.id }
  }
  const id = newId(s, 'ev')
  s.events.push({ id, ...base, discord: input.discord ? { ...input.discord, externalId: null, url: null, sync: { action: 'upsert', state: 'queued', at: s.now } } : null })
  return { ok: true, message: input.discord ? demoNote(s, 'イベントを追加しました。Discord にも登録します（数分）') : 'イベントを追加しました', id }
}

export function deleteEvent(s: AppState, id: string): Result {
  const ev = s.events.find((e) => e.id === id && !e.deleted)
  if (!ev) return { ok: false, message: 'イベントが見つかりません' }
  if (!canEditEvent(s, s.currentUserId, ev.brandId)) return { ok: false, message: 'このブランドのイベントを編集する権限がありません' }
  if (ev.discord?.externalId) {
    ev.deleted = true
    ev.discord = { ...ev.discord, sync: { action: 'delete', state: 'queued', at: s.now } }
    return { ok: true, message: demoNote(s, 'イベントを削除しました。Discord のイベントも消します（数分）') }
  }
  s.events = s.events.filter((e) => e.id !== id)
  return { ok: true, message: 'イベントを削除しました' }
}

/** Discord への反映に失敗したイベントを、もう一度反映する */
export function retryEventSync(s: AppState, id: string): Result {
  const ev = s.events.find((e) => e.id === id)
  if (!ev?.discord?.sync || ev.discord.sync.state !== 'error') return { ok: false, message: 'やり直す反映はありません' }
  if (!canEditEvent(s, s.currentUserId, ev.brandId)) return { ok: false, message: 'このブランドのイベントを編集する権限がありません' }
  ev.discord.sync = { ...ev.discord.sync, state: 'queued', error: null, at: s.now }
  return { ok: true, message: 'もう一度反映します（数分）' }
}

/** 定期処理：Discord への反映。sync(ev) は作成・更新なら { ok, externalId, url }、削除なら { ok } を返す */
export type EventSyncResult = { ok: true; externalId?: string; url?: string } | { ok: false; error: string }

export function runEventSync(s: AppState, sync: (s: AppState, ev: CalendarEvent) => EventSyncResult, limit = 10): { done: number; failed: number } {
  let done = 0
  let failed = 0
  for (const ev of [...s.events]) {
    if (ev.discord?.sync?.state !== 'queued' || done + failed >= limit) continue
    const action = ev.discord.sync.action
    let r: EventSyncResult
    try {
      r = sync(s, ev)
    } catch (e) {
      r = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
    if (!r.ok) {
      ev.discord.sync = { ...ev.discord.sync, state: 'error', error: r.error }
      failed++
      continue
    }
    done++
    if (action === 'delete') {
      if (ev.deleted) s.events = s.events.filter((e) => e.id !== ev.id)
      else ev.discord = null
      continue
    }
    ev.discord.externalId = r.externalId ?? ev.discord.externalId ?? null
    ev.discord.url = r.url ?? ev.discord.url ?? null
    ev.discord.sync = null
  }
  return { done, failed }
}

const demoNote = (s: AppState, text: string) => (s.live ? text : `${text}（デモ：実際には登録しません）`)
