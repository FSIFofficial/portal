import { createSeedData } from "./mock-data"
import type { AppData } from "./types"

/**
 * 永続化の境界。現在は localStorage を使うデモ実装。
 * 将来 API に置き換える場合はこのインターフェースを満たす実装に差し替える。
 */
export interface AccessRepository {
  load(): Promise<AppData>
  save(next: AppData, expectedVersion: number, opts?: { fail?: boolean }): Promise<SaveResult>
  reset(): Promise<AppData>
}

export type SaveResult = { ok: true; data: AppData } | { ok: false; reason: "conflict"; latest: AppData } | { ok: false; reason: "error"; message: string }

const STORAGE_KEY = "fsif-access-manager:v1"
const LATENCY = 450

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function readStorage(): AppData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AppData) : null
  } catch {
    return null
  }
}

function writeStorage(data: AppData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 容量超過などはメモリー上の状態のみで継続する
  }
}

export const localRepository: AccessRepository = {
  async load() {
    const stored = readStorage()
    if (stored) return stored
    const seed = createSeedData()
    writeStorage(seed)
    return seed
  },
  async save(next, expectedVersion, opts) {
    await wait(LATENCY)
    if (opts?.fail) return { ok: false, reason: "error", message: "保存処理がタイムアウトしました（デモ）" }
    const current = readStorage()
    if (current && current.version > expectedVersion) return { ok: false, reason: "conflict", latest: current }
    writeStorage(next)
    return { ok: true, data: next }
  },
  async reset() {
    const seed = createSeedData()
    writeStorage(seed)
    return seed
  },
}

/** 競合デモ用：他の管理者が保存したものとしてストレージだけを先に更新する */
export function writeExternal(data: AppData) {
  writeStorage(data)
}
