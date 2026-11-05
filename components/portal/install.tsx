'use client'

import { useEffect, useState } from 'react'
import { Download, MonitorSmartphone } from 'lucide-react'
import { Button, Modal } from './ui'

// Chrome / Edge / Android が出す「インストールできます」イベントを、ページを開いた直後から受け取っておく
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
  })
}

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function platform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export function InstallGuide({ onClose }: { onClose: () => void }) {
  const [canPrompt, setCanPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)
  const [os, setOs] = useState<'ios' | 'android' | 'desktop'>('desktop')

  useEffect(() => {
    setCanPrompt(!!deferred)
    setInstalled(isStandalone())
    setOs(platform())
  }, [])

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    const choice = await deferred.userChoice
    deferred = null
    setCanPrompt(false)
    if (choice.outcome === 'accepted') onClose()
  }

  const steps: Record<typeof os, { title: string; items: string[] }> = {
    ios: {
      title: 'iPhone・iPad（Safari）',
      items: ['画面下（iPadは上）の共有ボタン（四角から矢印が出ているアイコン）を押す', '「ホーム画面に追加」を選ぶ', '右上の「追加」を押す'],
    },
    android: {
      title: 'Android（Chrome）',
      items: ['右上の「︙」メニューを押す', '「ホーム画面に追加」または「アプリをインストール」を選ぶ', '「インストール」（または「追加」）を押す'],
    },
    desktop: {
      title: 'パソコン（Chrome・Edge）',
      items: ['アドレスバーの右端にある「インストール」アイコン（画面に下向き矢印）を押す', '見つからない場合は「︙」メニュー →「キャスト、保存、共有」→「ページをアプリとしてインストール」', '「インストール」を押す'],
    },
  }
  const guide = steps[os]

  return (
    <Modal title="ホーム画面に追加" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>閉じる</Button>}>
      <div className="flex gap-3 text-[13px] leading-6 text-[#38536f]">
        <MonitorSmartphone size={22} className="mt-0.5 shrink-0 text-[#4285b8]" />
        <p>ポータルをアプリのようにアイコンから開けるようになります。ログイン状態はそのまま引き継がれます。</p>
      </div>
      {installed ? (
        <p className="mt-4 rounded-xl bg-[#eaf7ef] p-3 text-[13px] font-semibold text-[#1c5c37]">すでにアプリとして開いています。</p>
      ) : canPrompt ? (
        <div className="mt-4">
          <Button onClick={() => void install()}><Download size={15} />今すぐ追加する</Button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-[#edf0f3] p-4">
          <p className="text-[13px] font-bold text-[#1b304b]">{guide.title}</p>
          <ol className="mt-2 list-decimal pl-5 text-[13px] leading-7 text-[#52677d]">
            {guide.items.map((s) => <li key={s}>{s}</li>)}
          </ol>
          {os === 'ios' && <p className="mt-2 text-[11px] text-[#8a99a9]">※ iPhoneでは Safari で開いているときだけ追加できます。</p>}
        </div>
      )}
    </Modal>
  )
}
