import { readFileSync } from 'node:fs'

// Real package version, not a hardcoded string - so the About section in
// /dashboard/settings shows what's actually deployed.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  transpilePackages: ['@medicore/types', '@medicore/ui'],
  // typedRoutes requires every href to resolve to a page that already
  // exists - incompatible with a nav that intentionally links ahead to
  // pages future milestones haven't built yet (patients, billing, etc.).
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.medicore.app',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
