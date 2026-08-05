import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { CacheService } from './cache.service'
import { createRedisClient, REDIS_CLIENT, RedisService } from './redis.service'

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => createRedisClient(configService),
      inject: [ConfigService],
    },
    RedisService,
    CacheService,
  ],
  exports: [RedisService, CacheService],
})
export class RedisModule {}
