import { NotificationChannel, NotificationPriority } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { EmailService } from '../../../common/email/email.service'

import {
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelProvider,
} from './channel-provider.interface'

/**
 * Email delivery reuses the existing `EmailService` (Resend driver, with its
 * console fallback) rather than standing up a second sender - appointment
 * confirmations, password resets and onboarding mail already go through it,
 * and two senders would mean two `from` addresses and two failure modes.
 *
 * The only thing added here is the notification-shaped HTML wrapper.
 */
@Injectable()
export class EmailChannelProvider implements NotificationChannelProvider {
  readonly channel = NotificationChannel.EMAIL
  readonly providerName = 'resend'

  constructor(
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    // `EmailService` degrades to a console fallback when RESEND_API_KEY is
    // absent, so this channel can always be attempted. Reporting it as
    // configured here would overstate a development deployment, so the
    // provider status surfaces the fallback explicitly instead.
    return Boolean(this.config.get<string>('email.resendApiKey'))
  }

  unconfiguredReason(): string | null {
    return this.isConfigured()
      ? null
      : 'RESEND_API_KEY is not set - email is written to the application log instead of sent'
  }

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    if (!request.destination) {
      return {
        ok: false,
        providerName: this.providerName,
        failureReason: 'Recipient has no email address on file',
        retryable: false,
      }
    }

    try {
      await this.emailService.send({
        to: request.destination,
        subject: request.title,
        html: this.render(request),
      })
      return { ok: true, providerName: this.providerName, retryable: false }
    } catch (error) {
      // A transport error is worth another attempt; a rejected address is not.
      // Resend reports the latter as a 4xx, which surfaces in the message.
      const message = (error as Error).message
      return {
        ok: false,
        providerName: this.providerName,
        failureReason: message,
        retryable: !/\b4\d{2}\b|invalid|not a valid/i.test(message),
      }
    }
  }

  private render(request: ChannelSendRequest): string {
    const frontendUrl = this.config.get<string>('notifications.frontendUrl') ?? ''
    const link = request.deepLink ? `${frontendUrl}${request.deepLink}` : null
    const greeting = request.recipientName ? `Hi ${escapeHtml(request.recipientName)},` : 'Hello,'
    const urgent = request.priority === NotificationPriority.CRITICAL

    return `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        ${urgent ? '<p style="margin:0 0 12px;padding:8px 12px;border-radius:6px;background:#fee2e2;color:#991b1b;font-weight:600">Critical notification</p>' : ''}
        <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(request.title)}</h2>
        <p style="margin:0 0 12px;color:#334155">${greeting}</p>
        <p style="margin:0 0 20px;line-height:1.6;color:#334155">${escapeHtml(request.body)}</p>
        ${
          link
            ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#0f172a;color:#fff;text-decoration:none">Open in MediCore</a></p>`
            : ''
        }
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
        <p style="margin:0;font-size:12px;color:#64748b">
          You are receiving this because of your MediCore notification preferences.
          ${frontendUrl ? `<a href="${escapeHtml(frontendUrl)}/dashboard/notifications/preferences" style="color:#475569">Manage preferences</a>.` : ''}
        </p>
      </div>
    `
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
