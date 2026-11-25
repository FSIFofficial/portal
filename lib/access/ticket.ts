// ポータルからツールを開くときの「引き継ぎ」。
// 「開く」を押したら、Access Manager の GAS（issueTicket）にポータルのセッションで使い捨ての引換券（60秒）を頼み、
// ツールの URL に #fsif_ticket=… を付けて開く。ツールの GAS が引換券を確かめ、Google のログインなしで使えるようにする。
// 引換券を出せない（つながっていないツール・使えない人・通信できない）ときは、今までどおり URL だけで開く。

import { DEMO_MODE } from '@/lib/config'

const ACCESS_GAS_URL = (process.env.NEXT_PUBLIC_ACCESS_GAS_URL ?? '').trim()
export const TICKET_PARAM = 'fsif_ticket'

/** 引き継ぎができるか（本番で、権限管理の GAS が設定されている） */
export const TICKET_ENABLED = !!ACCESS_GAS_URL && !DEMO_MODE

/** 引換券を頼む。出せなければ null（理由は問わない：そのまま URL だけで開く） */
export async function requestToolTicket(portalToken: string, toolId: string): Promise<string | null> {
  if (!TICKET_ENABLED || !portalToken) return null
  try {
    const res = await fetch(ACCESS_GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'issueTicket', token: portalToken, payload: { toolId } }),
      redirect: 'follow',
    })
    const body = (await res.json()) as { ok: boolean; data?: { ticket?: string | null } }
    return body.ok && body.data?.ticket ? body.data.ticket : null
  } catch {
    return null
  }
}

/** 引換券を付けた URL（URL にもともと # があるツールには付けない） */
export function withTicket(url: string, ticket: string | null): string {
  if (!ticket || url.includes('#')) return url
  return `${url}#${TICKET_PARAM}=${encodeURIComponent(ticket)}`
}

/**
 * ツールを新しいタブで開く。先に空のタブを開いてから（ポップアップを止められないように）、引換券を待って移動する。
 * タブを開けなければ false（呼び出し側は普通のリンクとして開く）。
 */
export function openToolWithTicket(url: string, portalToken: string, toolId: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  try {
    w.opener = null
    w.document.title = '開いています…'
    w.document.body.style.cssText = 'font-family:sans-serif;color:#4f5f70;display:grid;place-items:center;height:100vh;margin:0'
    w.document.body.textContent = 'ツールを開いています…'
  } catch {
    /* 表示できなくても移動はできる */
  }
  void requestToolTicket(portalToken, toolId).then((ticket) => {
    w.location.replace(withTicket(url, ticket))
  })
  return true
}
