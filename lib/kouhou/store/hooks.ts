'use client'

import { useMemo } from 'react'
import { useAppState } from './store'
import { useUi } from './ui'
import { getUser } from '@/lib/kouhou/domain/rules'
import { visiblePosts } from '@/lib/kouhou/domain/selectors'

/** 現在のユーザー・ブランド絞り込みを反映した閲覧範囲 */
export function useScope() {
  const s = useAppState()
  const { brand } = useUi()
  const user = getUser(s, s.currentUserId)
  const posts = useMemo(() => visiblePosts(s, user, brand), [s, user, brand])
  return { s, user, brand, posts }
}
