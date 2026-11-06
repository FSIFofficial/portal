'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, api } from '@/lib/api'
import { DEMO_MODE } from '@/lib/config'
import { disableGoogleAutoSelect, tokenExpiry } from '@/lib/google'
import type { BootstrapData } from '@/lib/types'

type Status = 'loading' | 'signedOut' | 'signedIn'

interface AuthContextValue {
  status: Status
  token: string
  data: BootstrapData | null
  error: string
  /** Googleログインで得た IDトークン（デモではメールアドレス）でログインする */
  signIn: (credential: string) => Promise<void>
  signOut: () => void
  refresh: () => Promise<void>
  /** 画面上のデータだけを書き換える（お気に入りの即時反映など） */
  patchData: (fn: (data: BootstrapData) => BootstrapData) => void
  /** API呼び出しのラッパー。認証切れなら自動でログアウトする */
  run: <T>(fn: (token: string) => Promise<T>) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// セッションは localStorage に保存して、別のタブでもログインしたままにする
const SESSION_KEY = 'fsif-portal-session'

interface StoredSession {
  token: string
  expiresAt: number
}

function readSession(): StoredSession | null {
  try {
    const s = JSON.parse(window.localStorage.getItem(SESSION_KEY) ?? 'null') as StoredSession | null
    if (!s?.token || s.expiresAt < Date.now() + 60_000) return null
    return s
  } catch {
    return null
  }
}

function storeSession(s: StoredSession | null) {
  try {
    if (s) window.localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else window.localStorage.removeItem(SESSION_KEY)
    // 以前の版で使っていたキーを片付ける
    window.sessionStorage.removeItem('fsif-portal-token')
  } catch {
    // ストレージが使えない場合はページを開いている間だけ有効
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [data, setData] = useState<BootstrapData | null>(null)
  const [error, setError] = useState('')
  const tokenRef = useRef('')

  const clear = useCallback(() => {
    storeSession(null)
    tokenRef.current = ''
    setToken('')
    setExpiresAt(0)
    setData(null)
    setStatus('signedOut')
  }, [])

  const signOut = useCallback(() => {
    const current = tokenRef.current
    if (current && !DEMO_MODE) void api.logout(current).catch(() => {})
    clear()
    if (!DEMO_MODE) disableGoogleAutoSelect()
  }, [clear])

  const accept = useCallback((session: StoredSession, result: BootstrapData) => {
    tokenRef.current = session.token
    storeSession(session)
    setToken(session.token)
    setExpiresAt(session.expiresAt)
    setData(result)
    setError('')
    setStatus('signedIn')
  }, [])

  const fail = useCallback((err: unknown) => {
    clear()
    setError(err instanceof Error ? err.message : String(err))
  }, [clear])

  // 保存済みのセッションで再開する
  useEffect(() => {
    const stored = readSession()
    if (!stored) {
      setStatus('signedOut')
      return
    }
    api.bootstrap(stored.token).then((result) => accept(stored, result)).catch(fail)
  }, [accept, fail])

  // セッションの期限が切れたらログイン画面に戻す
  useEffect(() => {
    if (!token || !expiresAt) return
    const timer = window.setTimeout(() => {
      setError('ログインの有効期限が切れました。再度ログインしてください')
      clear()
    }, Math.min(Math.max(expiresAt - Date.now(), 0), 2_000_000_000))
    return () => window.clearTimeout(timer)
  }, [token, expiresAt, clear])

  const signIn = useCallback(async (credential: string) => {
    setStatus('loading')
    try {
      const result = await api.login(credential)
      const session = result.session ?? credential
      const exp = result.sessionExpiresAt ? Date.parse(result.sessionExpiresAt) : Date.now() + 3600_000
      accept({ token: session, expiresAt: exp }, result)
    } catch (err) {
      // 古いGAS（login に未対応）の場合は、IDトークンをそのまま使う以前の方式で続ける
      if (err instanceof ApiError && err.code === 'BAD_REQUEST' && !DEMO_MODE) {
        try {
          const result = await api.bootstrap(credential)
          accept({ token: credential, expiresAt: tokenExpiry(credential) || Date.now() + 3600_000 }, result)
          return
        } catch (legacyErr) {
          fail(legacyErr)
          return
        }
      }
      fail(err)
    }
  }, [accept, fail])

  const run = useCallback(async <T,>(fn: (token: string) => Promise<T>) => {
    try {
      return await fn(tokenRef.current)
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'UNAUTHENTICATED' || err.code === 'NOT_REGISTERED')) {
        setError(err.message)
        clear()
      }
      throw err
    }
  }, [clear])

  const refresh = useCallback(async () => {
    const result = await run((t) => api.bootstrap(t))
    setData(result)
  }, [run])

  const patchData = useCallback((fn: (data: BootstrapData) => BootstrapData) => {
    setData((d) => (d ? fn(d) : d))
  }, [])

  const value = useMemo(
    () => ({ status, token, data, error, signIn, signOut, refresh, patchData, run }),
    [status, token, data, error, signIn, signOut, refresh, patchData, run],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

/** 利用状況の記録（失敗しても画面には影響させない） */
export function useTrack() {
  const { run } = useAuth()
  return useCallback((kind: 'tool' | 'doc' | 'link', id: string) => {
    void run((t) => api.track(t, kind, id)).catch(() => {})
  }, [run])
}
