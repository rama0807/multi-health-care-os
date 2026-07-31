import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AuditService } from './audit.service'

@ApiTags('audit')
@ApiBearerAuth()
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('audit.read')
  list(@CurrentUser('orgId') orgId: string, @Query('limit') limit?: string) {
    return this.auditService.listRecent(orgId, limit ? Number(limit) : undefined)
  }
}
