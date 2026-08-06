import {
  NotificationCategory,
  NotificationInboxFilter,
  NotificationPriority,
  NotificationQuery,
  NotificationType,
} from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'

import {
  MarkNotificationsDto,
  RegisterDeviceDto,
  UpdateNotificationPreferenceDto,
} from './dto/notification.dto'
import { NotificationHistoryService } from './notification-history.service'
import { NotificationPreferenceService } from './notification-preference.service'
import { UserDeviceService } from './user-device.service'

const INBOX_FILTERS: readonly string[] = ['all', 'unread', 'read', 'archived', 'pinned', 'critical']

/** Narrows raw query strings, dropping anything unrecognised (ADR-0026's rule). */
export function toInboxQuery(query: Record<string, string | undefined>): NotificationQuery {
  return {
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    filter: INBOX_FILTERS.includes(query.filter ?? '')
      ? (query.filter as NotificationInboxFilter)
      : undefined,
    category: query.category ? (query.category as NotificationCategory) : undefined,
    type: query.type ? (query.type as NotificationType) : undefined,
    priority: query.priority ? (query.priority as NotificationPriority) : undefined,
    search: query.search || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
  }
}

/**
 * A user's own notification centre, preferences and devices (Checkpoints 18.2,
 * 18.3 and 18.5).
 *
 * **Deliberately carries no `@RequirePermissions`.** Every one of these routes
 * acts on the caller's own notifications, resolved from the JWT - the same
 * reasoning that leaves `/auth/me` ungated. Requiring a permission would mean
 * a role could be created that cannot read its own inbox, which is never the
 * intent, and the org-wide surfaces live on
 * `NotificationAdminController` behind `notifications.read`/`.manage`.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly history: NotificationHistoryService,
    private readonly preferences: NotificationPreferenceService,
    private readonly devices: UserDeviceService,
  ) {}

  @Get()
  list(@CurrentUser('sub') userId: string, @Query() query: Record<string, string>) {
    return this.history.listForUser(userId, toInboxQuery(query))
  }

  /** Bell state - unread/critical/pinned counts plus a per-category breakdown. */
  @Get('summary')
  summary(@CurrentUser('sub') userId: string) {
    return this.history.summary(userId)
  }

  // ─── Preferences (Checkpoint 18.5) ────────────────────────────────────────

  @Get('preferences')
  getPreferences(@CurrentUser('sub') userId: string, @CurrentUser('orgId') orgId: string) {
    return this.preferences.get(orgId, userId)
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser('sub') userId: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.preferences.update(orgId, userId, dto)
  }

  // ─── Devices (Checkpoint 18.2) ────────────────────────────────────────────

  /** What the browser needs before subscribing, or exactly why it cannot. */
  @Get('devices/push-config')
  pushConfig() {
    return this.devices.pushConfig()
  }

  @Get('devices')
  listDevices(@CurrentUser('sub') userId: string) {
    return this.devices.list(userId)
  }

  @Post('devices')
  registerDevice(
    @CurrentUser('sub') userId: string,
    @CurrentUser('orgId') orgId: string,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.devices.register(orgId, userId, dto)
  }

  @Delete('devices/:deviceId')
  async deactivateDevice(@CurrentUser('sub') userId: string, @Param('deviceId') deviceId: string) {
    return this.devices.deactivate(userId, deviceId)
  }

  // ─── Read / archive / pin ─────────────────────────────────────────────────

  @Post('read')
  async markRead(@CurrentUser('sub') userId: string, @Body() dto: MarkNotificationsDto) {
    return { updated: await this.history.markRead(userId, dto) }
  }

  @Post('read-all')
  async markAllRead(@CurrentUser('sub') userId: string) {
    return { updated: await this.history.markAllRead(userId) }
  }

  @Get(':id')
  get(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.history.getForUser(userId, id)
  }

  @Post(':id/unread')
  markUnread(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.history.markUnread(userId, id)
  }

  @Post(':id/archive')
  archive(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.history.setArchived(userId, id, true)
  }

  @Post(':id/unarchive')
  unarchive(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.history.setArchived(userId, id, false)
  }

  @Post(':id/pin')
  pin(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.history.setPinned(userId, id, true)
  }

  @Post(':id/unpin')
  unpin(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.history.setPinned(userId, id, false)
  }

  @Delete(':id')
  async remove(@CurrentUser('sub') userId: string, @Param('id') id: string) {
    await this.history.remove(userId, id)
    return { deleted: true }
  }
}
