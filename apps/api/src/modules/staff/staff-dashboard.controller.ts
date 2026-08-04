import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { StaffDashboardService } from './staff-dashboard.service'

@ApiTags('staff-dashboard')
@ApiBearerAuth()
@Controller({ path: 'staff/dashboard', version: '1' })
export class StaffDashboardController {
  constructor(private readonly staffDashboardService: StaffDashboardService) {}

  @Get('stats')
  @RequirePermissions('staff.read')
  getStats(@CurrentUser('orgId') orgId: string) {
    return this.staffDashboardService.getStats(orgId)
  }
}
