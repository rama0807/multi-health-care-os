import { NotificationChannel } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelProvider,
} from './channel-provider.interface'

/**
 * SMS transport (Milestone 18).
 *
 * **No paid provider is integrated, by explicit instruction for this
 * milestone.** This is the abstraction plus a local `LOG` driver:
 *
 * - `SMS_DRIVER=LOG` writes the message to the application log and records the
 *   delivery as sent by `providerName: 'log'`. Useful in development; the
 *   delivery row names the driver so nobody can mistake it for a real message.
 * - anything else (the default) reports "not configured" and **fails** the
 *   delivery with that reason. It never reports a message as sent that was
 *   not sent - the same line Milestone 5 held when SMS confirmations were
 *   first deferred (TD-0015).
 *
 * Adding a real vendor is a new class implementing this interface plus one
 * branch in `NotificationsModule`; nothing else changes.
 */
@Injectable()
export class SmsProvider implements NotificationChannelProvider {
  readonly channel = NotificationChannel.SMS
  private readonly logger = new Logger(SmsProvider.name)

  constructor(private readonly config: ConfigService) {}

  get providerName(): string {
    return this.driver === 'LOG' ? 'log-sms' : 'none'
  }

  private get driver(): string {
    return this.config.get<string>('notifications.sms.driver') ?? 'NONE'
  }

  isConfigured(): boolean {
    return this.driver === 'LOG'
  }

  unconfiguredReason(): string | null {
    if (this.isConfigured()) return null
    return 'No SMS provider is configured - set SMS_DRIVER=LOG for local development, or add a real provider adapter'
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

    // SMS has no title; a real vendor would receive exactly this body.
    this.logger.log(`[sms:log-driver] To ${request.destination}: ${request.title} - ${request.body}`)
    return { ok: true, providerName: this.providerName, retryable: false }
  }
}
