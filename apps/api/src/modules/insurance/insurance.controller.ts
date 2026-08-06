import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { InsuranceDashboardService } from './insurance-dashboard.service'

/** "Today's Claims / Pending Approval / Rejected / Settled / Insurance Revenue / Outstanding" - see ADR-0016. */
@ApiTags('insurance-dashboard')
@ApiBearerAuth()
@Controller({ path: 'insurance', version: '1' })
export class InsuranceController {
  constructor(private readonly dashboardService: InsuranceDashboardService) {}

  @Get('dashboard-stats')
  @RequirePermissions('insurance.claims.read')
  getDashboardStats(@CurrentUser('orgId') orgId: string) {
    return this.dashboardService.getStats(orgId)
  }
}
