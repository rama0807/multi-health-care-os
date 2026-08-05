import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { OrganizationsModule } from '../organizations/organizations.module'

import { PlatformOrganizationsService } from './platform-organizations.service'
import { PlatformStatsService } from './platform-stats.service'
import { PlatformController } from './platform.controller'

/**
 * The Platform Owner console (Checkpoint 16.2).
 *
 * Imports `OrganizationsModule` so subscription and usage logic is reused
 * rather than reimplemented cross-tenant — the platform console and an
 * organization's own dashboard therefore always report the same numbers.
 * `PlatformGuard` and the two metering services come from the global
 * `TenantModule`.
 */
@Module({
  imports: [AuditModule, OrganizationsModule],
  controllers: [PlatformController],
  providers: [PlatformOrganizationsService, PlatformStatsService],
  exports: [PlatformOrganizationsService, PlatformStatsService],
})
export class PlatformModule {}
