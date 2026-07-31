import { registerAs } from '@nestjs/config'

function decodeKey(base64OrPem: string | undefined): string | undefined {
  if (!base64OrPem) return undefined
  // Accept either a raw PEM (with literal newlines) or a base64-encoded PEM.
  if (base64OrPem.includes('BEGIN')) return base64OrPem
  return Buffer.from(base64OrPem, 'base64').toString('utf8')
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }

function toSeconds(expiry: string): number {
  const match = /^(\d+)([smhd])$/.exec(expiry)
  if (!match) return 15 * 60
  return Number(match[1]) * UNIT_SECONDS[match[2]]
}

const accessTokenExpiry = process.env.JWT_ACCESS_TOKEN_EXPIRY ?? '15m'

export default registerAs('jwt', () => ({
  privateKey: decodeKey(process.env.JWT_PRIVATE_KEY),
  publicKey: decodeKey(process.env.JWT_PUBLIC_KEY),
  accessTokenExpiry,
  accessTokenExpirySeconds: toSeconds(accessTokenExpiry),
}))
