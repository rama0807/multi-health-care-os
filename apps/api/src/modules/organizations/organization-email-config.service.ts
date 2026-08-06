import type { OrganizationEmailConfigSummary, SendTestEmailResult, UpdateOrganizationEmailConfigDto } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import type { OrganizationEmailConfig } from '@prisma/client'

import { SecretEncryptionService } from '../../common/crypto/secret-encryption.service'
import { EmailSendOverride, EmailService } from '../../common/email/email.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

type ApiKeyColumns = Pick<OrganizationEmailConfig, 'apiKeyCiphertext' | 'apiKeyIv' | 'apiKeyAuthTag' | 'apiKeyLast4'>

const CLEARED_KEY: ApiKeyColumns = {
  apiKeyCiphertext: null,
  apiKeyIv: null,
  apiKeyAuthTag: null,
  apiKeyLast4: null,
}

/**
 * A tenant's own Resend credential (TD-0064) - so every organization on this
 * deployment isn't forced to share one platform `RESEND_API_KEY`. Lives as
 * its own small service (not folded into the much larger
 * `OrganizationsService`) because `AuthModule` needs `resolveSendOverride`
 * too, for password-reset/verification email, and a service this narrow is
 * easy to import from both without risking a circular module dependency.
 *
 * The one rule that matters more than any other here: **the plaintext key
 * never leaves `encrypt`/`decrypt`.** It is never logged, never returned in
 * an API response, and never stored anywhere but the two ciphertext columns
 * this service alone reads.
 */
@Injectable()
export class OrganizationEmailConfigService {
  private readonly logger = new Logger(OrganizationEmailConfigService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly encryption: SecretEncryptionService,
    private readonly emailService: EmailService,
  ) {}

  async getSummary(organizationId: string): Promise<OrganizationEmailConfigSummary> {
    const config = await this.prisma.organizationEmailConfig.findUnique({ where: { organizationId } })
    return this.toSummary(config)
  }

  async update(
    organizationId: string,
    dto: UpdateOrganizationEmailConfigDto,
    actorUserId: string,
  ): Promise<OrganizationEmailConfigSummary> {
    const existing = await this.prisma.organizationEmailConfig.findUnique({ where: { organizationId } })

    const keyColumns = this.resolveApiKeyColumns(dto.apiKey, existing)
    const fromName = dto.fromName === undefined ? existing?.fromName ?? null : dto.fromName
    const fromEmail = dto.fromEmail === undefined ? existing?.fromEmail ?? null : dto.fromEmail
    const replyToEmail = dto.replyToEmail === undefined ? existing?.replyToEmail ?? null : dto.replyToEmail

    const saved = await this.prisma.organizationEmailConfig.upsert({
      where: { organizationId },
      create: { organizationId, ...keyColumns, fromName, fromEmail, replyToEmail, updatedByUserId: actorUserId },
      update: { ...keyColumns, fromName, fromEmail, replyToEmail, updatedByUserId: actorUserId },
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.email_config_updated',
      resource: 'OrganizationEmailConfig',
      resourceId: saved.id,
      before: existing ? this.redactedAuditView(existing) : null,
      after: this.redactedAuditView(saved),
    })

    return this.toSummary(saved)
  }

  /**
   * Resolves the org's decrypted credential for a single send. Returns
   * `undefined` when the org has no config row at all, so `EmailService`
   * falls through to the platform default exactly as if this feature didn't
   * exist - the common case for every organization that hasn't opted in.
   */
  async resolveSendOverride(organizationId: string): Promise<EmailSendOverride | undefined> {
    const config = await this.prisma.organizationEmailConfig.findUnique({ where: { organizationId } })
    if (!config) return undefined

    const override: EmailSendOverride = {}
    if (config.fromEmail) override.fromEmail = config.fromEmail
    if (config.fromName) override.fromName = config.fromName
    if (config.replyToEmail) override.replyTo = config.replyToEmail

    if (config.apiKeyCiphertext && config.apiKeyIv && config.apiKeyAuthTag) {
      if (!this.encryption.isConfigured()) {
        // Never silently drop this - an admin who configured a key deserves
        // to know it's being ignored, not just get platform-default mail.
        this.logger.error(
          `Organization ${organizationId} has a stored email API key but EMAIL_CONFIG_ENCRYPTION_KEY is not ` +
            'configured on this server - falling back to the platform default Resend key.',
        )
      } else {
        override.apiKey = this.encryption.decrypt({
          ciphertext: config.apiKeyCiphertext,
          iv: config.apiKeyIv,
          authTag: config.apiKeyAuthTag,
        })
      }
    }

    return Object.keys(override).length > 0 ? override : undefined
  }

  /** Fires a real send through whichever credential currently applies - never fakes success. */
  async sendTestEmail(organizationId: string, toEmail: string): Promise<SendTestEmailResult> {
    const override = await this.resolveSendOverride(organizationId)
    const result = await this.emailService.send(
      {
        to: toEmail,
        subject: 'MediCore test email',
        html: '<p>This is a test email from your MediCore organization’s email settings. If you received this, delivery is working.</p>',
      },
      override,
    )

    return { sent: result.delivered, to: toEmail, usedOrganizationKey: Boolean(override?.apiKey) }
  }

  private resolveApiKeyColumns(
    apiKey: string | null | undefined,
    existing: OrganizationEmailConfig | null,
  ): ApiKeyColumns {
    if (apiKey === undefined) {
      return existing
        ? {
            apiKeyCiphertext: existing.apiKeyCiphertext,
            apiKeyIv: existing.apiKeyIv,
            apiKeyAuthTag: existing.apiKeyAuthTag,
            apiKeyLast4: existing.apiKeyLast4,
          }
        : CLEARED_KEY
    }

    if (apiKey === null) return CLEARED_KEY

    const encrypted = this.encryption.encrypt(apiKey)
    return {
      apiKeyCiphertext: encrypted.ciphertext,
      apiKeyIv: encrypted.iv,
      apiKeyAuthTag: encrypted.authTag,
      apiKeyLast4: apiKey.slice(-4),
    }
  }

  private toSummary(config: OrganizationEmailConfig | null): OrganizationEmailConfigSummary {
    if (!config) {
      return { hasApiKey: false, apiKeyMasked: null, fromName: null, fromEmail: null, replyToEmail: null, updatedAt: null }
    }

    return {
      hasApiKey: Boolean(config.apiKeyCiphertext),
      apiKeyMasked: config.apiKeyLast4 ? `••••${config.apiKeyLast4}` : null,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      replyToEmail: config.replyToEmail,
      updatedAt: config.updatedAt,
    }
  }

  /** Audit trail records that a key changed, never the key itself - not even its ciphertext. */
  private redactedAuditView(config: OrganizationEmailConfig) {
    return {
      hasApiKey: Boolean(config.apiKeyCiphertext),
      apiKeyLast4: config.apiKeyLast4,
      fromName: config.fromName,
      fromEmail: config.fromEmail,
      replyToEmail: config.replyToEmail,
    }
  }
}
