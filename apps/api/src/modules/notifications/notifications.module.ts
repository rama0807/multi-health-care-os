import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'

import {
  NOTIFICATION_CHANNEL_PROVIDERS,
  NotificationChannelProvider,
} from './channels/channel-provider.interface'
import { EmailChannelProvider } from './channels/email.provider'
import { FcmPushProvider } from './channels/fcm-push.provider'
import { InAppProvider } from './channels/in-app.provider'
import { SmsProvider } from './channels/sms.provider'
import { WhatsappProvider } from './channels/whatsapp.provider'
import { NotificationAdminController } from './notification-admin.controller'
import { NotificationDispatcherService } from './notification-dispatcher.service'
import { NotificationEventsListener } from './notification-events.listener'
import { NotificationHistoryService } from './notification-history.service'
import { NotificationPreferenceService } from './notification-preference.service'
import { NotificationQueueService } from './notification-queue.service'
import { NotificationSchedulerService } from './notification-scheduler.service'
import { NotificationStatsService } from './notification-stats.service'
import { NotificationTemplateService } from './notification-template.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsService } from './notifications.service'
import { PlatformNotificationsController } from './platform-notifications.controller'
import { UserDeviceService } from './user-device.service'

/**
 * Communication & Notification Platform (Milestone 18 / ADR-0027).
 *
 * Imports exactly one feature module (`AuditModule`, so admin actions are
 * recorded through the existing audit trail rather than a second one).
 * Everything else it needs is global: `EmailModule` for the reused Resend
 * sender, plus `PrismaModule`, `ConfigModule` and `EventEmitterModule`.
 *
 * It deliberately imports **no** clinical, billing or inventory module. Event
 * listeners read the domain through Prisma and react to events those modules
 * already publish, so notifications can never introduce a module cycle and no
 * business rule is duplicated here.
 */
@Module({
  imports: [AuditModule],
  controllers: [NotificationsController, NotificationAdminController, PlatformNotificationsController],
  providers: [
    NotificationsService,
    NotificationTemplateService,
    NotificationPreferenceService,
    NotificationHistoryService,
    NotificationQueueService,
    NotificationDispatcherService,
    NotificationSchedulerService,
    NotificationStatsService,
    UserDeviceService,
    NotificationEventsListener,

    // Channel adapters. Every one is instantiated and the dispatcher selects
    // by `channel` — mirroring how `StorageModule` and `AiCommonModule` build
    // their driver sets, so adding a real SMS vendor is one class plus one
    // entry in the array below.
    InAppProvider,
    EmailChannelProvider,
    FcmPushProvider,
    SmsProvider,
    WhatsappProvider,
    {
      provide: NOTIFICATION_CHANNEL_PROVIDERS,
      useFactory: (
        inApp: InAppProvider,
        email: EmailChannelProvider,
        push: FcmPushProvider,
        sms: SmsProvider,
        whatsapp: WhatsappProvider,
      ): NotificationChannelProvider[] => [inApp, push, email, sms, whatsapp],
      inject: [InAppProvider, EmailChannelProvider, FcmPushProvider, SmsProvider, WhatsappProvider],
    },
  ],
  // `NotificationsService` is the only thing another module should need: it is
  // the single entry point for "notify someone". The scheduler is exported so
  // tests can drive `tick()` deterministically instead of waiting on a timer.
  exports: [NotificationsService, NotificationSchedulerService],
})
export class NotificationsModule {}
