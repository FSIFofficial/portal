// 広報管理（/kouhou/）の URL まわり。
// 画面のリンク（next/link・router）は basePath を自動で付けるので '/kouhou/…' のまま書く。
// <img src> は basePath が付かないので、サイト内の画像はここで付ける。

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

/** 素材の画像URL。サイト内の画像（/kouhou/… で始まる）にだけ basePath を付ける。data: や https: はそのまま */
export function mediaUrl(src: string): string {
  return src.startsWith('/') && !src.startsWith('//') ? `${BASE_PATH}${src}` : src
}

/** ポータルのトップ（ログイン画面）の URL */
export const portalHomeUrl = () => `${BASE_PATH}/`
