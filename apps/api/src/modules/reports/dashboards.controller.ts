import { ExecutiveDashboardKey } from '@medicore/types'
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DashboardsService, DASHBOARD_KEYS } from './dashboards.service'
import { toFilter } from './reports.controller'

/**
 * Executive dashboards (Milestone 17 Checkpoint 17.2). One parameterised
 * route rather than five near-identical handlers — the dashboards differ in
 * composition, not in transport, so a new dashboard should only require a
 * case in `DashboardsService`.
 */
@ApiTags('reports-dashboards')
@ApiBearerAuth()
@Controller({ path: 'reports/dashboards', version: '1' })
export class DashboardsController {
  constructor(private readonly dashboards: DashboardsService) {}

  @Get()
  @RequirePermissions('reports.read')
  list() {
    return DASHBOARD_KEYS.map((key) => ({ key }))
  }

  @Get(':key')
  @RequirePermissions('reports.read')
  getDashboard(
    @CurrentUser('orgId') orgId: string,
    @Param('key') key: string,
    @Query() query: Record<string, string>,
  ) {
    if (!DASHBOARD_KEYS.includes(key as ExecutiveDashboardKey)) {
      throw new BadRequestException(
        `Unknown dashboard "${key}". Expected one of: ${DASHBOARD_KEYS.join(', ')}`,
      )
    }
    return this.dashboards.getDashboard(orgId, key as ExecutiveDashboardKey, toFilter(query))
  }
}
