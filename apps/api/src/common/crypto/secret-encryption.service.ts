import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32
const IV_BYTES = 12

export interface EncryptedSecret {
  ciphertext: string
  iv: string
  authTag: string
}

/**
 * Encryption-at-rest for a single kind of secret: a tenant's own third-party
 * API key (starting with the Resend key, TD-0064). There is no other
 * encryption-at-rest anywhere in this codebase (every other credential is a
 * plaintext env var) - this is deliberately narrow rather than a general
 * "vault," so its one key has one clear blast radius.
 *
 * AES-256-GCM: authenticated encryption, so a tampered ciphertext (or one
 * decrypted with the wrong key, e.g. after a key rotation) fails loudly via
 * `authTag` verification rather than returning silently-wrong bytes.
 */
@Injectable()
export class SecretEncryptionService {
  private readonly logger = new Logger(SecretEncryptionService.name)
  private readonly key: Buffer | null

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('email.configEncryptionKey')?.trim()
    this.key = configured ? this.decodeKey(configured) : null

    if (configured && !this.key) {
      this.logger.error(
        'EMAIL_CONFIG_ENCRYPTION_KEY is set but is not a valid base64-encoded 32-byte key - treating it as unset.',
      )
    }
  }

  /** Whether a valid key is configured. Callers use this to fail with an honest 503, not a stack trace. */
  isConfigured(): boolean {
    return this.key !== null
  }

  encrypt(plaintext: string): EncryptedSecret {
    const key = this.requireKey()
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    }
  }

  decrypt(secret: EncryptedSecret): string {
    const key = this.requireKey()
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(secret.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'))
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final(),
    ])
    return plaintext.toString('utf8')
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'EMAIL_CONFIG_ENCRYPTION_KEY is not configured on this server - per-organization email credentials cannot be stored.',
      )
    }
    return this.key
  }

  private decodeKey(value: string): Buffer | null {
    try {
      const decoded = Buffer.from(value, 'base64')
      return decoded.length === KEY_BYTES ? decoded : null
    } catch {
      return null
    }
  }
}
