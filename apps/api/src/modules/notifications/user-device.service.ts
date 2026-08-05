import { DevicePlatform, PushConfigStatus, RegisterDeviceDto, UserDevice } from '@medicore/types'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { UserDevice as PrismaUserDevice } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { FcmPushProvider } from './channels/fcm-push.provider'

/**
 * Push device registry (Checkpoint 18.2).
 *
 * One user has many devices — a browser profile is a device, and clinicians
 * routinely use a ward workstation and a personal laptop. Registration is
 * idempotent on the token: FCM issues a token to exactly one installation, so
 * a token that reappears means the installation moved to a different user or
 * device, and the existing row is re-pointed rather than duplicated.
 *
 * Tokens are never returned to the client. `tokenSuffix` is enough to tell two
 * devices apart in the UI without handing back a credential that can be used
 * to push to someone else's browser.
 */
@Injectable()
export class UserDeviceService {
  private readonly logger = new Logger(UserDeviceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcm: FcmPushProvider,
  ) {}

  /** What the browser needs before it can subscribe, or why it cannot. */
  pushConfig(): PushConfigStatus {
    const reason = this.fcm.browserPushReason()
    return {
      configured: reason === null,
      vapidPublicKey: this.fcm.vapidPublicKey(),
      projectId: this.fcm.projectId(),
      reason,
    }
  }

  async register(
    organizationId: string,
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<UserDevice> {
    const row = await this.prisma.userDevice.upsert({
      where: { token: dto.token },
      create: {
        organizationId,
        userId,
        token: dto.token,
        platform: dto.platform,
        deviceName: dto.deviceName ?? null,
        browser: dto.browser ?? null,
        osName: dto.osName ?? null,
        userAgent: dto.userAgent ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        // Re-pointing covers both a token refresh and the same browser being
        // used by a different account.
        organizationId,
        userId,
        platform: dto.platform,
        deviceName: dto.deviceName ?? null,
        browser: dto.browser ?? null,
        osName: dto.osName ?? null,
        userAgent: dto.userAgent ?? null,
        isActive: true,
        deactivatedAt: null,
        lastSeenAt: new Date(),
      },
    })

    return toResponse(row)
  }

  /** Called on every heartbeat from a live tab, so stale devices are visible. */
  async touch(userId: string, token: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { userId, token },
      data: { lastSeenAt: new Date() },
    })
  }

  async list(userId: string): Promise<UserDevice[]> {
    const rows = await this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { lastSeenAt: 'desc' }],
    })
    return rows.map(toResponse)
  }

  /** Active tokens for a recipient — what the FCM provider fans out over. */
  async activeTokens(userId: string): Promise<string[]> {
    const rows = await this.prisma.userDevice.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    })
    return rows.map((row) => row.token)
  }

  async deactivate(userId: string, deviceId: string): Promise<UserDevice> {
    const existing = await this.prisma.userDevice.findFirst({ where: { id: deviceId, userId } })
    if (!existing) throw new NotFoundException('Device not found')

    const row = await this.prisma.userDevice.update({
      where: { id: deviceId },
      data: { isActive: false, deactivatedAt: new Date() },
    })
    return toResponse(row)
  }

  /** Removes a token the user's own browser reports as unsubscribed. */
  async deactivateByToken(userId: string, token: string): Promise<void> {
    await this.prisma.userDevice.updateMany({
      where: { userId, token },
      data: { isActive: false, deactivatedAt: new Date() },
    })
  }

  /**
   * Deactivates tokens FCM reported as permanently gone. Rows are kept, not
   * deleted, so delivery history keeps pointing at something real.
   */
  async markTokensInvalid(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return
    const result = await this.prisma.userDevice.updateMany({
      where: { token: { in: tokens }, isActive: true },
      data: { isActive: false, deactivatedAt: new Date() },
    })
    if (result.count > 0) {
      this.logger.log(`Deactivated ${result.count} push device(s) reported unregistered by FCM`)
    }
  }
}

function toResponse(row: PrismaUserDevice): UserDevice {
  return {
    id: row.id,
    platform: row.platform as DevicePlatform,
    deviceName: row.deviceName,
    browser: row.browser,
    osName: row.osName,
    isActive: row.isActive,
    lastSeenAt: row.lastSeenAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    tokenSuffix: row.token.slice(-8),
  }
}
