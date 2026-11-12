'use client'

// 静的書き出し（GitHub Pages）では URL のクエリをサーバー側で読めないので、画面側で読んでから各画面に渡す。
// 投稿詳細も /kouhou/posts/[id] ではなく /kouhou/posts/detail/?id=… にしている（投稿IDは実行時に増えるため）。

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { NewPostScreen } from '@/components/kouhou/screens/new-post-screen'
import { PostDetailScreen } from '@/components/kouhou/screens/post-detail-screen'
import { TemplateEditor } from '@/components/kouhou/assets/template-editor'

export function NewPostRoute() {
  const q = useSearchParams()
  return <NewPostScreen initialAt={q.get('at') ?? undefined} initialPlanId={q.get('plan') ?? undefined} />
}

export function PostDetailRoute() {
  const q = useSearchParams()
  const id = q.get('id') ?? ''
  return <PostDetailScreen key={id} id={id} />
}

export function TemplateEditorRoute() {
  const q = useSearchParams()
  return <TemplateEditor originId={q.get('asset') ?? 'as-bg-1'} postId={q.get('post') ?? undefined} />
}

/** /kouhou/ を開いたらカレンダーへ */
export function RedirectTo({ href }: { href: string }) {
  const router = useRouter()
  useEffect(() => router.replace(href), [router, href])
  return null
}
