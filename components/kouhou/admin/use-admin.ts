'use client'

import { useCallback } from 'react'
import { useAction } from '@/lib/kouhou/store/store'
import { adminEdit } from '@/lib/kouhou/domain/actions'
import type { AppState } from '@/lib/kouhou/domain/types'
import { toastResult } from '@/components/kouhou/kit/toast'

export function useAdminEdit() {
  const act = useAction()
  return useCallback((message: string, fn: (s: AppState) => string | void) => toastResult(act(adminEdit, message, fn)).ok, [act])
}

export const CODE_RE = /^[A-Z0-9-]{2,12}$/
