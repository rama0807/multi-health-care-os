import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Resend } from 'resend'

interface SendEmailInput {
  to: string
  subject: string
  html: string
}

/**
 * Per-send credential override - how a caller uses an organization's own
 * Resend key (TD-0064) instead of the platform default, one send at a time,
 * without this service holding per-tenant state. `OrganizationEmailConfigService`
 * is what decrypts a stored key into this shape; this service never touches
 * the encrypted columns itself.
 */
export interface EmailSendOverride {
  apiKey?: string
  fromEmail?: string
  fromName?: string
  replyTo?: string
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name)
  private resend: Resend | null = null
  private fromAddress = 'MediCore <onboarding@medicore.app>'

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.configService.get<string>('email.resendApiKey')
    const fromEmail = this.configService.get<string>('email.fromEmail')
    const fromName = this.configService.get<string>('email.fromName')

    if (fromEmail) {
      this.fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail
    }

    if (apiKey) {
      this.resend = new Resend(apiKey)
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not set - emails will be logged to the console instead of sent.',
      )
    }
  }

  /**
   * `delivered` is `false` only for the dev/no-key console fallback - a real
   * send failure still throws, never returns `{ delivered: false }`, so a
   * caller can't mistake "the provider rejected this" for "nothing is
   * configured." `sendTestEmail` (`OrganizationEmailConfigService`) is the
   * one caller that actually reads this - a test email that only reached the
   * log would otherwise report success and teach an admin to trust a key
   * that was never exercised.
   */
  async send({ to, subject, html }: SendEmailInput, override?: EmailSendOverride): Promise<{ delivered: boolean }> {
    const client = override?.apiKey ? new Resend(override.apiKey) : this.resend
    const from = this.resolveFrom(override)

    if (!client) {
      this.logger.log(`[email:dev-fallback] To: ${to} | Subject: ${subject}\n${html}`)
      return { delivered: false }
    }

    try {
      await client.emails.send({ from, to, subject, html, replyTo: override?.replyTo })
      return { delivered: true }
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`)
      throw error
    }
  }

  private resolveFrom(override?: EmailSendOverride): string {
    if (!override?.fromEmail) return this.fromAddress
    return override.fromName ? `${override.fromName} <${override.fromEmail}>` : override.fromEmail
  }
}
