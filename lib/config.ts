// ビルド時に埋め込まれる設定値。GitHub Actions ではリポジトリの Variables から渡す。
// どちらも未設定の場合はブラウザ内のサンプルデータで動く「デモモード」になる。

/** GASウェブアプリのURL（https://script.google.com/macros/s/xxxx/exec） */
export const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL ?? ''

/** Google Cloud で発行した OAuth クライアントID（ウェブアプリケーション） */
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''

/** GitHub Pages のサブパス（例: /portal）。画像パスの解決に使う */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const DEMO_MODE = !GAS_URL

/**
 * この画面が前提としているGASの版名。GASコード1行目の GAS_VERSION と一致している必要がある。
 * GAS側のデータ形式を変えたら両方を同じ値に上げること（管理画面の「バージョン確認」で照合する）。
 */
export const EXPECTED_GAS_VERSION = '2.5.0'

export const asset = (path: string) => `${BASE_PATH}${path}`
