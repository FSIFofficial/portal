import type { Metadata, Viewport } from 'next'
import './globals.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const metadata: Metadata = {
  title: 'FSIF Portal',
  description: 'FSIF（未来宇宙産業フォーラム）メンバー向けポータル',
  robots: { index: false, follow: false },
  icons: {
    icon: `${basePath}/fsif-logo.png`,
    apple: `${basePath}/fsif-logo.png`,
  },
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
