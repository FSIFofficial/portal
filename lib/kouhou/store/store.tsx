'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { AppState } from '@/lib/kouhou/domain/types'
import { adminEdit, type Result } from '@/lib/kouhou/domain/actions'
import { commandName, diffAdmin, isEmptyPatch } from '@/lib/kouhou/domain/commands'
import { createLiveSeed } from '@/lib/kouhou/mock/live-seed'
import { createSeed } from '@/lib/kouhou/mock/seed'
import { getUser } from '@/lib/kouhou/domain/rules'
import { LIVE_MODE, KouhouApiError, callKouhou, jstNow, type CommandResponse, type LoadResponse } from '@/lib/kouhou/live'

const STORAGE_KEY = 'fsif-pr-demo-v1'
const PERSIST_KEY = 'fsif-pr-demo-persist'

/**
 * 状態の置き場（モジュール内の外部ストア）。
 * - デモ：ブラウザ内のサンプルデータ。操作はその場で反映し、localStorage に保存する
 * - 本番：GAS から読み込む。操作は手元で試してから GAS に送り、GAS が返した状態に置き換える
 */
// 本番は読み込むまで空の状態（サンプルデータを一瞬でも見せない）
const seed = LIVE_MODE ? createLiveSeed([], '2000-01-01T00:00') : createSeed()
let current: AppState = seed
const listeners = new Set<() => void>()
let persist = !LIVE_MODE

function emit() {
  for (const l of listeners) l()
  if (persist && !LIVE_MODE && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
    } catch {
      // 容量超過時は保存せずに続行（このブラウザ内保存は任意機能）
    }
  }
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/* ---------- 本番：読み込み状態・送信中の数 ---------- */

export type LiveStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; gasVersion: string }
  | { kind: 'unregistered'; email: string; reason?: string }
  | { kind: 'suspended'; email: string }
  | { kind: 'error'; code: string; message: string }

let liveStatus: LiveStatus = { kind: 'loading' }
let pending = 0
const metaListeners = new Set<() => void>()
const emitMeta = () => metaListeners.forEach((l) => l())
let metaSnapshot: { status: LiveStatus; pending: number } = { status: liveStatus, pending }
function setMeta(patch: Partial<{ status: LiveStatus; pending: number }>) {
  if (patch.status) liveStatus = patch.status
  if (patch.pending !== undefined) pending = patch.pending
  metaSnapshot = { status: liveStatus, pending }
  emitMeta()
}

function adopt(state: AppState) {
  current = { ...state, live: true }
  emit()
}

export async function reloadLive(): Promise<void> {
  try {
    const r = await callKouhou<LoadResponse>('load')
    if (!r.registered) setMeta({ status: { kind: 'unregistered', email: r.email, reason: r.reason } })
    else if (r.suspended) setMeta({ status: { kind: 'suspended', email: r.email } })
    else {
      adopt(r.state)
      setMeta({ status: { kind: 'ready', gasVersion: r.gasVersion } })
    }
  } catch (e) {
    // 一度読めていれば、定期更新の失敗では画面を止めない
    if (liveStatus.kind === 'ready' && !(e instanceof KouhouApiError && e.code === 'UNAUTHENTICATED')) return
    setMeta({ status: { kind: 'error', code: e instanceof KouhouApiError ? e.code : 'INTERNAL', message: e instanceof Error ? e.message : String(e) } })
  }
}

/** 本番：GAS に操作を送る。前の操作の応答を待ってから順番に送る */
let queue: Promise<unknown> = Promise.resolve()
function send<T extends CommandResponse>(action: string, payload: Record<string, unknown>): Promise<Result> {
  const run = async (): Promise<Result> => {
    setMeta({ pending: pending + 1 })
    try {
      const r = await callKouhou<T>(action, payload)
      adopt(r.state)
      return r.result
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : '保存に失敗しました' }
    } finally {
      setMeta({ pending: pending - 1 })
    }
  }
  const p = queue.then(run, run)
  queue = p
  return p
}

/** 本番の管理者専用の操作（Xとの接続・Discordのチャンネル取得など） */
export function liveAdmin(action: 'connectX' | 'xStartAuth' | 'xFinishAuth' | 'disconnectX' | 'checkConnections' | 'setDiscordWebhook' | 'removeDiscordWebhook' | 'testNotify' | 'syncAccess', payload: Record<string, unknown> = {}) {
  return send(action, payload)
}

/* ---------- 操作 ---------- */

/**
 * 操作を実行する。結果は Promise で返る（本番はサーバーの応答を待つため）。
 * 本番でも先に手元で試し、入力ミスなどはサーバーに送らずにその場で返す。
 */
export function runAction<A extends unknown[]>(fn: (s: AppState, ...args: A) => Result, ...args: A): Promise<Result> {
  const draft = structuredClone(current)
  if (LIVE_MODE) draft.now = jstNow()
  const r = fn(draft, ...args)
  if (!LIVE_MODE) {
    current = draft
    emit()
    return Promise.resolve(r)
  }
  if (!r.ok) return Promise.resolve(r)
  if ((fn as unknown) === adminEdit) {
    // 管理者設定は、変わった項目だけをまとめて送る
    const patch = diffAdmin(current, draft)
    if (isEmptyPatch(patch)) return Promise.resolve(r)
    return send('command', { name: 'applyAdminPatch', args: [patch] }).then((res) => (res.ok ? { ...res, message: r.message } : res))
  }
  const name = commandName(fn)
  if (!name) return Promise.resolve({ ok: false, message: 'この操作は本番では使えません' })
  return send('command', { name, args })
}

/** デモ専用：状態を直接書き換える（本番では何もしない） */
export function mutate(fn: (s: AppState) => void) {
  if (LIVE_MODE) return
  const draft = structuredClone(current)
  fn(draft)
  current = draft
  emit()
}

export function resetDemo() {
  if (LIVE_MODE) return
  const keepUser = current.currentUserId
  current = createSeed()
  current.currentUserId = keepUser ?? 'u-a'
  emit()
}

export function setPersist(v: boolean) {
  if (LIVE_MODE) return
  persist = v
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PERSIST_KEY, v ? '1' : '0')
  if (!v) window.localStorage.removeItem(STORAGE_KEY)
  else emit()
}

const HydratedCtx = createContext<{ hydrated: boolean; persist: boolean; setPersist: (v: boolean) => void }>({
  hydrated: false,
  persist: true,
  setPersist: () => {},
})

/** 本番の定期更新（他の人の操作・送信結果を取り込む） */
const POLL_MS = 60_000

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [persistState, setPersistState] = useState(!LIVE_MODE)
  useEffect(() => {
    if (LIVE_MODE) {
      let stop = false
      reloadLive().then(() => !stop && setHydrated(true))
      const timer = window.setInterval(() => {
        if (document.visibilityState === 'visible' && pending === 0) void reloadLive()
      }, POLL_MS)
      const onVisible = () => document.visibilityState === 'visible' && pending === 0 && void reloadLive()
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        stop = true
        window.clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    const p = window.localStorage.getItem(PERSIST_KEY)
    persist = p !== '0'
    setPersistState(persist)
    if (persist) {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as AppState
          if (parsed && Array.isArray(parsed.posts)) {
            current = parsed
            for (const l of listeners) l()
          }
        } catch {
          window.localStorage.removeItem(STORAGE_KEY)
        }
      }
    }
    setHydrated(true)
  }, [])
  const value = useMemo(
    () => ({
      hydrated,
      persist: persistState,
      setPersist: (v: boolean) => {
        setPersist(v)
        setPersistState(v)
      },
    }),
    [hydrated, persistState],
  )
  return <HydratedCtx.Provider value={value}>{children}</HydratedCtx.Provider>
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => seed,
  )
}

const SERVER_META = { status: { kind: 'loading' } as LiveStatus, pending: 0 }

/** 本番の読み込み状態と、応答待ちの操作の数 */
export function useLiveMeta() {
  return useSyncExternalStore(
    (l) => {
      metaListeners.add(l)
      return () => metaListeners.delete(l)
    },
    () => metaSnapshot,
    () => SERVER_META,
  )
}

export function useStoreMeta() {
  return useContext(HydratedCtx)
}

export function useCurrentUser() {
  const s = useAppState()
  return getUser(s, s.currentUserId)
}

export function useAction() {
  return useCallback(runAction, [])
}
