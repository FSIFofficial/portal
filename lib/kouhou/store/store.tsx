'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { AppState } from '@/lib/kouhou/domain/types'
import type { Result } from '@/lib/kouhou/domain/actions'
import { createSeed } from '@/lib/kouhou/mock/seed'
import { getUser } from '@/lib/kouhou/domain/rules'

const STORAGE_KEY = 'fsif-pr-demo-v1'
const PERSIST_KEY = 'fsif-pr-demo-persist'

/** モックサービス：モジュール内の外部ストア。API接続時はここをデータ取得層へ差し替える */
const seed = createSeed()
let current: AppState = seed
const listeners = new Set<() => void>()
let persist = true

function emit() {
  for (const l of listeners) l()
  if (persist && typeof window !== 'undefined') {
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

export function runAction<A extends unknown[]>(fn: (s: AppState, ...args: A) => Result, ...args: A): Result {
  const draft = structuredClone(current)
  const r = fn(draft, ...args)
  current = draft
  emit()
  return r
}

export function mutate(fn: (s: AppState) => void) {
  const draft = structuredClone(current)
  fn(draft)
  current = draft
  emit()
}

export function resetDemo() {
  const keepUser = current.currentUserId
  current = createSeed()
  current.currentUserId = keepUser ?? 'u-a'
  emit()
}

export function setPersist(v: boolean) {
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

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [persistState, setPersistState] = useState(true)
  useEffect(() => {
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
