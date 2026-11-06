// 画面の自動テスト用：ビルド結果（out/）を GitHub Pages と同じ /portal/ の下で配信する小さなサーバー
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const ROOT = resolve('out')
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '/portal'
const PORT = Number(process.env.PORT || 4173)
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { Location: `${BASE}/` }).end()
    return
  }
  let path = normalize(join(ROOT, decodeURIComponent(url.pathname.slice(BASE.length))))
  if (!path.startsWith(ROOT)) {
    res.writeHead(403).end()
    return
  }
  try {
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html')
    const body = await readFile(path)
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body)
  } catch {
    res.writeHead(404).end('not found')
  }
}).listen(PORT, () => console.log(`serving out/ at http://localhost:${PORT}${BASE}/`))
