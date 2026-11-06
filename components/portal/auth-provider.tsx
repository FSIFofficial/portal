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
  markSeen: (id: string, updatedAt: string) => void
  markAllSeen: () => Promise<void>
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

// 表示の高速化：前回受け取ったデータをブラウザに残し、次に開いたときにまず表示する（裏で最新に入れ替える）。
// ログアウトすると消す。別のアカウントのデータを表示しないよう、セッションと組にして保存する
const DATA_CACHE_KEY = 'fsif-portal-data-cache'

function readDataCache(token: string): BootstrapData | null {
  try {
    const c = JSON.parse(window.localStorage.getItem(DATA_CACHE_KEY) ?? 'null') as { token: string; data: BootstrapData } | null
    return c && c.token === token ? c.data : null
  } catch {
    return null
  }
}

function writeDataCache(token: string, data: BootstrapData | null) {
  try {
    if (token && data) window.localStorage.setItem(DATA_CACHE_KEY, JSON.stringify({ token, data }))
    else window.localStorage.removeItem(DATA_CACHE_KEY)
  } catch {
    // 容量オーバーなどで保存できなくても、表示が少し遅くなるだけ
  }
}

// 開いたもの（NEWを消すため）。アカウントごとにこのブラウザへ保存する
const SEEN_KEY = 'fsif-portal-seen'

function readSeen(email: string): Record<string, string> {
  try {
    const all = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, Record<string, string>>
    return all[email] ?? {}
  } catch {
    return {}
  }
}

function writeSeen(email: string, seen: Record<string, string>) {
  try {
    const all = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, Record<string, string>>
    // 古い記録が増えすぎないよう、最新の300件だけ残す
    all[email] = Object.fromEntries(Object.entries(seen).slice(-300))
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(all))
  } catch {
    // 保存できなくても、次の日には自動で消える
  }
}

const withSeen = (d: BootstrapData): BootstrapData => ({ ...d, me: { ...d.me, seen: readSeen(d.me.email) } })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState(0)
  const [data, setData] = useState<BootstrapData | null>(null)
  const [error, setError] = useState('')
  const tokenRef = useRef('')

  const clear = useCallback(() => {
    storeSession(null)
    writeDataCache('', null)
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
    setData(withSeen(result))
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
    const cached = readDataCache(stored.token)
    if (cached) {
      // 前回のデータですぐに表示し、裏で最新を読み込む
      accept(stored, cached)
      api.bootstrap(stored.token)
        .then((result) => accept(stored, result))
        .catch((err) => {
          // ログイン切れ・未登録・無効化のときだけログイン画面へ。通信エラーなどは前回のデータのまま表示を続ける
          if (err instanceof ApiError && ['UNAUTHENTICATED', 'NOT_REGISTERED', 'FORBIDDEN'].includes(err.code)) fail(err)
        })
      return
    }
    api.bootstrap(stored.token).then((result) => accept(stored, result)).catch(fail)
  }, [accept, fail])

  // 最新のデータを受け取るたびに保存しておく（お気に入りの変更なども含む）
  useEffect(() => {
    if (token && data) writeDataCache(token, data)
  }, [token, data])

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
    setData(withSeen(result))
  }, [run])

  const patchData = useCallback((fn: (data: BootstrapData) => BootstrapData) => {
    setData((d) => (d ? fn(d) : d))
  }, [])

  /** 開いたものの NEW を消す */
  const markSeen = useCallback((id: string, updatedAt: string) => {
    setData((d) => {
      if (!d || d.me.seen?.[id] === updatedAt) return d
      const seen = { ...(d.me.seen ?? {}), [id]: updatedAt }
      writeSeen(d.me.email, seen)
      return { ...d, me: { ...d.me, seen } }
    })
  }, [])

  /** すべての NEW を消す（アカウントに記録するので、ほかの端末でも消える） */
  const markAllSeen = useCallback(async () => {
    const res = await run((t) => api.markAllSeen(t))
    setData((d) => (d ? { ...d, me: { ...d.me, newSince: res.newSince } } : d))
  }, [run])

  const value = useMemo(
    () => ({ status, token, data, error, signIn, signOut, refresh, patchData, markSeen, markAllSeen, run }),
    [status, token, data, error, signIn, signOut, refresh, patchData, markSeen, markAllSeen, run],
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
  const { run, data, markSeen } = useAuth()
  return useCallback((kind: 'tool' | 'doc' | 'link', id: string) => {
    void run((t) => api.track(t, kind, id)).catch(() => {})
    // 開いたので NEW を消す
    const list: { id: string; updatedAt: string }[] = kind === 'tool' ? data?.tools ?? [] : kind === 'doc' ? data?.documents ?? [] : data?.links ?? []
    const item = list.find((x) => x.id === id)
    if (item) markSeen(item.id, item.updatedAt)
  }, [run, data, markSeen])
}
