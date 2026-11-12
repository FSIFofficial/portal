import type { Metadata, Viewport } from 'next'
import { Toaster } from '@/components/ui/sonner'
import '../../access.css'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

// アクセス権限管理（/access/）。ポータルと同じサイト・同じログイン（ポータルのセッション）で動くが、
// 画面の部品と配色が違うので、ポータルとは別のルートレイアウトにしている（ページを移るときは再読み込みになる）。
export const metadata: Metadata = {
  title: 'アクセス権限管理 | FSIF Portal',
  description: 'FSIFのツールの利用可否とツール内の役割をまとめて管理する',
  robots: { index: false, follow: false },
  icons: {
    icon: `${basePath}/icon-192.png`,
    apple: `${basePath}/apple-touch-icon.png`,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f5f6f9',
}

export default function AccessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="bg-background">
      <body className="font-sans antialiased">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  )
}
