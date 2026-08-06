import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client'

/**
 * Prometheus metrics (Milestone 19.4 / ADR-0029).
 *
 * A **private** registry rather than `prom-client`'s global default: the
 * global one is process-wide mutable state, which makes a second `TestingModule`
 * in the same Jest worker throw "metric already registered" and turns an
 * unrelated test into a failing one. Owning the registry also means
 * `reset()` is available to tests.
 *
 * What is deliberately *not* here: anything labelled with a patient, user or
 * organization identifier. Prometheus keeps one time series per label
 * combination forever, so a tenant-labelled counter is both a cardinality
 * problem and a way for operational telemetry to start describing clinical
 * activity. Per-tenant usage already has a home - `ApiUsageService`.
 */
@Injectable()
export class MetricsService implements OnModuleDestroy {
  readonly registry = new Registry()

  /** Route label is the *pattern* (`/api/v1/patients/:id`), never the URL. */
  private readonly httpRequests: Counter<'method' | 'route' | 'status'>
  private readonly httpDuration: Histogram<'method' | 'route'>
  private readonly httpInFlight: Gauge<'method'>
  private readonly dependencyUp: Gauge<'dependency'>
  private readonly backgroundRuns: Counter<'job' | 'outcome'>

  constructor() {
    this.registry.setDefaultLabels({ service: 'medicore-api' })
    // Process, heap, GC and event-loop-lag series - the half of an incident
    // that application counters cannot explain. Skipped under test, where
    // every `TestingModule` would otherwise attach its own event-loop monitor.
    if (process.env.NODE_ENV !== 'test') {
      collectDefaultMetrics({ register: this.registry })
    }

    this.httpRequests = new Counter({
      name: 'http_requests_total',
      help: 'HTTP requests handled, by route pattern and status code',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    })

    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request latency in seconds, by route pattern',
      labelNames: ['method', 'route'],
      // Tuned for an API whose slowest routine work is PDF generation and
      // report aggregation; the 10s bucket is what makes a timeout visible.
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    })

    this.httpInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Requests currently being handled',
      labelNames: ['method'],
      registers: [this.registry],
    })

    this.dependencyUp = new Gauge({
      name: 'medicore_dependency_up',
      help: 'Readiness of each external dependency (1 up, 0 down)',
      labelNames: ['dependency'],
      registers: [this.registry],
    })

    this.backgroundRuns = new Counter({
      name: 'medicore_background_runs_total',
      help: 'Background job executions, by job name and outcome',
      labelNames: ['job', 'outcome'],
      registers: [this.registry],
    })
  }

  startRequest(method: string): void {
    this.httpInFlight.inc({ method })
  }

  recordRequest(method: string, route: string, status: number, durationSeconds: number): void {
    this.httpInFlight.dec({ method })
    this.httpRequests.inc({ method, route, status: String(status) })
    this.httpDuration.observe({ method, route }, durationSeconds)
  }

  /** Called by the readiness probe so a scrape reflects the last real check. */
  recordDependency(dependency: string, up: boolean): void {
    this.dependencyUp.set({ dependency }, up ? 1 : 0)
  }

  recordBackgroundRun(job: string, outcome: 'success' | 'failure'): void {
    this.backgroundRuns.inc({ job, outcome })
  }

  scrape(): Promise<string> {
    return this.registry.metrics()
  }

  get contentType(): string {
    return this.registry.contentType
  }

  onModuleDestroy(): void {
    // Stops `collectDefaultMetrics`' interval, which would otherwise keep a
    // Jest worker alive after the testing module is closed.
    this.registry.clear()
  }
}
