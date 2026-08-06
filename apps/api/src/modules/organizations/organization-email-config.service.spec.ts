import { ServiceUnavailableException } from '@nestjs/common'

import { SecretEncryptionService } from '../../common/crypto/secret-encryption.service'
import { EmailService } from '../../common/email/email.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

import { OrganizationEmailConfigService } from './organization-email-config.service'

const EXISTING_ROW = {
  id: 'cfg_1',
  organizationId: 'org_1',
  apiKeyCiphertext: 'cipher',
  apiKeyIv: 'iv',
  apiKeyAuthTag: 'tag',
  apiKeyLast4: 'a1b2',
  fromName: 'Demo Hospital',
  fromEmail: 'no-reply@demo.example',
  replyToEmail: 'support@demo.example',
  updatedByUserId: 'user_1',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
}

function buildService(overrides: { existing?: unknown; encryptionConfigured?: boolean } = {}) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) }

  const prisma = {
    organizationEmailConfig: {
      findUnique: jest.fn().mockResolvedValue(overrides.existing ?? null),
      upsert: jest.fn(),
    },
  }

  const configured = overrides.encryptionConfigured ?? true
  const encryption = {
    isConfigured: jest.fn().mockReturnValue(configured),
    // Mirrors the real `SecretEncryptionService`: throws when unconfigured,
    // rather than a mock that would hide the production code's own guard.
    encrypt: jest.fn().mockImplementation(() => {
      if (!configured) throw new ServiceUnavailableException('EMAIL_CONFIG_ENCRYPTION_KEY is not configured')
      return { ciphertext: 'new-cipher', iv: 'new-iv', authTag: 'new-tag' }
    }),
    decrypt: jest.fn().mockReturnValue('re_live_decrypted_key'),
  }

  const emailService = { send: jest.fn().mockResolvedValue({ delivered: true }) }

  const service = new OrganizationEmailConfigService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
    encryption as unknown as SecretEncryptionService,
    emailService as unknown as EmailService,
  )

  return { service, prisma, auditService, encryption, emailService }
}

describe('OrganizationEmailConfigService', () => {
  describe('getSummary', () => {
    it('reports no key configured when no row exists', async () => {
      const { service } = buildService({ existing: null })
      await expect(service.getSummary('org_1')).resolves.toEqual({
        hasApiKey: false,
        apiKeyMasked: null,
        fromName: null,
        fromEmail: null,
        replyToEmail: null,
        updatedAt: null,
      })
    })

    it('masks the stored key down to its last 4 characters - never the plaintext or ciphertext', async () => {
      const { service } = buildService({ existing: EXISTING_ROW })
      const summary = await service.getSummary('org_1')

      expect(summary.hasApiKey).toBe(true)
      expect(summary.apiKeyMasked).toBe('••••a1b2')
      expect(JSON.stringify(summary)).not.toContain('cipher')
      expect(JSON.stringify(summary)).not.toContain('re_live_decrypted_key')
    })
  })

  describe('update', () => {
    it('encrypts and stores a newly provided key', async () => {
      const { service, prisma, encryption } = buildService({ existing: null })
      prisma.organizationEmailConfig.upsert.mockResolvedValue({
        ...EXISTING_ROW,
        apiKeyCiphertext: 'new-cipher',
        apiKeyIv: 'new-iv',
        apiKeyAuthTag: 'new-tag',
        apiKeyLast4: 'wxyz',
      })

      await service.update('org_1', { apiKey: 're_live_abcdwxyz' }, 'user_1')

      expect(encryption.encrypt).toHaveBeenCalledWith('re_live_abcdwxyz')
      expect(prisma.organizationEmailConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            apiKeyCiphertext: 'new-cipher',
            apiKeyIv: 'new-iv',
            apiKeyAuthTag: 'new-tag',
            apiKeyLast4: 'wxyz',
          }),
        }),
      )
    })

    it('leaves the stored key untouched when apiKey is omitted', async () => {
      const { service, prisma, encryption } = buildService({ existing: EXISTING_ROW })
      prisma.organizationEmailConfig.upsert.mockResolvedValue(EXISTING_ROW)

      await service.update('org_1', { fromName: 'New Name' }, 'user_1')

      expect(encryption.encrypt).not.toHaveBeenCalled()
      expect(prisma.organizationEmailConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            apiKeyCiphertext: EXISTING_ROW.apiKeyCiphertext,
            apiKeyIv: EXISTING_ROW.apiKeyIv,
            apiKeyAuthTag: EXISTING_ROW.apiKeyAuthTag,
            fromName: 'New Name',
          }),
        }),
      )
    })

    it('clears the stored key when apiKey is explicitly null', async () => {
      const { service, prisma, encryption } = buildService({ existing: EXISTING_ROW })
      prisma.organizationEmailConfig.upsert.mockResolvedValue({ ...EXISTING_ROW, apiKeyCiphertext: null })

      await service.update('org_1', { apiKey: null }, 'user_1')

      expect(encryption.encrypt).not.toHaveBeenCalled()
      expect(prisma.organizationEmailConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            apiKeyCiphertext: null,
            apiKeyIv: null,
            apiKeyAuthTag: null,
            apiKeyLast4: null,
          }),
        }),
      )
    })

    it('refuses to save a new key when encryption is not configured, rather than storing it in the clear', async () => {
      const { service } = buildService({ existing: null, encryptionConfigured: false })

      await expect(service.update('org_1', { apiKey: 're_live_x' }, 'user_1')).rejects.toThrow(
        ServiceUnavailableException,
      )
    })

    it('never puts the plaintext key in the audit trail', async () => {
      const { service, prisma, auditService } = buildService({ existing: null })
      prisma.organizationEmailConfig.upsert.mockResolvedValue({
        ...EXISTING_ROW,
        apiKeyCiphertext: 'new-cipher',
      })

      await service.update('org_1', { apiKey: 're_live_super_secret' }, 'user_1')

      const [[recordedCall]] = auditService.record.mock.calls
      expect(JSON.stringify(recordedCall)).not.toContain('re_live_super_secret')
      expect(JSON.stringify(recordedCall)).not.toContain('new-cipher')
    })
  })

  describe('resolveSendOverride', () => {
    it('returns undefined when the organization has no config row', async () => {
      const { service } = buildService({ existing: null })
      await expect(service.resolveSendOverride('org_1')).resolves.toBeUndefined()
    })

    it('decrypts the stored key and carries the from/reply-to fields', async () => {
      const { service, encryption } = buildService({ existing: EXISTING_ROW })
      const override = await service.resolveSendOverride('org_1')

      expect(encryption.decrypt).toHaveBeenCalledWith({ ciphertext: 'cipher', iv: 'iv', authTag: 'tag' })
      expect(override).toEqual({
        apiKey: 're_live_decrypted_key',
        fromEmail: 'no-reply@demo.example',
        fromName: 'Demo Hospital',
        replyTo: 'support@demo.example',
      })
    })

    it('falls back to the platform default (no apiKey in the override) when a key is stored but encryption is unavailable', async () => {
      const { service, encryption } = buildService({ existing: EXISTING_ROW, encryptionConfigured: false })
      const override = await service.resolveSendOverride('org_1')

      expect(encryption.decrypt).not.toHaveBeenCalled()
      expect(override?.apiKey).toBeUndefined()
      expect(override?.fromEmail).toBe('no-reply@demo.example')
    })
  })

  describe('sendTestEmail', () => {
    it('reports which credential actually sent it', async () => {
      const { service, emailService } = buildService({ existing: EXISTING_ROW })

      const result = await service.sendTestEmail('org_1', 'admin@demo.example')

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'admin@demo.example' }),
        expect.objectContaining({ apiKey: 're_live_decrypted_key' }),
      )
      expect(result).toEqual({ sent: true, to: 'admin@demo.example', usedOrganizationKey: true })
    })

    it('reports sent:false when the send only reached the dev console fallback', async () => {
      const { service, emailService } = buildService({ existing: null })
      emailService.send.mockResolvedValue({ delivered: false })

      const result = await service.sendTestEmail('org_1', 'admin@demo.example')

      expect(result).toEqual({ sent: false, to: 'admin@demo.example', usedOrganizationKey: false })
    })
  })
})
