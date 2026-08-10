import { registerAs } from '@nestjs/config'

export default registerAs('app', () => ({
  name: process.env.APP_NAME ?? 'MediCore API',
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  url: process.env.APP_URL ?? 'http://localhost:4000',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  cookieSecret: process.env.COOKIE_SECRET ?? 'change-me-in-production-min-32-chars',
  isProduction: process.env.NODE_ENV === 'production',
  // Unset by default: web and api are assumed to share one origin (see
  // auth-cookies.util.ts). Only needed when they're deployed on separate
  // subdomains (e.g. Dokploy's ADR-0033 one-domain-per-service layout) -
  // set to the shared parent, e.g. ".grovyn.in", so the browser attaches
  // the cookie set by the api host to requests made from the web host too.
  cookieDomain: process.env.COOKIE_DOMAIN,
}))
