import { defineConfig, devices } from '@playwright/test'

// 画面の自動テスト（デモモードで実行）。
// 先に `NEXT_PUBLIC_BASE_PATH=/portal pnpm build` で out/ を作ってから `pnpm test:e2e` を実行する。
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/portal/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/serve-out.mjs',
    url: 'http://localhost:4173/portal/',
    reuseExistingServer: !process.env.CI,
  },
})
