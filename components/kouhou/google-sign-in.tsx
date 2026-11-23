'use client'

// 広報管理の中で Google ログインし直す（ポータルに戻らなくてよいように）。
// ポータルと同じ Google のクライアントでログインし、ポータルの GAS からセッションを受け取って、
// ポータルと同じ場所（localStorage 'fsif-portal-session'）に保存する。ポータルもそのままログイン済みになる。

import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { ApiError, api } from '@/lib/api'
import { GOOGLE_CLIENT_ID } from '@/lib/config'
import { initGoogleIdentity, loadGoogleIdentity, promptGoogleOneTap, renderGoogleButton } from '@/lib/google'

const SESSION_KEY = 'fsif-portal-session'

export function GoogleSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('GoogleのクライアントIDが設定されていません')
      return
    }
    let cancelled = false
    loadGoogleIdentity()
      .then(() => {
        if (cancelled || !ref.current) return
        initGoogleIdentity(GOOGLE_CLIENT_ID, async (credential) => {
          setBusy(true)
          setError('')
          try {
            const r = await api.login(credential)
            if (!r.session) throw new Error('ログインできませんでした')
            const expiresAt = r.sessionExpiresAt ? Date.parse(r.sessionExpiresAt) : Date.now() + 3600_000
            window.localStorage.setItem(SESSION_KEY, JSON.stringify({ token: r.session, expiresAt }))
            onSignedIn()
          } catch (e) {
            setError(e instanceof ApiError || e instanceof Error ? e.message : 'ログインできませんでした')
          } finally {
            setBusy(false)
          }
        })
        renderGoogleButton(ref.current)
        promptGoogleOneTap()
      })
      .catch((e: Error) => setError(e.message))
    return () => {
      cancelled = true
    }
  }, [onSignedIn])

  return (
    <div className="flex flex-col items-center gap-2">
      {busy ? (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          ログインしています…
        </p>
      ) : (
        <div ref={ref} className="flex min-h-11 justify-center" />
      )}
      {error && (
        <p role="alert" className="max-w-xs text-center text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
