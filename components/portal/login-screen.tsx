'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ChevronRight, LoaderCircle, RotateCcw } from 'lucide-react'
import { demoUsers, resetDemoDb } from '@/lib/api'
import { DEMO_MODE, GOOGLE_CLIENT_ID, asset } from '@/lib/config'
import { initGoogleIdentity, loadGoogleIdentity, promptGoogleOneTap, renderGoogleButton } from '@/lib/google'
import type { User } from '@/lib/types'
import { useAuth } from './auth-provider'

export function LoginScreen() {
  const { signIn, error, status } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)
  const [gisError, setGisError] = useState('')
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    if (DEMO_MODE) {
      setUsers(demoUsers())
      return
    }
    if (!GOOGLE_CLIENT_ID) {
      setGisError('GoogleのクライアントID（NEXT_PUBLIC_GOOGLE_CLIENT_ID）が設定されていません')
      return
    }
    let cancelled = false
    loadGoogleIdentity()
      .then(() => {
        if (cancelled || !buttonRef.current) return
        initGoogleIdentity(GOOGLE_CLIENT_ID, (credential) => void signIn(credential))
        renderGoogleButton(buttonRef.current)
        if (!error) promptGoogleOneTap()
      })
      .catch((e: Error) => setGisError(e.message))
    return () => {
      cancelled = true
    }
  }, [signIn, error])

  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-4 py-10 text-[#1b304b]">
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-[#e4e9f0] bg-white p-8 shadow-[0_10px_40px_rgba(25,50,80,0.08)]">
          <img src={asset('/fsif-logo.png')} alt="FSIF 未来宇宙産業フォーラム" className="mx-auto size-24 rounded-2xl" />
          <h1 className="mt-6 text-center text-[22px] font-bold tracking-[-0.03em]">FSIF Portal</h1>
          <p className="mt-2 text-center text-[13px] leading-6 text-[#718096]">
            メンバー向けポータルです。<br />登録済みのGoogleアカウントでログインしてください。
          </p>

          {error && (
            <div role="alert" className="mt-6 flex gap-2 rounded-xl border border-[#f3d0cc] bg-[#fff5f4] p-3 text-[12px] leading-5 text-[#9b2c2c]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6">
            {status === 'loading' ? (
              <div className="flex items-center justify-center gap-2 py-3 text-[13px] text-[#718096]">
                <LoaderCircle size={18} className="animate-spin" />ログインしています…
              </div>
            ) : DEMO_MODE ? (
              <DemoLogin users={users} onPick={(email) => void signIn(email)} />
            ) : (
              <>
                <div ref={buttonRef} className="flex min-h-11 justify-center" />
                {gisError && <p className="mt-3 text-center text-[12px] text-[#b42318]">{gisError}</p>}
              </>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-[11px] text-[#9aa8b8]">アカウントの追加・権限の変更は全権管理者にお問い合わせください。</p>
      </div>
    </main>
  )
}

function DemoLogin({ users, onPick }: { users: User[]; onPick: (email: string) => void }) {
  return (
    <div>
      <div className="mb-3 rounded-xl bg-[#edf5fb] p-3 text-[12px] leading-5 text-[#285b82]">
        <b>デモモード</b>：バックエンド（GAS）が未接続のため、ブラウザ内のサンプルデータで動いています。ログインするユーザーを選んでください。
      </div>
      <div className="flex flex-col gap-2">
        {users.map((u) => (
          <button key={u.email} onClick={() => onPick(u.email)} className="flex items-center gap-3 rounded-xl border border-[#e1e7ee] px-3 py-2.5 text-left hover:border-[#9fbfdc] hover:bg-[#f7fafd]">
            <span className="grid size-8 place-items-center rounded-full bg-[#dcecf8] text-[12px] font-bold text-[#1e6db8]">{u.name.slice(0, 1)}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[#334b67]">{u.name}</span>
              <span className="block truncate text-[11px] text-[#8796a7]">{u.email} · {u.roles.join(', ')}</span>
            </span>
            <ChevronRight size={15} className="text-[#a9b5c2]" />
          </button>
        ))}
      </div>
      <button
        onClick={() => {
          resetDemoDb()
          window.location.reload()
        }}
        className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#7890a5] hover:text-[#1e6db8]"
      >
        <RotateCcw size={12} />デモデータを初期状態に戻す
      </button>
    </div>
  )
}
