/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@medicore/types', '@medicore/ui'],
  // typedRoutes requires every href to resolve to a page that already
  // exists — incompatible with a nav that intentionally links ahead to
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
