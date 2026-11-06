'use client'

// ポータル名・キャッチコピー・ロゴ・メインカラー（管理画面 > 設定 で変更できる）
import { useEffect, useState } from 'react'
import { asset } from '@/lib/config'
import { imageUrl } from '@/lib/drive'
import { DEFAULT_BRANDING, type Branding } from '@/lib/types'
import { cn } from '@/lib/utils'

const CACHE_KEY = 'fsif-portal-branding'

/** ログイン前の画面でも同じ見た目にするため、最後に受け取った設定をブラウザに残しておく */
export function readCachedBranding(): Branding {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (raw) return { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<Branding>) }
  } catch {
    // 使えない環境では既定値
  }
  return DEFAULT_BRANDING
}

export function applyBranding(b: Branding) {
  if (/^#[0-9a-fA-F]{6}$/.test(b.primaryColor)) document.documentElement.style.setProperty('--brand', b.primaryColor)
  document.title = b.portalName || DEFAULT_BRANDING.portalName
}

export function useApplyBranding(branding: Branding | undefined) {
  useEffect(() => {
    const b = { ...DEFAULT_BRANDING, ...(branding ?? {}) }
    applyBranding(b)
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(b))
    } catch {
      // noop
    }
  }, [branding])
}

/** ログイン画面用：キャッシュ済みの設定を読み込んで適用する */
export function useCachedBranding() {
  const [b, setB] = useState<Branding>(DEFAULT_BRANDING)
  useEffect(() => {
    const cached = readCachedBranding()
    setB(cached)
    applyBranding(cached)
  }, [])
  return b
}

export function BrandLogo({ branding, className }: { branding: Branding; className?: string }) {
  const [failed, setFailed] = useState(false)
  const src = branding.logoUrl && !failed ? imageUrl(branding.logoUrl, 400) : asset('/fsif-logo.png')
  useEffect(() => setFailed(false), [branding.logoUrl])
  return <img src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}
