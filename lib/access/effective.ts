import { resolveEffectiveAccess } from "./rules"
import type { AppData } from "./types"

/** 各ツールが問い合わせる「実効権限」の1行（GAS の「実効権限」シートに書き出す） */
export interface EffectiveRow {
  email: string
  name: string
  memberId: string
  toolId: string
  toolName: string
  allowed: boolean
  roleKey: string
  roleLabel: string
  rank: number
  /** 利用不可の理由（利用可なら空） */
  reason: string
}

const REASON: Record<string, string> = {
  withdrawn: "退会済み",
  tool_disabled: "ツール無効",
  manual_off: "手動OFF",
  no_grant: "付与なし",
}

/**
 * 全メンバー×全ツールの利用可否と役割を計算する。画面の権限一覧と同じ resolveEffectiveAccess を使う。
 * 保存のたびに画面が計算して GAS へ送り、各ツールは GAS の checkAccess でこの結果を引く。
 * 退会者・利用不可の行も残す（ツール側で「なぜ使えないか」を出せるように）。
 */
export function computeEffectiveRows(data: AppData): EffectiveRow[] {
  const rows: EffectiveRow[] = []
  for (const m of data.members) {
    for (const t of data.tools) {
      const ea = resolveEffectiveAccess(data, m.id, t.id)
      rows.push({
        email: m.email.toLowerCase(),
        name: m.name,
        memberId: m.id,
        toolId: t.id,
        toolName: t.name,
        allowed: ea.allowed,
        roleKey: ea.allowed ? ea.appliedRole?.roleKey ?? "" : "",
        roleLabel: ea.allowed ? ea.appliedRole?.label ?? "" : "",
        rank: ea.allowed ? ea.appliedRole?.rank ?? 0 : 0,
        reason: ea.allowed ? "" : REASON[ea.denyReason ?? "no_grant"] ?? "",
      })
    }
  }
  return rows
}
