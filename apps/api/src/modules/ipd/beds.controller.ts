import { BedStatus, BedType } from '@medicore/types'
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { BedsService } from './beds.service'
import { CreateBedDto } from './dto/create-bed.dto'
import { UpdateBedDto } from './dto/update-bed.dto'

@ApiTags('ipd-beds')
@ApiBearerAuth()
@Controller({ path: 'ipd/beds', version: '1' })
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  @Get()
  @RequirePermissions('ipd.beds.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('wardId') wardId?: string,
    @Query('roomId') roomId?: string,
    @Query('type') type?: BedType,
    @Query('status') status?: BedStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.bedsService.list(orgId, {
      search,
      wardId,
      roomId,
      type,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('ipd.beds.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.bedsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('ipd.beds.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateBedDto) {
    return this.bedsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('ipd.beds.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateBedDto) {
    return this.bedsService.update(orgId, id, dto)
  }

  @Delete(':id')
  @RequirePermissions('ipd.beds.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.bedsService.deactivate(orgId, id)
  }
}
