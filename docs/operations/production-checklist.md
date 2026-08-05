# Production Readiness Checklist

> Milestone 19.7. Work through this before the first real deployment.
> Items marked **⛔** are enforced by the API at boot — it will not start.
> Items marked **⚠️** produce a `[startup]` warning that is easy to ignore and
> should not be.

## Secrets and configuration

- [ ] ⛔ `COOKIE_SECRET` is ≥32 characters and is **not** the shipped default
- [ ] ⛔ `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` are a real RS256 keypair
- [ ] ⛔ `DATABASE_URL` and `REDIS_HOST` are set
- [ ] ⛔ `FRONTEND_URL` (or `CORS_ORIGINS`) is set and contains no `*`
- [ ] `.env.production` is `chmod 600`, owned by the deploy user, and not in git
- [ ] Secrets are stored somewhere they can be rotated (not only on the host)
- [ ] `TRUST_PROXY=true` **only** because nginx sets `X-Forwarded-For`

## Transport

- [ ] TLS certificates present at `infra/nginx/ssl/{fullchain,privkey}.pem`
- [ ] HTTP redirects to HTTPS; ACME challenge path reachable
- [ ] Certificate auto-renewal is scheduled **and has been tested once**
- [ ] `curl -I https://<host>/` shows HSTS, `X-Frame-Options: DENY`, `nosniff`
- [ ] `curl -I https://<host>/api/health` shows the API's own CSP
- [ ] An unlisted origin is refused by CORS

## Access

- [ ] The seeded platform-owner password has been changed
- [ ] ⚠️ `SWAGGER_ENABLED=false` (mounting the docs also relaxes the CSP)
- [ ] `/api/metrics` is unreachable from the public internet
- [ ] Postgres and Redis publish **no** host ports
- [ ] Redis has a password (`REDIS_PASSWORD`)
- [ ] Rate limits reviewed against the deployment's NAT topology — a whole
      hospital may share one address

## Data

- [ ] ⚠️ `STORAGE_PROVIDER=s3` — otherwise clinical documents die with the
      container
- [ ] Object storage has versioning enabled
- [ ] Postgres backups are **automated** and land off-host (TD-0070 — MediCore
      ships no scheduler; this is yours to build)
- [ ] WAL archiving / PITR is on, if the 15-minute RPO is a real target
- [ ] A restore has been performed into a scratch environment and verified
- [ ] Migrations run as a deploy step, not on application boot

## Observability

- [ ] ⚠️ `METRICS_TOKEN` is set (otherwise `/api/metrics` 404s in production)
- [ ] Prometheus is scraping and `up{job="medicore-api"} == 1`
- [ ] Alerts from [Monitoring](./monitoring.md) are loaded and routed to a
      human who is actually on call
- [ ] Container logs are shipped off-host and retained per your policy
- [ ] The `[startup]` warnings from the last boot have each been read and
      consciously accepted

## Resilience

- [ ] `docker compose stop api` drains cleanly — readiness 503s first, no
      dropped requests
- [ ] `stop_grace_period` exceeds `SHUTDOWN_DRAIN_MS`
- [ ] Log rotation caps are present on every service
- [ ] Healthchecks pass on a cold start (`start_period` is long enough)
- [ ] Restart policy is `unless-stopped`

## Compliance — read before going live with real patients

These are recorded honestly rather than claimed:

- [ ] **TD-0042** — if AI is enabled against a third-party provider, clinical
      context leaves the deployment. Either a BAA is in place, or
      `AI_PROVIDER=OLLAMA`, or `AI_ENABLED=false`.
- [ ] **TD-0059** — `SMS_DRIVER` / `WHATSAPP_DRIVER` are **not** `LOG`. The log
      driver writes message bodies, which may contain patient context, to the
      application log.
- [ ] **TD-0050** — platform-owner access is revocable per organization, not
      per user. Understand who holds it.
- [ ] **TD-0048** — subscription limits are reported, not enforced. No payment
      is taken.
- [ ] Audit retention meets your jurisdiction's requirement (`audit_logs` is
      append-only and never pruned by the application).
- [ ] Encryption at rest is enabled on the database volume and the bucket —
      MediCore relies on the infrastructure for this and does not encrypt
      columns itself.

## Known limits at this scale

- [ ] **TD-0067** — rate limiting is per-process; N replicas mean N × the limit
- [ ] **TD-0068** — every instance runs the notification worker; delivery is
      still exactly-once, but polling is duplicated
- [ ] **TD-0069** — trace context is propagated but no OpenTelemetry SDK
      exports spans
- [ ] **TD-0046** — API usage metering is a rolling Redis window, not a
      billing ledger

## Sign-off

| | Name | Date |
|---|---|---|
| Engineering | | |
| Clinical lead | | |
| Data protection / compliance | | |
