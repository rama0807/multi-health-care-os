import { Global, Module } from '@nestjs/common'

import { PrismaModule } from '../../prisma/prisma.module'
import { RedisModule } from '../redis/redis.module'

import { ApiUsageInterceptor } from './api-usage.interceptor'
import { ApiUsageService } from './api-usage.service'
import { PlatformGuard } from './platform.guard'
import { StorageUsageService } from './storage-usage.service'

/**
 * Cross-cutting tenancy concerns (Milestone 16 / ADR-0025): the platform
 * isolation guard plus the two metering services the Organization Usage tab
 * and the Platform Owner console both read.
 *
 * `@Global()` mirrors how `PermissionsModule` is consumed — the guard and
 * interceptor are wired at app level, so re-importing this module in every
 * feature module would be noise.
 */
@Global()
@Module({
  imports: [PrismaModule, RedisModule],
  providers: [ApiUsageService, ApiUsageInterceptor, StorageUsageService, PlatformGuard],
  exports: [ApiUsageService, ApiUsageInterceptor, StorageUsageService, PlatformGuard],
})
export class TenantModule {}
