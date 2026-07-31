import { Controller, Get, ServiceUnavailableException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'

import { Public } from '../../common/decorators/public.decorator'
import { RedisService } from '../../common/redis/redis.service'
import { PrismaService } from '../../prisma/prisma.service'

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const [databaseUp, redisUp] = await Promise.all([
      this.prisma.healthCheck(),
      this.redis
        .set('health:ping', 'ok', 5)
        .then(() => true)
        .catch(() => false),
    ])

    const healthy = databaseUp && redisUp
    if (!healthy) {
      throw new ServiceUnavailableException({ database: databaseUp, redis: redisUp })
    }

    return { status: 'ok', database: databaseUp, redis: redisUp, timestamp: new Date().toISOString() }
  }
}
