import { InsuranceProviderType } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateInsuranceProviderDto } from './dto/create-insurance-provider.dto'
import { UpdateInsuranceProviderDto } from './dto/update-insurance-provider.dto'
import { InsuranceProvidersService } from './insurance-providers.service'

@ApiTags('insurance-providers')
@ApiBearerAuth()
@Controller({ path: 'insurance/providers', version: '1' })
export class InsuranceProvidersController {
  constructor(private readonly providersService: InsuranceProvidersService) {}

  @Get()
  @RequirePermissions('insurance.providers.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('type') type?: InsuranceProviderType,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.providersService.list(orgId, {
      search,
      type,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('insurance.providers.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.providersService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('insurance.providers.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInsuranceProviderDto) {
    return this.providersService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('insurance.providers.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateInsuranceProviderDto) {
    return this.providersService.update(orgId, id, dto)
  }
}
