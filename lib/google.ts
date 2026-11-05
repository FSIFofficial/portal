// Google Identity Services（Googleでログイン）の読み込みと IDトークンの扱い。

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    google?: any
  }
}

let loader: Promise<void> | null = null

export function loadGoogleIdentity(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser only'))
  if (window.google?.accounts?.id) return Promise.resolve()
  if (loader) return loader
  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      loader = null
      reject(new Error('Googleログインの読み込みに失敗しました'))
    }
    document.head.appendChild(script)
  })
  return loader
}

let initializedFor: string | null = null
let currentCallback: ((token: string) => void) | null = null

export function initGoogleIdentity(clientId: string, onCredential: (token: string) => void) {
  currentCallback = onCredential
  if (initializedFor === clientId) return
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (res: { credential: string }) => currentCallback?.(res.credential),
    auto_select: true,
    cancel_on_tap_outside: false,
    use_fedcm_for_prompt: true,
  })
  initializedFor = clientId
}

export function renderGoogleButton(el: HTMLElement) {
  window.google.accounts.id.renderButton(el, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'pill',
    locale: 'ja',
    width: 280,
  })
}

export function promptGoogleOneTap() {
  try {
    window.google?.accounts?.id?.prompt()
  } catch {
    // One Tap が使えない環境ではボタンからログインしてもらう
  }
}

export function disableGoogleAutoSelect() {
  try {
    window.google?.accounts?.id?.disableAutoSelect()
  } catch {
    // noop
  }
}

/** JWT の有効期限（ミリ秒）。デコードできなければ 0 */
export function tokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1]
    const json = JSON.parse(decodeURIComponent(escape(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))))
    return Number(json.exp) * 1000
  } catch {
    return 0
  }
}
