import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'

import { currentRequestContext } from '../common/observability/request-context.service'

/**
 * How slow a statement has to be before it is logged, in milliseconds.
 * `DB_SLOW_QUERY_MS=0` turns the instrumentation off entirely, which is the
 * default under test — every statement would otherwise emit an event that no
 * assertion reads, on a database whose timings mean nothing.
 */
const SLOW_QUERY_MS = Number.parseInt(
  process.env.DB_SLOW_QUERY_MS ?? (process.env.NODE_ENV === 'test' ? '0' : '300'),
  10,
)

/** Query text is truncated — a report's `IN (...)` list can run to kilobytes. */
const MAX_LOGGED_QUERY_LENGTH = 500

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      // Emitted as events rather than written by Prisma's own logger, so slow
      // statements land in the same structured stream as everything else and
      // can carry the request that caused them (Milestone 19.2).
      log: SLOW_QUERY_MS > 0 ? [{ emit: 'event', level: 'query' }] : [],
    })
  }

  async onModuleInit() {
    if (SLOW_QUERY_MS > 0) {
      this.$on('query', (event) => this.logSlowQuery(event))
    }
    await this.$connect()
  }

  /**
   * The one thing that makes a slow-query log actionable: the request id.
   * A 900ms statement is an interesting fact; a 900ms statement belonging to
   * `GET /api/v1/reports/billing` for a known request is a lead.
   *
   * Only the parameterised SQL is logged, never `event.params` — the values
   * bound into a MediCore query are patient identifiers, names and clinical
   * codes, and a log sink is not a place to put them.
   */
  private logSlowQuery(event: Prisma.QueryEvent): void {
    if (event.duration < SLOW_QUERY_MS) return

    const context = currentRequestContext()
    const where = context ? `${context.method} ${context.url}` : 'background'
    const correlation = context ? ` requestId=${context.requestId} traceId=${context.trace.traceId}` : ''
    const query =
      event.query.length > MAX_LOGGED_QUERY_LENGTH
        ? `${event.query.slice(0, MAX_LOGGED_QUERY_LENGTH)}…`
        : event.query

    this.logger.warn(`Slow query ${event.duration}ms [${where}${correlation}]: ${query}`)
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`
      return true
    } catch {
      return false
    }
  }
}
