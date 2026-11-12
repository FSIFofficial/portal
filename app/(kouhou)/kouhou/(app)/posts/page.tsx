import { Suspense } from 'react'
import { PostsScreen } from '@/components/kouhou/screens/posts-screen'

export const metadata = { title: '投稿一覧' }

export default function Page() {
  return (
    <Suspense>
      <PostsScreen />
    </Suspense>
  )
}
