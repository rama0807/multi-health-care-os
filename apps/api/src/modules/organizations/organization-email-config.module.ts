import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'

import { OrganizationEmailConfigService } from './organization-email-config.service'

/**
 * Split out from `OrganizationsModule` so `AuthModule` can import just this
 * (for `resolveSendOverride` on password-reset/verification email) without
 * pulling in the entire Organization Dashboard API surface, and without
 * `OrganizationsModule` and `AuthModule` needing to import each other.
 */
@Module({
  imports: [AuditModule],
  providers: [OrganizationEmailConfigService],
  exports: [OrganizationEmailConfigService],
})
export class OrganizationEmailConfigModule {}
