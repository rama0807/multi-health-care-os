# Disaster Recovery

> Milestone 19.5. **Honest scope statement:** this document specifies the
> procedure and the targets. MediCore ships no backup automation — no cron, no
> snapshot scheduler, no off-site replication. Everything below must be
> implemented against your infrastructure before the deployment is genuinely
> recoverable. That gap is recorded as **TD-0070**, not glossed over.

## Targets

| | Target | Rationale |
|---|---|---|
| **RPO** (data loss) | ≤ 15 minutes | one clinic-hour of consultations, orders and charges |
| **RTO** (downtime) | ≤ 2 hours | a hospital can run on paper for a shift, not a day |

Nightly `pg_dump` alone gives an RPO of up to 24 hours. Meeting 15 minutes
requires continuous WAL archiving (PITR) or a managed instance with it enabled.

## What must be backed up

| Store | Contents | Loss if unrecoverable |
|---|---|---|
| **Postgres** | every clinical, billing and audit record | catastrophic and unreconstructable |
| **Object storage** | uploaded documents, lab/radiology reports, generated PDFs | clinical attachments; the rows referencing them survive and dangle |
| **Secrets** | `.env.production`, JWT keypair, cookie secret | recoverable by rotation, at the cost of logging every user out |
| **Redis** | sessions, rate-limit counters, cache | **not backed up, by design** — a cold Redis logs everyone out and nothing else |

## Postgres

### Nightly logical backup

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -Z 6 \
  > medicore-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Encrypt at rest, ship off-host, retain 30 daily / 12 monthly. A backup on the
same host is not a backup.

### Point-in-time recovery

Enable WAL archiving on the Postgres instance (`archive_mode = on`,
`archive_command` writing to off-host storage) and take a weekly base backup.
This is what turns the RPO from 24 hours into minutes.

### Restore

```bash
docker compose -f docker-compose.prod.yml stop api web       # stop writers first
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists < backup.dump
docker compose -f docker-compose.prod.yml start api web
curl -fsS https://<host>/api/health/ready | jq
```

**Restore to a scratch database first and verify row counts** before touching
production. A restore that silently truncates is worse than the outage.

## Object storage

Enable versioning and cross-region replication on the bucket. If
`STARTUP` warnings showed `STORAGE_PROVIDER` is not `s3`, uploaded documents
are on the container filesystem and are **already** unrecoverable across a
container replacement — fix that before worrying about replication.

## Scenarios

### The API is down, the data is fine

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=200 api
docker compose -f docker-compose.prod.yml up -d --force-recreate api
```

If it will not boot, read the boot error. `Refusing to start — N environment
problem(s)` is the validator doing its job: fix the variable, do not delete
the check.

### Redis is lost

Everyone is logged out; nothing else. Sessions, rate-limit counters and cache
entries are all reconstructible. Bring Redis back, confirm
`/api/health/ready`, tell users to sign in again. Do not restore Redis from a
snapshot to "recover sessions" — a stale session set is worse than none.

### Postgres is lost

1. Announce the outage. Clinical staff need to know they are on paper *now*,
   not after a failed recovery.
2. Stop `api` and `web` so nothing writes to a partially restored database.
3. Restore the latest base backup, then replay WAL to the last safe moment.
4. Verify on a scratch copy: row counts for `patients`, `encounters`,
   `invoices`, `audit_logs`; the most recent `createdAt` in each.
5. Promote, start the app, confirm readiness.
6. Reconcile the gap: everything between the recovery point and the failure
   was entered on paper and must be re-entered. Identify the window precisely
   and hand it to the clinical leads in writing.

### Rolling back a migration

Application rollback is symmetric; schema rollback is not. Prisma's
`migrate deploy` only rolls forward.

- **Additive migration** (new nullable column, new table): roll the
  application back, leave the schema. The new columns sit unused.
- **Destructive migration** (dropped or renamed column, narrowed type): there
  is no rollback. Restore from backup, accepting the data written since. This
  is why destructive migrations are deployed alone, in a maintenance window,
  immediately after a verified backup.

## Test the plan

An untested recovery plan is a document, not a capability. Quarterly:

1. Restore the latest production backup into a scratch environment.
2. Boot the application against it.
3. Log in, open a patient record, confirm the timeline renders.
4. Record the elapsed time. If it exceeds the RTO, the target is wrong or the
   procedure is.
