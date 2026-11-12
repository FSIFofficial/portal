import type { Metadata, Viewport } from 'next'
import '../globals.css'
import '../dark.css'

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
  colorScheme: 'light dark',
  themeColor: '#ffffff',
}

const THEME_SCRIPT = `try{var m=localStorage.getItem('fsif-portal-theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark')}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        {/* 表示モード（ライト／ダーク／端末に合わせる）を、画面が描かれる前に反映してちらつきを防ぐ */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
