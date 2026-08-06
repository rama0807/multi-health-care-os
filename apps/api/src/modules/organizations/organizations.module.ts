import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'

import { OrganizationEmailConfigModule } from './organization-email-config.module'
import { OrganizationUsageService } from './organization-usage.service'
import { OrganizationsController } from './organizations.controller'
import { OrganizationsService } from './organizations.service'
import { SubscriptionsService } from './subscriptions.service'

@Module({
  imports: [AuditModule, OrganizationEmailConfigModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrganizationUsageService, SubscriptionsService],
  // Exported so `PlatformModule` reuses the same subscription and usage logic
  // rather than growing a parallel cross-tenant copy of it.
  exports: [OrganizationsService, OrganizationUsageService, SubscriptionsService],
})
export class OrganizationsModule {}
