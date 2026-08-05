import { NotificationChannel } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelProvider,
} from './channel-provider.interface'

/**
 * WhatsApp transport (Milestone 18).
 *
 * Same shape and same honesty rule as `SmsProvider`: abstraction plus a local
 * `LOG` driver, no paid provider integrated by explicit instruction. A real
 * WhatsApp Business integration would additionally have to send a
 * pre-approved template rather than free text — a constraint recorded in
 * TECH_DEBT rather than pretended away here.
 */
@Injectable()
export class WhatsappProvider implements NotificationChannelProvider {
  readonly channel = NotificationChannel.WHATSAPP
  private readonly logger = new Logger(WhatsappProvider.name)

  constructor(private readonly config: ConfigService) {}

  get providerName(): string {
    return this.driver === 'LOG' ? 'log-whatsapp' : 'none'
  }

  private get driver(): string {
    return this.config.get<string>('notifications.whatsapp.driver') ?? 'NONE'
  }

  isConfigured(): boolean {
    return this.driver === 'LOG'
  }

  unconfiguredReason(): string | null {
    if (this.isConfigured()) return null
    return 'No WhatsApp provider is configured — set WHATSAPP_DRIVER=LOG for local development, or add a real provider adapter'
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- the interface is async
  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    const reason = this.unconfiguredReason()
    if (reason) {
      return { ok: false, providerName: this.providerName, failureReason: reason, retryable: false }
    }

    if (!request.destination) {
      return {
        ok: false,
        providerName: this.providerName,
        failureReason: 'Recipient has no phone number on file',
        retryable: false,
      }
    }

    this.logger.log(`[whatsapp:log-driver] To ${request.destination}: ${request.title} — ${request.body}`)
    return { ok: true, providerName: this.providerName, retryable: false }
  }
}
