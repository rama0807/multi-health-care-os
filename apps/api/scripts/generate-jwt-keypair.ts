/**
 * Generates an RS256 keypair for signing JWT access tokens (ADR-006) and
 * prints base64-encoded PEM values ready to paste into .env/.env.local as
 * JWT_PRIVATE_KEY / JWT_PUBLIC_KEY. Run with: pnpm --filter @medicore/api keys:generate
 */
import { generateKeyPairSync } from 'crypto'

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

console.log('# Add these to apps/api/.env.local (never commit real keys)\n')
console.log(`JWT_PRIVATE_KEY=${Buffer.from(privateKey).toString('base64')}\n`)
console.log(`JWT_PUBLIC_KEY=${Buffer.from(publicKey).toString('base64')}\n`)
