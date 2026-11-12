import { Suspense } from 'react'
import { TemplateEditorRoute } from '@/components/kouhou/routes'

export const metadata = { title: '画像テンプレート編集' }

export default function Page() {
  return (
    <Suspense>
      <TemplateEditorRoute />
    </Suspense>
  )
}
