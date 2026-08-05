# Monitoring Guide

> Milestone 19.4 — what MediCore emits, and what is worth alerting on.

## Scraping

```yaml
scrape_configs:
  - job_name: medicore-api
    scrape_interval: 15s
    metrics_path: /api/metrics
    authorization:
      type: Bearer
      credentials: <METRICS_TOKEN>
    static_configs:
      - targets: ['medicore-api:4000']
```

The endpoint is exempt from rate limiting — a 15-second scrape is exactly the
traffic the global limiter exists to stop, and losing metrics during an
incident is the opposite of what it is for. It is protected twice: the API
requires the bearer token, and nginx restricts `/api/metrics` to private
address ranges.

## Metrics

| Metric | Type | Labels | What it tells you |
|---|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status` | throughput and error rate |
| `http_request_duration_seconds` | histogram | `method`, `route` | latency distribution |
| `http_requests_in_flight` | gauge | `method` | concurrency, saturation |
| `medicore_dependency_up` | gauge | `dependency` | last readiness result per dependency |
| `medicore_background_runs_total` | counter | `job`, `outcome` | background email + worker health |
| `process_*`, `nodejs_*` | various | — | heap, GC, event-loop lag, file descriptors |

`route` is the **matched route pattern** (`/api/v1/patients/:id`), never the
URL. Labelling by URL would mint one time series per patient id — an unbounded
cardinality explosion, and a slow leak of record identifiers into the
monitoring system. For the same reason no metric carries a tenant, user or
patient label; per-tenant usage lives in `ApiUsageService`, not here.

## Alerts worth having

```yaml
groups:
  - name: medicore
    rules:
      - alert: MediCoreDown
        expr: up{job="medicore-api"} == 0
        for: 2m

      - alert: MediCoreDependencyDown
        expr: medicore_dependency_up == 0
        for: 2m
        annotations:
          summary: '{{ $labels.dependency }} is unreachable — readiness is failing'

      - alert: MediCoreHighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m])) > 0.02
        for: 5m

      - alert: MediCoreLatencyRegression
        expr: |
          histogram_quantile(0.95,
            sum by (le) (rate(http_request_duration_seconds_bucket[5m]))) > 2
        for: 10m

      - alert: MediCoreBackgroundWorkFailing
        expr: |
          sum(rate(medicore_background_runs_total{outcome="failure"}[15m]))
            / sum(rate(medicore_background_runs_total[15m])) > 0.1
        for: 15m
        annotations:
          summary: 'Emails or the notification worker are failing — users notice this before you do'

      - alert: MediCoreEventLoopBlocked
        expr: nodejs_eventloop_lag_p99_seconds > 0.5
        for: 5m
```

`MediCoreBackgroundWorkFailing` is the one that earns its keep. Outbound email
used to fail silently — one call site swallowed every error with
`.catch(() => undefined)`. It is now counted, so "confirmations stopped
arriving" is a graph rather than a support ticket a week later.

## Tracing

Every request carries W3C trace context. An inbound `traceparent` is continued
(same `traceId`, a fresh span for this service); when there is none, one is
minted. The header is echoed on the response, and `traceId`/`spanId` appear on
every log line — so logs join to an upstream gateway's traces today.

**No OpenTelemetry SDK is installed.** Spans are not exported to a collector;
what exists is propagation and correlation. Adding the SDK is a deployment
decision and is recorded as TD-0069, not half-built.

## Logs

Ship the container's JSON stdout to your aggregator. Useful saved queries:

- `res.statusCode >= 500` — unhandled failures, each with a `requestId`
- `msg =~ "^Slow query"` — statements over `DB_SLOW_QUERY_MS`, with the request
  that caused them
- `msg =~ "^Background task"` — failed background work
- `msg =~ "^\\[startup\\]"` — boot warnings; read these after every deploy

## Dashboard panels that answer real questions

1. Request rate and error ratio by `route` — which endpoint regressed.
2. p50/p95/p99 latency by `route` — whether it is broad or one handler.
3. `medicore_dependency_up` — a strip chart; correlate blips against error rate.
4. `http_requests_in_flight` against event-loop lag — saturation vs. slow
   dependency.
5. Background success ratio by `job` — email and worker health.
