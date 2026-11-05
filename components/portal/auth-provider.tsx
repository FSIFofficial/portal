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
  signIn: (token: string) => Promise<void>
  signOut: () => void
  refresh: () => Promise<void>
  /** API呼び出しのラッパー。認証切れなら自動でログアウトする */
  run: <T>(fn: (token: string) => Promise<T>) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const TOKEN_KEY = 'fsif-portal-token'

function readStoredToken(): string {
  try {
    const token = window.sessionStorage.getItem(TOKEN_KEY) ?? ''
    if (!token) return ''
    if (!DEMO_MODE && tokenExpiry(token) < Date.now() + 60_000) return ''
    return token
  } catch {
    return ''
  }
}

function storeToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token)
    else window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // ストレージが使えない場合はページを開いている間だけ有効
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [token, setToken] = useState('')
  const [data, setData] = useState<BootstrapData | null>(null)
  const [error, setError] = useState('')
  const tokenRef = useRef('')

  const signOut = useCallback(() => {
    storeToken('')
    tokenRef.current = ''
    setToken('')
    setData(null)
    setStatus('signedOut')
    if (!DEMO_MODE) disableGoogleAutoSelect()
  }, [])

  const load = useCallback(async (next: string) => {
    try {
      const result = await api.bootstrap(next)
      tokenRef.current = next
      storeToken(next)
      setToken(next)
      setData(result)
      setError('')
      setStatus('signedIn')
    } catch (err) {
      storeToken('')
      tokenRef.current = ''
      setToken('')
      setData(null)
      setStatus('signedOut')
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    const stored = readStoredToken()
    if (stored) void load(stored)
    else setStatus('signedOut')
  }, [load])

  // IDトークンの期限が切れたらログイン画面に戻す
  useEffect(() => {
    if (DEMO_MODE || !token) return
    const ms = tokenExpiry(token) - Date.now()
    const timer = window.setTimeout(() => {
      setError('ログインの有効期限が切れました。再度ログインしてください')
      signOut()
    }, Math.max(ms, 0))
    return () => window.clearTimeout(timer)
  }, [token, signOut])

  const run = useCallback(async <T,>(fn: (token: string) => Promise<T>) => {
    try {
      return await fn(tokenRef.current)
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'UNAUTHENTICATED' || err.code === 'NOT_REGISTERED')) {
        setError(err.message)
        signOut()
      }
      throw err
    }
  }, [signOut])

  const refresh = useCallback(async () => {
    const result = await run((t) => api.bootstrap(t))
    setData(result)
  }, [run])

  const signIn = useCallback(async (next: string) => {
    setStatus('loading')
    await load(next)
  }, [load])

  const value = useMemo(
    () => ({ status, token, data, error, signIn, signOut, refresh, run }),
    [status, token, data, error, signIn, signOut, refresh, run],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
