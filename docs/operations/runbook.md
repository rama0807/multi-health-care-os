# Runbook

> Milestone 19.7 - symptom → diagnosis → action. Start here during an
> incident; the reasoning lives in the other guides.

## First five minutes, whatever the symptom

```bash
curl -fsS https://<host>/healthz                       # nginx up?
curl -fsS https://<host>/api/health/live               # API process up?
curl -fsS https://<host>/api/health/ready | jq         # which dependency?
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 api
```

`/api/health/ready` names the failing dependency. Read it before guessing.

---

## The API will not start

**`Refusing to start - N environment problem(s)`**
The startup validator. Each bullet is a specific variable. Fix it - do not
disable the check; it exists because a production process on a public cookie
secret is a compromise waiting to happen.

**Container restarting, no application logs**
Prisma client missing or a schema mismatch. Rebuild the image; confirm
migrations were applied.

**Healthcheck failing but the API answers**
Check the path: it must be `/api/health/live`. Anything under
`/api/v1/health` will 404 from the container's own `HEALTHCHECK` if the
version prefix changes.

---

## Everything is slow

1. `histogram_quantile(0.95, …http_request_duration_seconds_bucket…)` by
   `route` - one endpoint, or all of them?
2. One endpoint → look for its slow queries:
   `docker compose logs api | jq 'select(.msg | test("^Slow query"))'`
3. All endpoints → check `nodejs_eventloop_lag_p99_seconds` and
   `http_requests_in_flight`. High lag with low in-flight means CPU-bound work
   (PDF generation, a large report). High in-flight with low lag means a slow
   dependency.
4. Check `medicore_dependency_up` for Postgres/Redis blips.

Temporary relief: lower `THROTTLE_LIMIT` to shed load, or set
`NOTIFICATIONS_WORKER_ENABLED=false` to stop background dispatch competing for
the database.

---

## Users are being logged out

- **Redis restarted or was flushed** - sessions live there. Expected; users
  sign in again.
- **`COOKIE_SECRET` changed** - CSRF cookies stop validating on
  refresh/logout. Expected once, then stable.
- **`JWT_PUBLIC_KEY` changed** - every access token is invalid. Expect up to
  15 minutes of 401s while clients refresh.
- **The organization was suspended** - `Organization.isActive = false` is
  enforced on every request, so it logs a whole tenant out immediately. Check
  the platform console before assuming a bug.

---

## 429s from legitimate users

Almost always NAT: a hospital LAN presents one address to the API, and both
the nginx and application limiters key on the client IP.

- Confirm with the `X-RateLimit-*` headers on a 429 response.
- Raise `THROTTLE_LIMIT` / `THROTTLE_AUTH_LIMIT` and recreate the API.
- If `TRUST_PROXY` is unset behind nginx, **every** request appears to come
  from the proxy and one busy user throttles everyone. Set `TRUST_PROXY=true`
  - but only when a proxy you control sets `X-Forwarded-For`, otherwise any
  caller can spoof their address.

---

## Emails are not arriving

They are sent off the request path, so a failure never surfaces as a user
error.

```bash
docker compose logs api | jq 'select(.msg | test("^Background task"))'
```

Check `medicore_background_runs_total{outcome="failure"}` for the rate, and
`RESEND_API_KEY` / `EMAIL_FROM` for configuration. In-app notifications use a
different path - the `notification_deliveries` table - and the admin console's
"Failed deliveries" tab shows those with a per-channel reason.

---

## Notifications are queued but not delivered

1. Is the worker on? `NOTIFICATIONS_WORKER_ENABLED`.
2. `medicore_background_runs_total{job="notifications.tick"}` - is it ticking,
   and is `outcome="failure"` climbing?
3. Organization console → Notifications → Failed deliveries, which reports the
   provider's own reason per channel.
4. `SKIPPED` is not a failure: quiet hours, a muted category or a missing
   address suppress a channel deliberately.

---

## `/api/metrics` returns 404 or 403

- **404 in production** - `METRICS_TOKEN` is unset. The endpoint fails closed
  rather than serving openly. Set it and recreate.
- **403** - the token is wrong, or the header is not `Authorization: Bearer …`.
- **Connection refused from outside** - nginx restricts the path to private
  networks. Scrape from inside them.

---

## Disk is filling

- Container logs: capped at 50MB × 5 per service in `docker-compose.prod.yml`.
  If the cap is missing on a service, that is the cause.
- Postgres WAL: an `archive_command` that keeps failing will fill the volume.
  Check `pg_stat_archiver`.
- Uploads: only when `STORAGE_PROVIDER` is not `s3` - which also means those
  documents are not backed up. Fix both together.

---

## Escalation

| Situation | Action |
|---|---|
| Data loss suspected | Stop writers immediately, then [Disaster Recovery](./disaster-recovery.md). Do not "try one more thing" against a live database. |
| Suspected breach | Rotate `COOKIE_SECRET` + JWT keypair (logs everyone out), pull the audit log for the window, preserve the container logs before they rotate. |
| A tenant reports another tenant's data | Treat as a Sev-1 breach. Capture the `requestId` from the user's error or browser network tab; it identifies the exact request in the logs. |
