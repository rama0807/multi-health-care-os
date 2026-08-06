import { TenantContext } from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { Tenant } from '../../common/tenant/tenant.decorator'

import { CreateHospitalDto } from './dto/create-hospital.dto'
import { OnboardHospitalDto } from './dto/onboard-hospital.dto'
import { UpdateHospitalDto } from './dto/update-hospital.dto'
import { HospitalsService } from './hospitals.service'

@ApiTags('hospitals')
@ApiBearerAuth()
@Controller({ path: 'hospitals', version: '1' })
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @RequirePermissions('hospitals.read')
  list(@CurrentUser('orgId') orgId: string, @Tenant() tenant: TenantContext) {
    return this.hospitalsService.list(orgId, tenant)
  }

  @Get(':id')
  @RequirePermissions('hospitals.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.hospitalsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('hospitals.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateHospitalDto,
  ) {
    return this.hospitalsService.create(orgId, dto, userId)
  }

  /**
   * Onboarding wizard - creates the hospital, its departments and (optionally)
   * its administrator in one transactional call. Declared before `:id` routes
   * so "onboard" is never captured as a hospital id.
   */
  @Post('onboard')
  @RequirePermissions('hospitals.create')
  onboard(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: OnboardHospitalDto,
  ) {
    return this.hospitalsService.onboard(orgId, dto, userId)
  }

  @Patch(':id')
  @RequirePermissions('hospitals.update')
  update(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return this.hospitalsService.update(orgId, id, dto, userId)
  }

  @Post(':id/activate')
  @RequirePermissions('hospitals.update')
  activate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.hospitalsService.activate(orgId, id, userId)
  }

  @Delete(':id')
  @RequirePermissions('hospitals.delete')
  deactivate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.hospitalsService.deactivate(orgId, id, userId)
  }
}
