import { Injectable, Logger } from '@nestjs/common'

import { MetricsService } from '../observability/metrics.service'
import { RequestContextService } from '../observability/request-context.service'

/**
 * Runs work off the request path (Milestone 19.3 / ADR-0030).
 *
 * The problem it solves is narrow and real: several handlers awaited an
 * outbound email before answering. That coupled a user-facing response to a
 * third-party provider's latency, and - where the call was not wrapped in a
 * `.catch()` - coupled the request's *success* to it too, so a provider outage
 * turned "your account was created" into a 500 for an account that had in fact
 * been created.
 *
 * What this deliberately is **not** is a second queue. Durable, retried,
 * observable delivery already exists: the `notification_deliveries` table
 * (ADR-0027), and anything that must survive a restart belongs there. This is
 * for work that is genuinely fire-and-forget - a welcome email, an invite -
 * where losing one on a hard kill is acceptable and re-triggering it is a
 * button the product already has.
 *
 * What it adds over a bare `void promise` (the pattern it replaces):
 *
 * - a rejection is **logged with the originating request's correlation ids**,
 *   instead of surfacing as an unhandled rejection with no context - or, in
 *   the `.catch(() => undefined)` cases, vanishing entirely;
 * - every run is counted in `medicore_background_runs_total{job,outcome}`, so
 *   "emails silently stopped sending" is a graph rather than a support ticket;
 * - the async context is captured before the handler returns, which is what
 *   makes those ids available at all once the request has finished.
 */
@Injectable()
export class BackgroundTaskService {
  private readonly logger = new Logger(BackgroundTaskService.name)

  /** In-flight tasks, awaited on shutdown so a drain does not cut them off. */
  private readonly inFlight = new Set<Promise<void>>()

  constructor(
    private readonly metrics: MetricsService,
    private readonly requestContext: RequestContextService,
  ) {}

  /**
   * Schedules `work` and returns immediately. Never rejects - a caller that
   * `void`s this must not be able to produce an unhandled rejection.
   */
  run(job: string, work: () => Promise<unknown>): void {
    // Captured now, while the request's async context is still current.
    const correlation = this.requestContext.get()

    const task = (async () => {
      try {
        await work()
        this.metrics.recordBackgroundRun(job, 'success')
      } catch (error) {
        this.metrics.recordBackgroundRun(job, 'failure')
        const requestId = correlation?.requestId ?? '-'
        const traceId = correlation?.trace.traceId ?? '-'
        this.logger.error(
          `Background task "${job}" failed [requestId=${requestId} traceId=${traceId}]: ` +
            `${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    })()

    this.inFlight.add(task)
    void task.finally(() => this.inFlight.delete(task))
  }

  /** How many tasks are still running - used by the shutdown drain and tests. */
  get pending(): number {
    return this.inFlight.size
  }

  /**
   * Waits for everything currently in flight. Called during a graceful
   * shutdown so a welcome email already handed to this service is not lost to
   * a deploy, and used by tests to assert on the result of a scheduled task.
   */
  async drain(): Promise<void> {
    await Promise.all([...this.inFlight])
  }
}
