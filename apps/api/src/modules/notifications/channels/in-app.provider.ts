import { NotificationChannel } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import {
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelProvider,
} from './channel-provider.interface'

/**
 * The in-app channel needs no transport: the `Notification` row the dispatcher
 * has already written *is* the delivered message, and the notification centre
 * reads it directly.
 *
 * It is still modelled as a provider so the in-app channel appears in delivery
 * statistics and preference checks on exactly the same footing as the others -
 * "was it delivered in-app?" is then answered by the same table that answers
 * it for email and push, rather than by a special case.
 */
@Injectable()
export class InAppProvider implements NotificationChannelProvider {
  readonly channel = NotificationChannel.IN_APP
  readonly providerName = 'in-app'

  isConfigured(): boolean {
    return true
  }

  unconfiguredReason(): string | null {
    return null
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- the interface is async
  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    return {
      ok: true,
      providerName: this.providerName,
      providerMessageId: request.notificationId,
      retryable: false,
    }
  }
}
