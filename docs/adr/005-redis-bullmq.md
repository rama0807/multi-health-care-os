# ADR-005: Redis + BullMQ for Caching and Job Queues

**Status:** Accepted  
**Date:** 2024-01-15

---

## Context

We need:
1. Fast ephemeral storage for sessions, rate limiting, and caching
2. Reliable background job processing (emails, AI tasks, PDF generation)
3. Scheduled jobs (appointment reminders, report generation)

## Decision

**Redis 7** for caching and session storage. **BullMQ** for job queuing (BullMQ uses Redis as its backing store).

## Rationale

### Redis for Caching

Redis's in-memory data structures match our use cases exactly:
- **Strings** — JWT blacklist, OTP storage, rate limit counters
- **Hashes** — Session data, user permissions cache
- **Sorted Sets** — Rate limiting with sliding window
- **Lists** — Audit log streaming buffer

TTL support at the key level means cache expiration is automatic — no background cleanup jobs needed.

**Alternative considered:** Memcached. Rejected because it lacks persistence (we need refresh tokens to survive restarts), has no pub/sub, and doesn't support complex data structures.

### BullMQ for Job Queues

BullMQ is the successor to Bull, designed for TypeScript and modern Node.js:

```typescript
// Producer
const reportQueue = new Queue('reports', { connection: redis })
await reportQueue.add('generate-pdf', { invoiceId: 'inv_123' }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  delay: 0,
})

// Consumer
const worker = new Worker('reports', async (job) => {
  const pdf = await generateInvoicePdf(job.data.invoiceId)
  await storePdfToS3(pdf)
}, { connection: redis })
```

Key advantages:
- **Durability:** Jobs persist in Redis — a worker crash doesn't lose the job
- **Retry logic:** Exponential backoff with configurable attempts
- **Priority queues:** Emergency notifications before report generation
- **Delayed jobs:** Schedule appointment reminders 24h in advance
- **Repeatable jobs:** Daily report generation, cleanup tasks
- **Bull Board:** Visual dashboard for monitoring job queues

**Alternative considered:** RabbitMQ. More powerful for complex routing, but adds operational complexity (separate service, different API). BullMQ on Redis is sufficient for our workload and reduces infrastructure dependencies.

**Alternative considered:** AWS SQS (in cloud deployment). Valid for production, but BullMQ works locally, in staging, and in production without changing code — SQS would require local simulation.

## Consequences

- Redis is a required dependency (not optional) — sessions break without it
- BullMQ workers run inside the same NestJS process in development; as separate processes in production
- Redis cluster mode supported for high availability in production
