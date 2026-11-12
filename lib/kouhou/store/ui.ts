'use client'

import { useSyncExternalStore } from 'react'

interface UiState {
  brand: 'all' | string
}

let ui: UiState = { brand: 'all' }
const ls = new Set<() => void>()

export function setBrandFilter(brand: string) {
  ui = { ...ui, brand }
  ls.forEach((l) => l())
}

const SERVER: UiState = { brand: 'all' }

export function useUi() {
  return useSyncExternalStore(
    (l) => {
      ls.add(l)
      return () => ls.delete(l)
    },
    () => ui,
    () => SERVER,
  )
}
