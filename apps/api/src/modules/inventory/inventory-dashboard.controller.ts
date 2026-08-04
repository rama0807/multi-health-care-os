import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { InventoryDashboardService } from './inventory-dashboard.service'

@ApiTags('inventory-dashboard')
@ApiBearerAuth()
@Controller({ path: 'inventory/dashboard', version: '1' })
export class InventoryDashboardController {
  constructor(private readonly dashboardService: InventoryDashboardService) {}

  @Get()
  @RequirePermissions('inventory.items.read')
  getStats(@CurrentUser('orgId') orgId: string) {
    return this.dashboardService.getStats(orgId)
  }
}
