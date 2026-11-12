'use client'

import { useEffect, useState } from 'react'
import { mediaUrl } from '@/lib/kouhou/paths'
import { loadMedia } from '@/lib/kouhou/live'

/** 素材の画像URLを表示用に解決する。Drive の画像（drive:ファイルID）は GAS から受け取る */
export function useMediaSrc(src: string | null | undefined): string | null {
  const driveId = src?.startsWith('drive:') ? src.slice(6) : null
  const [loaded, setLoaded] = useState<{ id: string; url: string } | null>(null)
  useEffect(() => {
    if (!driveId) return
    let alive = true
    loadMedia(driveId)
      .then((url) => alive && setLoaded({ id: driveId, url }))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [driveId])
  if (!src) return null
  if (driveId) return loaded?.id === driveId ? loaded.url : null
  return mediaUrl(src)
}

/** <img> の代わり。Drive の画像は読み込むまで薄い背景だけを出す */
export function MediaImg({ src, alt, className, ...rest }: Omit<React.ComponentProps<'img'>, 'src'> & { src: string }) {
  const url = useMediaSrc(src)
  if (!url) return <span aria-hidden className={className} style={{ background: 'var(--muted)' }} />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} {...rest} />
}
