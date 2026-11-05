/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

const nextConfig = {
  // GitHub Pages で配信するため静的HTMLとして書き出す（out/ に出力）
  output: 'export',
  basePath,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

export default nextConfig
