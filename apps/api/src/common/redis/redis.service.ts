import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

export function createRedisClient(configService: ConfigService): Redis {
  return new Redis({
    host: configService.get<string>('redis.host'),
    port: configService.get<number>('redis.port'),
    password: configService.get<string>('redis.password'),
    lazyConnect: false,
  })
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.client.get(key)
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds)
    } else {
      await this.client.set(key, value)
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return
    await this.client.del(...keys)
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1
  }

  /** Atomic read+delete - used for single-use tokens (email verification, password reset). */
  async getdel(key: string): Promise<string | null> {
    // ioredis exposes GETDEL directly on modern Redis; fall back to a small Lua script otherwise.
    if (typeof (this.client as unknown as { getdel?: unknown }).getdel === 'function') {
      return (this.client as unknown as { getdel: (k: string) => Promise<string | null> }).getdel(
        key,
      )
    }
    return this.client.eval(
      `local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v`,
      1,
      key,
    ) as Promise<string | null>
  }

  async sAdd(key: string, member: string): Promise<void> {
    await this.client.sadd(key, member)
  }

  async sRem(key: string, member: string): Promise<void> {
    await this.client.srem(key, member)
  }

  async sMembers(key: string): Promise<string[]> {
    return this.client.smembers(key)
  }

  getClient(): Redis {
    return this.client
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
  }
}
