import { WardStatus, WardType } from '@medicore/types'
import { Controller, Delete, Get, Param, Patch, Post, Body, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateWardDto } from './dto/create-ward.dto'
import { UpdateWardDto } from './dto/update-ward.dto'
import { WardsService } from './wards.service'

@ApiTags('ipd-wards')
@ApiBearerAuth()
@Controller({ path: 'ipd/wards', version: '1' })
export class WardsController {
  constructor(private readonly wardsService: WardsService) {}

  @Get()
  @RequirePermissions('ipd.wards.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('type') type?: WardType,
    @Query('status') status?: WardStatus,
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wardsService.list(orgId, {
      search,
      type,
      status,
      departmentId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('ipd.wards.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.wardsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('ipd.wards.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateWardDto) {
    return this.wardsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('ipd.wards.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateWardDto) {
    return this.wardsService.update(orgId, id, dto)
  }

  @Delete(':id')
  @RequirePermissions('ipd.wards.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.wardsService.deactivate(orgId, id)
  }
}
