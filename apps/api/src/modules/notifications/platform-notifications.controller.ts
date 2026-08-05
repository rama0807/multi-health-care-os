import { ReportFilterQuery } from '@medicore/types'
import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PlatformGuard } from '../../common/tenant/platform.guard'

import { NotificationDispatcherService } from './notification-dispatcher.service'
import { NotificationQueueService } from './notification-queue.service'
import { NotificationStatsService } from './notification-stats.service'

/**
 * Platform Owner notification analytics (Checkpoint 18.6).
 *
 * Gated twice, exactly as Checkpoint 16.2 established: `PlatformGuard`
 * requires the caller's organization to be the platform tenant, *and* every
 * handler requires a `platform.notifications.*` permission that organization
 * admins are explicitly denied. Holding one inside a customer tenant grants
 * nothing.
 */
@ApiTags('platform')
@ApiBearerAuth()
@UseGuards(PlatformGuard)
@Controller({ path: 'platform/notifications', version: '1' })
export class PlatformNotificationsController {
  constructor(
    private readonly stats: NotificationStatsService,
    private readonly queue: NotificationQueueService,
    private readonly dispatcher: NotificationDispatcherService,
  ) {}

  /** Cross-tenant volume, success/failure rates and per-organization usage. */
  @Get('analytics')
  @RequirePermissions('platform.notifications.read')
  analytics(@Query() query: Record<string, string>) {
    const range: ReportFilterQuery = { from: query.from || undefined, to: query.to || undefined }
    return this.stats.forPlatform(range)
  }

  /** Queue depth across every tenant, plus whether the worker is running. */
  @Get('queue')
  @RequirePermissions('platform.notifications.read')
  queueStatus() {
    return this.queue.status()
  }

  /**
   * Provider configuration. Deployment-wide rather than per-tenant: the
   * channel adapters are chosen by environment configuration, so an
   * organization cannot have its own FCM project today. That constraint is
   * recorded in TECH_DEBT rather than papered over with a per-tenant screen
   * that would not do anything.
   */
  @Get('providers')
  @RequirePermissions('platform.notifications.manage')
  providers() {
    return this.dispatcher.providerStatuses()
  }
}
