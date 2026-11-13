'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Ban, UserX } from 'lucide-react'
import { Button } from '@/components/kouhou/ui/button'
import { Notice, Segmented } from '@/components/kouhou/kit/primitives'
import { mutate, useAppState } from '@/lib/kouhou/store/store'
import { LIVE_MODE } from '@/lib/kouhou/live'
import { RedirectTo } from '@/components/kouhou/routes'

type Step = 'start' | 'choose' | 'unregistered' | 'suspended'

export function LoginScreen() {
  const s = useAppState()
  const router = useRouter()
  const [step, setStep] = useState<Step>('start')
  const [preview, setPreview] = useState<'normal' | 'unregistered' | 'suspended'>('normal')

  // 本番はポータルのログインを使うので、この画面は使わない
  if (LIVE_MODE) return <RedirectTo href="/kouhou/calendar" />

  const login = (id: string) => {
    mutate((d) => {
      d.currentUserId = id
    })
    router.replace('/kouhou/calendar')
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b bg-warning-soft px-3 py-1 text-center text-xs">
        <span className="font-bold text-warning">デモ</span> 本物のGoogle認証は行いません
      </div>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground" aria-hidden>
              PR
            </span>
            <div>
              <h1 className="text-lg font-bold">FSIF 広報管理</h1>
              <p className="text-xs text-muted-foreground">管理者から招待された利用者のみ利用できます</p>
            </div>
          </div>

          {step === 'start' && (
            <>
              <Button
                size="lg"
                className="h-11 w-full gap-2"
                onClick={() => setStep(preview === 'normal' ? 'choose' : preview)}
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-primary-foreground text-xs font-bold text-primary" aria-hidden>
                  G
                </span>
                Googleでログイン（デモ）
              </Button>
              <div className="flex flex-col gap-2 border-t pt-4">
                <p className="text-xs text-muted-foreground">画面状態の確認（デモ専用）</p>
                <Segmented
                  label="ログイン結果の再現"
                  size="sm"
                  value={preview}
                  onChange={setPreview}
                  items={[
                    { value: 'normal', label: '登録済み' },
                    { value: 'unregistered', label: '未登録' },
                    { value: 'suspended', label: '停止中' },
                  ]}
                />
              </div>
            </>
          )}

          {step === 'choose' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-bold">デモユーザーを選択</p>
              <ul className="flex flex-col gap-1.5">
                {s.users
                  .filter((u) => u.status === 'active')
                  .map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => login(u.id)}
                        className="flex min-h-12 w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm hover:border-primary hover:bg-accent"
                      >
                        <span>
                          <span className="block font-bold">{u.name}</span>
                          <span className="block text-xs text-muted-foreground">{u.email}</span>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {u.isAdmin ? '管理者・' : ''}Lv{u.level}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
              <Button variant="ghost" onClick={() => setStep('start')} className="gap-1 self-start">
                <ArrowLeft className="size-4" aria-hidden />
                戻る
              </Button>
            </div>
          )}

          {step === 'unregistered' && (
            <div className="flex flex-col gap-3">
              <Notice tone="warning" title="このGoogleアカウントは登録されていません">
                <p className="flex items-start gap-2">
                  <UserX className="mt-0.5 size-4 shrink-0" aria-hidden />
                  利用には管理者からの招待が必要です。広報担当の管理者に、利用するGoogleメールアドレスの登録を依頼してください。
                </p>
              </Notice>
              <Button variant="outline" onClick={() => setStep('start')}>
                ログイン画面に戻る
              </Button>
            </div>
          )}

          {step === 'suspended' && (
            <div className="flex flex-col gap-3">
              <Notice tone="danger" title="このアカウントは利用停止中です">
                <p className="flex items-start gap-2">
                  <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
                  管理者により利用が停止されています。再開が必要な場合は管理者へ連絡してください。
                </p>
              </Notice>
              <Button variant="outline" onClick={() => setStep('start')}>
                ログイン画面に戻る
              </Button>
            </div>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">メールアドレスとパスワードによるログインはありません。</p>
        </div>
      </main>
    </div>
  )
}
