import { Injectable, Logger } from '@nestjs/common'

import { RedisService } from './redis.service'

/**
 * Read-through JSON caching over the Redis connection this application
 * already owns (Milestone 19.2 / ADR-0030).
 *
 * Three rules keep it from becoming a source of stale clinical data:
 *
 * 1. **Every key is tenant-scoped.** `key()` refuses to build one without an
 *    organization id, so a cached read cannot leak across tenants — the one
 *    failure mode that would matter more than any latency it saves.
 * 2. **Redis being down is a cache miss, never an error.** A caching layer
 *    that can fail a request is a new outage source, not an optimisation, so
 *    every operation degrades to calling the loader.
 * 3. **Nothing patient-identifiable is cached.** The call sites are
 *    configuration-shaped data — templates, settings — that changes on an
 *    explicit admin action, which is what makes invalidation exact rather
 *    than a guessed TTL.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)

  constructor(private readonly redis: RedisService) {}

  /** `medicore:cache:<org>:<namespace>[:<suffix>]` — one shape, everywhere. */
  key(organizationId: string, namespace: string, suffix?: string): string {
    if (!organizationId) {
      throw new Error('CacheService keys must be tenant-scoped — organizationId is required')
    }
    return `medicore:cache:${organizationId}:${namespace}${suffix ? `:${suffix}` : ''}`
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(key)
      return raw === null ? undefined : (JSON.parse(raw) as T)
    } catch (error) {
      // Covers both a Redis failure and a value written by an older code
      // version whose shape no longer parses — either way, miss and reload.
      this.logger.debug(`Cache read failed for ${key}: ${(error as Error).message}`)
      return undefined
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), ttlSeconds)
    } catch (error) {
      this.logger.debug(`Cache write failed for ${key}: ${(error as Error).message}`)
    }
  }

  /**
   * The read-through path. `undefined` from the loader is cached as a genuine
   * "there is nothing here" — the alternative would re-query the database on
   * every request for exactly the lookups that miss most often.
   */
  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<{ v: T }>(key)
    if (cached !== undefined) return cached.v

    const value = await loader()
    await this.set(key, { v: value }, ttlSeconds)
    return value
  }

  async del(...keys: string[]): Promise<void> {
    try {
      await this.redis.del(...keys)
    } catch (error) {
      this.logger.debug(`Cache delete failed: ${(error as Error).message}`)
    }
  }

  /**
   * Drops every key under a prefix, for invalidations that cannot name the
   * exact key (an admin edits one template; the cache holds one entry per
   * type *and* per locale).
   *
   * Uses `SCAN`, never `KEYS`: `KEYS` is O(n) over the whole keyspace and
   * blocks the single-threaded Redis server — on a shared instance that is an
   * outage for every tenant, triggered by one admin saving a form.
   */
  async invalidatePrefix(prefix: string): Promise<number> {
    try {
      const client = this.redis.getClient()
      let cursor = '0'
      let removed = 0

      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200)
        cursor = next
        if (keys.length > 0) {
          await client.del(...keys)
          removed += keys.length
        }
      } while (cursor !== '0')

      return removed
    } catch (error) {
      this.logger.debug(`Cache prefix invalidation failed for ${prefix}: ${(error as Error).message}`)
      return 0
    }
  }
}
