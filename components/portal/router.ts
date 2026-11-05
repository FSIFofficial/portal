'use client'

import { useCallback, useEffect, useState } from 'react'

// GitHub Pages は静的ホスティングなので、画面の切り替えは URL のハッシュ（#/tools など）で行う。
// こうしておくとリロードやブックマークでも同じ画面を開ける。

export interface Route {
  path: string
  params: URLSearchParams
}

function parse(): Route {
  const hash = window.location.hash.replace(/^#/, '') || '/'
  const [path, query = ''] = hash.split('?')
  return { path: path || '/', params: new URLSearchParams(query) }
}

export function useHashRoute() {
  const [route, setRoute] = useState<Route>({ path: '/', params: new URLSearchParams() })
  useEffect(() => {
    const update = () => setRoute(parse())
    update()
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const navigate = useCallback((path: string, params?: Record<string, string>) => {
    const query = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString() : ''
    window.location.hash = query ? `${path}?${query}` : path
    window.scrollTo({ top: 0 })
  }, [])
  return { route, navigate }
}

export type Navigate = ReturnType<typeof useHashRoute>['navigate']
