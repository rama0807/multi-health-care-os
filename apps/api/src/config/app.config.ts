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
}))
