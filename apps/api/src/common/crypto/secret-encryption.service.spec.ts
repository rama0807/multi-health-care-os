import { randomBytes } from 'node:crypto'

import { ServiceUnavailableException } from '@nestjs/common'

import { SecretEncryptionService } from './secret-encryption.service'

function buildService(configEncryptionKey?: string) {
  const configService = { get: jest.fn().mockReturnValue(configEncryptionKey) }
  return new SecretEncryptionService(configService as never)
}

const VALID_KEY = randomBytes(32).toString('base64')

describe('SecretEncryptionService', () => {
  it('reports unconfigured when no key is set', () => {
    const service = buildService(undefined)
    expect(service.isConfigured()).toBe(false)
  })

  it('reports unconfigured for a malformed key rather than crashing at construction', () => {
    const service = buildService('not-a-valid-key')
    expect(service.isConfigured()).toBe(false)
  })

  it('reports configured for a valid base64-encoded 32-byte key', () => {
    const service = buildService(VALID_KEY)
    expect(service.isConfigured()).toBe(true)
  })

  it('round-trips a plaintext secret through encrypt/decrypt', () => {
    const service = buildService(VALID_KEY)
    const encrypted = service.encrypt('re_live_secret_key_12345')
    expect(encrypted.ciphertext).not.toContain('re_live_secret_key_12345')
    expect(service.decrypt(encrypted)).toBe('re_live_secret_key_12345')
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const service = buildService(VALID_KEY)
    const first = service.encrypt('same-plaintext')
    const second = service.encrypt('same-plaintext')
    expect(first.ciphertext).not.toBe(second.ciphertext)
    expect(first.iv).not.toBe(second.iv)
  })

  it('fails decryption if the ciphertext was tampered with', () => {
    const service = buildService(VALID_KEY)
    const encrypted = service.encrypt('re_live_secret_key_12345')
    const tampered = { ...encrypted, ciphertext: Buffer.from('tampered-bytes!!').toString('base64') }
    expect(() => service.decrypt(tampered)).toThrow()
  })

  it('fails decryption against the wrong key', () => {
    const service = buildService(VALID_KEY)
    const encrypted = service.encrypt('re_live_secret_key_12345')

    const otherService = buildService(randomBytes(32).toString('base64'))
    expect(() => otherService.decrypt(encrypted)).toThrow()
  })

  it('throws ServiceUnavailableException rather than a raw crash when no key is configured', () => {
    const service = buildService(undefined)
    expect(() => service.encrypt('anything')).toThrow(ServiceUnavailableException)
  })
})
