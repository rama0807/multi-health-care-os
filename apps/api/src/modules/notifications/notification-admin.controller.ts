import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationHistoryQuery,
  NotificationStatus,
  ReportFilterQuery,
} from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { AuditService } from '../audit/audit.service'

import {
  PreviewNotificationTemplateDto,
  SendNotificationDto,
  UpsertNotificationTemplateDto,
} from './dto/notification.dto'
import { NotificationDispatcherService } from './notification-dispatcher.service'
import { NotificationHistoryService } from './notification-history.service'
import { NotificationQueueService } from './notification-queue.service'
import { NotificationStatsService } from './notification-stats.service'
import { NotificationTemplateService } from './notification-template.service'
import { toInboxQuery } from './notifications.controller'
import { NotificationsService } from './notifications.service'

function toHistoryQuery(query: Record<string, string | undefined>): NotificationHistoryQuery {
  return {
    ...toInboxQuery(query),
    recipientId: query.recipientId || undefined,
    channel: query.channel ? (query.channel as NotificationChannel) : undefined,
    status: query.status ? (query.status as NotificationStatus) : undefined,
    deliveryStatus: query.deliveryStatus
      ? (query.deliveryStatus as NotificationDeliveryStatus)
      : undefined,
    failedOnly: query.failedOnly === 'true',
    scheduledOnly: query.scheduledOnly === 'true',
  }
}

function toRangeQuery(query: Record<string, string | undefined>): ReportFilterQuery {
  return { from: query.from || undefined, to: query.to || undefined }
}

/**
 * The organization admin's notification console (Checkpoint 18.6).
 *
 * Split from `NotificationsController` because the two have opposite scoping
 * rules: that one is always "my own", this one is always "my organization's".
 * Mixing them on one controller has repeatedly been how an inbox route grows
 * an org-wide escape hatch, so the split is structural rather than cosmetic.
 *
 * `notifications.read` reads history and statistics; `notifications.send`
 * composes a message; `notifications.manage` covers the operational levers
 * (templates, retry, cancel) - the same requester/approver separation
 * `billing.manage` established.
 */
@ApiTags('notifications-admin')
@ApiBearerAuth()
@Controller({ path: 'notifications/admin', version: '1' })
export class NotificationAdminController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly history: NotificationHistoryService,
    private readonly templates: NotificationTemplateService,
    private readonly queue: NotificationQueueService,
    private readonly stats: NotificationStatsService,
    private readonly dispatcher: NotificationDispatcherService,
    private readonly audit: AuditService,
  ) {}

  // ─── History ──────────────────────────────────────────────────────────────

  @Get('history')
  @RequirePermissions('notifications.read')
  listHistory(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.history.listForOrganization(orgId, toHistoryQuery(query))
  }

  @Get('history/:id')
  @RequirePermissions('notifications.read')
  getHistory(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.history.getForOrganization(orgId, id)
  }

  // ─── Statistics, queue & providers ────────────────────────────────────────

  @Get('stats')
  @RequirePermissions('notifications.read')
  getStats(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.stats.forOrganization(orgId, toRangeQuery(query))
  }

  @Get('queue')
  @RequirePermissions('notifications.read')
  getQueue(@CurrentUser('orgId') orgId: string) {
    return this.queue.status(orgId)
  }

  @Get('providers')
  @RequirePermissions('notifications.read')
  getProviders() {
    return this.dispatcher.providerStatuses()
  }

  // ─── Sending ──────────────────────────────────────────────────────────────

  @Post('send')
  @RequirePermissions('notifications.send')
  async send(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SendNotificationDto,
  ) {
    const result = await this.notifications.send(orgId, dto, userId)
    await this.audit.record({
      organizationId: orgId,
      userId,
      action: dto.scheduleAt ? 'notification.scheduled' : 'notification.sent',
      resource: 'Notification',
      // Recipient count and category, never the message body - the same rule
      // `AiModule` follows for generated clinical text.
      after: {
        recipients: result.created,
        category: dto.category,
        priority: dto.priority,
        scheduleAt: dto.scheduleAt ?? null,
      },
    })
    return result
  }

  @Delete('scheduled/:id')
  @RequirePermissions('notifications.manage')
  async cancelScheduled(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.notifications.cancelScheduled(orgId, id)
    await this.audit.record({
      organizationId: orgId,
      userId,
      action: 'notification.schedule_cancelled',
      resource: 'Notification',
      resourceId: id,
    })
    return { cancelled: true }
  }

  // ─── Retry ────────────────────────────────────────────────────────────────

  /** Re-queues failed deliveries. Omit `deliveryIds` to retry every failure. */
  @Post('retry')
  @RequirePermissions('notifications.manage')
  async retry(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() body: { deliveryIds?: string[] },
  ) {
    const requeued = await this.queue.retryFailed(orgId, body?.deliveryIds)
    await this.audit.record({
      organizationId: orgId,
      userId,
      action: 'notification.retry_requested',
      resource: 'NotificationDelivery',
      after: { requeued, explicit: body?.deliveryIds?.length ?? 0 },
    })
    return { requeued }
  }

  // ─── Templates ────────────────────────────────────────────────────────────

  @Get('templates')
  @RequirePermissions('notifications.read')
  listTemplates(@CurrentUser('orgId') orgId: string, @Query('channel') channel?: NotificationChannel) {
    return this.templates.list(orgId, channel)
  }

  @Get('templates/:key/:channel/versions')
  @RequirePermissions('notifications.read')
  listTemplateVersions(
    @CurrentUser('orgId') orgId: string,
    @Param('key') key: string,
    @Param('channel') channel: NotificationChannel,
  ) {
    return this.templates.listVersions(orgId, key, channel)
  }

  @Post('templates')
  @RequirePermissions('notifications.manage')
  async upsertTemplate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpsertNotificationTemplateDto,
  ) {
    const template = await this.templates.upsert(orgId, dto, userId)
    await this.audit.record({
      organizationId: orgId,
      userId,
      action: 'notification_template.version_created',
      resource: 'NotificationTemplate',
      resourceId: template.id ?? undefined,
      after: { key: template.key, channel: template.channel, version: template.version },
    })
    return template
  }

  @Post('templates/:id/activate')
  @RequirePermissions('notifications.manage')
  activateTemplate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.templates.setActive(orgId, id, true)
  }

  @Post('templates/:id/deactivate')
  @RequirePermissions('notifications.manage')
  deactivateTemplate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.templates.setActive(orgId, id, false)
  }

  @Post('templates/preview')
  @RequirePermissions('notifications.read')
  previewTemplate(@CurrentUser('orgId') orgId: string, @Body() dto: PreviewNotificationTemplateDto) {
    return this.templates.preview(orgId, dto.key, dto.channel, dto.variables)
  }
}
