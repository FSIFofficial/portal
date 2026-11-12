import type { Metadata, Viewport } from 'next'
import { StoreProvider } from '@/lib/kouhou/store/store'
import { Toaster } from '@/components/kouhou/kit/toast'
import { PortalGate } from '@/components/kouhou/portal-gate'
import { LiveGate } from '@/components/kouhou/live-gate'
import '../../kouhou.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// 広報管理（/kouhou/）。X・Instagram・Discord の投稿を企画から分析まで管理する。
// ポータルと同じサイト・同じログインで動くが、画面の部品と配色が違うので別のルートレイアウトにしている。
export const metadata: Metadata = {
  title: { template: '%s | 広報管理 | FSIF Portal', default: '広報管理 | FSIF Portal' },
  description: 'X・Instagram・Discordの投稿を企画から分析まで一元管理する、FSIF内部向け広報管理ツール',
  robots: { index: false, follow: false },
  icons: {
    icon: `${basePath}/icon-192.png`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f4f6f9',
}

export default function KouhouLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="bg-background">
      <body className="antialiased">
        <PortalGate>
          <StoreProvider>
            <LiveGate>{children}</LiveGate>
            <Toaster />
          </StoreProvider>
        </PortalGate>
      </body>
    </html>
  )
}
