import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateHospitalDto } from './dto/create-hospital.dto'
import { UpdateHospitalDto } from './dto/update-hospital.dto'
import { HospitalsService } from './hospitals.service'

@ApiTags('hospitals')
@ApiBearerAuth()
@Controller({ path: 'hospitals', version: '1' })
export class HospitalsController {
  constructor(private readonly hospitalsService: HospitalsService) {}

  @Get()
  @RequirePermissions('hospitals.read')
  list(@CurrentUser('orgId') orgId: string) {
    return this.hospitalsService.list(orgId)
  }

  @Get(':id')
  @RequirePermissions('hospitals.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.hospitalsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('hospitals.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateHospitalDto) {
    return this.hospitalsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('hospitals.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateHospitalDto) {
    return this.hospitalsService.update(orgId, id, dto)
  }

  @Delete(':id')
  @RequirePermissions('hospitals.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.hospitalsService.deactivate(orgId, id)
  }
}
