import { Suspense } from 'react'
import { NewPostRoute } from '@/components/kouhou/routes'

export const metadata = { title: '新規投稿' }

export default function Page() {
  return (
    <Suspense>
      <NewPostRoute />
    </Suspense>
  )
}
