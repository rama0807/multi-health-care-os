import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { BillingDashboardService } from './billing-dashboard.service'

/** Revenue dashboard - see ADR-0015. */
@ApiTags('billing-dashboard')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(private readonly dashboardService: BillingDashboardService) {}

  @Get('dashboard-stats')
  @RequirePermissions('billing.read')
  getDashboardStats(@CurrentUser('orgId') orgId: string) {
    return this.dashboardService.getStats(orgId)
  }
}
