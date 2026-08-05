import { Injectable, Logger } from '@nestjs/common'

import { RedisService } from '../redis/redis.service'

/**
 * Per-organization API request metering (Checkpoint 16.2).
 *
 * Counters live in Redis, not Postgres: incrementing a row on every single API
 * request would add a write to every read, which is a real cost this repo
 * hasn't paid anywhere else. The trade-off is disclosed rather than hidden —
 * this is a **rolling 30-day window** (keys expire after 35 days) and the data
 * does not survive a Redis flush. It is genuine measured traffic, not an
 * estimate, but it is not a durable billing ledger. See TECH_DEBT TD-0046.
 */
@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name)

  /** Days of history the read APIs report. Keys are kept slightly longer. */
  static readonly WINDOW_DAYS = 30
  private static readonly KEY_TTL_SECONDS = 35 * 24 * 60 * 60

  constructor(private readonly redis: RedisService) {}

  static dayKey(organizationId: string, date: Date): string {
    return `apiusage:${organizationId}:${toIsoDay(date)}`
  }

  /**
   * Best-effort — a metering failure must never fail the request it is
   * measuring, the same "don't fail the primary action" idiom as
   * `AppointmentInvoiceListener` (ADR-0015) and `DispenseService`.
   */
  async increment(organizationId: string, at: Date = new Date()): Promise<void> {
    try {
      const client = this.redis.getClient()
      const key = ApiUsageService.dayKey(organizationId, at)
      const count = await client.incr(key)
      // Only set the expiry when the key is newly created, so a busy day's TTL
      // isn't pushed forward on every request.
      if (count === 1) {
        await client.expire(key, ApiUsageService.KEY_TTL_SECONDS)
      }
    } catch (error) {
      this.logger.warn(`API usage metering failed for org ${organizationId}: ${String(error)}`)
    }
  }

  /** Daily request counts for one organization, oldest first. */
  async getDaily(
    organizationId: string,
    days = ApiUsageService.WINDOW_DAYS,
    now: Date = new Date(),
  ): Promise<Array<{ date: string; requests: number }>> {
    const dates = recentDays(days, now)
    try {
      const values = await this.redis
        .getClient()
        .mget(...dates.map((d) => `apiusage:${organizationId}:${d}`))
      return dates.map((date, i) => ({ date, requests: Number(values[i] ?? 0) || 0 }))
    } catch (error) {
      this.logger.warn(`API usage read failed for org ${organizationId}: ${String(error)}`)
      return dates.map((date) => ({ date, requests: 0 }))
    }
  }

  async getTotal(
    organizationId: string,
    days = ApiUsageService.WINDOW_DAYS,
    now: Date = new Date(),
  ): Promise<number> {
    const daily = await this.getDaily(organizationId, days, now)
    return daily.reduce((sum, d) => sum + d.requests, 0)
  }

  /**
   * Cross-tenant rollup for the platform console. Reads the same per-org keys
   * rather than maintaining a second global counter, so the two figures can
   * never disagree.
   */
  async getTotalsByOrganization(
    organizationIds: string[],
    days = ApiUsageService.WINDOW_DAYS,
    now: Date = new Date(),
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>()
    if (organizationIds.length === 0) return result

    const dates = recentDays(days, now)
    const keys = organizationIds.flatMap((orgId) => dates.map((d) => `apiusage:${orgId}:${d}`))

    try {
      const values = await this.redis.getClient().mget(...keys)
      organizationIds.forEach((orgId, orgIndex) => {
        const offset = orgIndex * dates.length
        let total = 0
        for (let i = 0; i < dates.length; i++) {
          total += Number(values[offset + i] ?? 0) || 0
        }
        result.set(orgId, total)
      })
    } catch (error) {
      this.logger.warn(`API usage rollup failed: ${String(error)}`)
      organizationIds.forEach((orgId) => result.set(orgId, 0))
    }

    return result
  }

  /** Platform-wide daily totals across every supplied organization. */
  async getPlatformDaily(
    organizationIds: string[],
    days = ApiUsageService.WINDOW_DAYS,
    now: Date = new Date(),
  ): Promise<Array<{ date: string; requests: number }>> {
    const dates = recentDays(days, now)
    if (organizationIds.length === 0) return dates.map((date) => ({ date, requests: 0 }))

    const keys = organizationIds.flatMap((orgId) => dates.map((d) => `apiusage:${orgId}:${d}`))

    try {
      const values = await this.redis.getClient().mget(...keys)
      const perDay = dates.map(() => 0)
      organizationIds.forEach((_, orgIndex) => {
        const offset = orgIndex * dates.length
        for (let i = 0; i < dates.length; i++) {
          perDay[i] += Number(values[offset + i] ?? 0) || 0
        }
      })
      return dates.map((date, i) => ({ date, requests: perDay[i] }))
    } catch (error) {
      this.logger.warn(`Platform API usage read failed: ${String(error)}`)
      return dates.map((date) => ({ date, requests: 0 }))
    }
  }
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** `days` ISO day strings ending today, oldest first. */
function recentDays(days: number, now: Date): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    out.push(toIsoDay(d))
  }
  return out
}
