import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { IpdDashboardService } from './ipd-dashboard.service'

@ApiTags('ipd-dashboard')
@ApiBearerAuth()
@Controller({ path: 'ipd/dashboard', version: '1' })
export class IpdDashboardController {
  constructor(private readonly dashboardService: IpdDashboardService) {}

  @Get()
  @RequirePermissions('ipd.admissions.read')
  getStats(@CurrentUser('orgId') orgId: string) {
    return this.dashboardService.getStats(orgId)
  }
}
