# Deployment Guide

> Milestone 19.5. Companion documents: [Operations](./operations.md),
> [Monitoring](./monitoring.md), [Disaster Recovery](./disaster-recovery.md),
> [Runbook](./runbook.md), [Production Checklist](./production-checklist.md).

## What ships

| Component | Image | Port | Notes |
|---|---|---|---|
| `api` | built from `apps/api/Dockerfile` (`production` target) | 4000 (internal) | NestJS on Fastify, runs unprivileged as uid 1001 |
| `web` | built from `apps/web/Dockerfile` (`production` target) | 3000 (internal) | Next.js standalone output |
| `nginx` | `nginx:alpine` | 80, 443 | TLS termination, the only published surface |
| `postgres` | `postgres:16-alpine` | none | omit and use a managed instance if you have one |
| `redis` | `redis:7-alpine` | none | AOF on — it holds live sessions |

Neither `api` nor `web` publishes a port. nginx is the only way in.

## 1. Generate the secrets

```bash
# RS256 keypair for access tokens (base64-encoded PEMs)
pnpm --filter @medicore/api keys:generate

# 48-byte cookie secret, and a metrics scrape token
openssl rand -base64 48
openssl rand -hex 32
```

The API **refuses to boot** if `COOKIE_SECRET` is missing, shorter than 32
characters, or still the value shipped in `app.config.ts`; likewise if the JWT
keypair is absent. See `apps/api/src/config/env.validation.ts` — the full list
of rules is there, and it is the authority, not this table.

## 2. Write the environment file

```bash
cp docs/operations/production.env.example .env.production
$EDITOR .env.production
chmod 600 .env.production
```

Required (boot fails without them): `DATABASE_URL`, `JWT_PRIVATE_KEY`,
`JWT_PUBLIC_KEY`, `COOKIE_SECRET`, `REDIS_HOST`, `FRONTEND_URL`,
`NEXT_PUBLIC_API_URL`, `POSTGRES_*`, `REDIS_PASSWORD`.

Strongly recommended: `METRICS_TOKEN` (without it `/api/metrics` returns 404 in
production), `STORAGE_PROVIDER=s3` (without it uploaded clinical documents live
on the container filesystem and are lost when it is replaced), and
`SWAGGER_ENABLED=false` (the default in production).

## 3. TLS certificates

```bash
mkdir -p infra/nginx/ssl
# Place fullchain.pem and privkey.pem there — Let's Encrypt, or your own CA.
```

The HTTP server block serves `/.well-known/acme-challenge/` from
`/var/www/certbot` and redirects everything else to HTTPS, so an ACME HTTP-01
renewal works without taking the site down.

## 4. Apply migrations, then start

Migrations run as a **separate step, before** the new API starts. They are not
run by the application on boot: an application that migrates on startup will,
during a rolling deploy, have two versions racing on the same schema.

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm api npx prisma migrate deploy --schema ./prisma/schema.prisma
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

## 5. Verify

```bash
curl -fsS https://<host>/healthz                 # nginx itself
curl -fsS https://<host>/api/health/live         # API process
curl -fsS https://<host>/api/health/ready | jq   # API + Postgres + Redis
curl -fsS -H "Authorization: Bearer $METRICS_TOKEN" https://<host>/api/metrics | head
docker compose -f docker-compose.prod.yml logs api | grep '\[startup\]'
```

The last command prints the boot warnings — a log-only SMS driver, an HTTP
origin, container-local storage, AI enabled against a third-party provider.
None of them stop the boot; all of them are things you should have decided
deliberately.

## First deployment only

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production \
  run --rm api node -e "require('./node_modules/@medicore/database/dist/seed.js')"
```

Seeding creates the permission catalogue, the default roles and the
`medicore-platform` organization holding the platform owner. Change that
account's password immediately — see the [Production Checklist](./production-checklist.md).

## Rolling out a new version

1. Merge to `main`; CI must be green (the `CI` job is the one to require).
2. `docker compose … build`
3. `docker compose … run --rm api npx prisma migrate deploy` — **backwards
   compatible migrations only**, since the old version is still serving.
4. `docker compose … up -d api web`
5. Watch `/api/health/ready` and the error rate for ten minutes.

`SIGTERM` starts a graceful drain: readiness flips to 503 immediately, the
process keeps serving for `SHUTDOWN_DRAIN_MS` (default 5s), background email
tasks are awaited, then connections close. `stop_grace_period` is 30s, so the
drain always completes.

## Rolling back

Application rollback is `docker compose up -d` with the previous image tag.
**Schema rollback is not symmetric** — see
[Disaster Recovery](./disaster-recovery.md#rolling-back-a-migration).

## Scaling beyond one instance

Two things are per-process today and must be understood before running
replicas:

- **Rate limiting** is in-memory (`@nestjs/throttler`'s default storage), so N
  instances mean N × the configured limit. TD-0067.
- **The notification worker** ticks in every instance. Claiming is a
  compare-and-set on `notification_deliveries`, so a delivery is still sent
  once — but every instance polls. TD-0068.

Both are correct-but-wasteful rather than broken. Neither blocks a
single-instance production deployment.
