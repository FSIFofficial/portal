import { Suspense } from 'react'
import { PostDetailRoute } from '@/components/kouhou/routes'

export const metadata = { title: '投稿詳細' }

export default function Page() {
  return (
    <Suspense>
      <PostDetailRoute />
    </Suspense>
  )
}
