import { InsuranceNetworkType } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateInsurancePlanDto } from './dto/create-insurance-plan.dto'
import { UpdateInsurancePlanDto } from './dto/update-insurance-plan.dto'
import { InsurancePlansService } from './insurance-plans.service'

@ApiTags('insurance-plans')
@ApiBearerAuth()
@Controller({ path: 'insurance/plans', version: '1' })
export class InsurancePlansController {
  constructor(private readonly plansService: InsurancePlansService) {}

  @Get()
  @RequirePermissions('insurance.plans.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('providerId') providerId?: string,
    @Query('networkType') networkType?: InsuranceNetworkType,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.plansService.list(orgId, {
      providerId,
      networkType,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('insurance.plans.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.plansService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('insurance.plans.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInsurancePlanDto) {
    return this.plansService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('insurance.plans.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateInsurancePlanDto) {
    return this.plansService.update(orgId, id, dto)
  }
}
