import type { Metadata, Viewport } from 'next'
import './globals.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  title: 'FSIF Portal',
  description: 'FSIF（未来宇宙産業フォーラム）メンバー向けポータル',
  robots: { index: false, follow: false },
  icons: {
    icon: `${basePath}/icon-192.png`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
  // ホーム画面に追加したときのアプリ情報（public/manifest.webmanifest）
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: 'FSIF Portal', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  )
}
