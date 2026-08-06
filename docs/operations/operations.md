# Operations Guide

> Milestone 19.5 - day-two operation of a running MediCore deployment.

## Endpoints an operator uses

| Path | Auth | Purpose |
|---|---|---|
| `GET /healthz` | none | nginx is alive (static, never reaches the API) |
| `GET /api/health/live` | none | the API process is alive - **checks no dependency** |
| `GET /api/health/ready` | none | API + Postgres + Redis; 503 while draining |
| `GET /api/health` | none | detailed; also mounted at `/api/v1/health` |
| `GET /api/metrics` | `Bearer $METRICS_TOKEN` | Prometheus exposition |

**Liveness and readiness are not interchangeable.** A liveness failure means
"restart this container". A readiness failure means "stop sending it traffic,
leave it running". Wiring a database check into liveness is how a five-minute
Postgres blip becomes a full restart of every API instance - which removes the
capacity that would have served traffic the moment the database returned.

## Configuration you can change without a code deploy

Everything below is read from the environment at boot; changing it means
recreating the container, not rebuilding the image.

| Variable | Default | Effect |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug` for an incident; revert afterwards - it is verbose and costs money in a log sink |
| `DB_SLOW_QUERY_MS` | `300` | threshold for slow-query warnings; `0` disables |
| `THROTTLE_LIMIT` / `THROTTLE_AUTH_LIMIT` | `100` / `20` | per-IP budgets per minute |
| `SHUTDOWN_DRAIN_MS` | `5000` | how long to serve after `SIGTERM` before closing |
| `NOTIFICATIONS_WORKER_ENABLED` | on | turn the delivery worker off without stopping the API |
| `SWAGGER_ENABLED` | off in production | mounting the docs also relaxes the CSP |
| `AI_ENABLED` | off | global kill switch for every AI endpoint |

## Reading the logs

Logs are JSON (pino) in production. Every line from a request carries
`requestId`, `traceId`, `spanId`, and - once authentication has resolved -
`organizationId` and `userId`.

```bash
# Everything about one request, across nginx and the API
docker compose -f docker-compose.prod.yml logs api | grep '"requestId":"<id>"'

# 5xx only
docker compose logs api | jq 'select(.res.statusCode >= 500)'

# Slow queries
docker compose logs api | jq 'select(.msg | test("^Slow query"))'

# Failed background work (emails)
docker compose logs api | jq 'select(.msg | test("^Background task"))'
```

The id in a user's error message (`meta.requestId` in the response body, and
the `X-Request-ID` response header) is the same id that appears in the logs.
A caller-supplied `X-Request-ID` is honoured after validation, so a gateway,
the front end and the API all report one id for one user action.

**What is never logged:** `Authorization`, `Cookie`, `X-CSRF-Token` and
`Set-Cookie` are redacted at the pino level. Slow-query logging prints the
parameterised SQL only, never the bound values - those are patient
identifiers, names and clinical codes.

## Routine tasks

### Rotating the cookie secret

Recreate the API with a new `COOKIE_SECRET`. Existing CSRF cookies stop
validating, so every user with an open tab gets one 403 on their next
refresh/logout and then re-authenticates. Do it in a quiet window.

### Rotating the JWT keypair

Access tokens are RS256-signed and live 15 minutes. Replacing the keypair
invalidates every outstanding access token immediately; refresh tokens live in
Redis and survive, so clients recover on their next refresh. Expect a burst of
401s for up to 15 minutes.

### Rotating the metrics token

Change `METRICS_TOKEN`, recreate the API, update the Prometheus scrape config.
A stale token produces 403s, not a silent gap - the `up` metric goes to 0.

### Suspending a tenant

Platform console → Organizations → Suspend. This sets
`Organization.isActive = false`, which `JwtStrategy.validate` already enforces
on **every request**, so it takes effect immediately rather than at token
expiry. No deployment or restart is involved.

### Draining an instance for maintenance

`docker compose stop api` sends `SIGTERM`, which flips readiness to 503 before
anything stops serving. If you need a longer drain than 5s, raise
`SHUTDOWN_DRAIN_MS` **and** `stop_grace_period` together - Docker kills the
process when the grace period expires regardless of what the drain is doing.

## Capacity notes

- **Rate limiting is per-process.** Two API replicas mean twice the configured
  budget (TD-0067).
- **The notification worker runs in every instance.** Claiming is a
  compare-and-set, so nothing is delivered twice, but every instance polls
  (TD-0068).
- **API usage metering is a rolling Redis window, not a billing ledger**
  (TD-0046). Do not invoice from it.
- **Storage usage sums recorded file sizes, not bucket contents** (TD-0047).
