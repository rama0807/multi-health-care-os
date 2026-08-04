import { AssetStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AssetsService } from './assets.service'
import { AssignAssetDto } from './dto/assign-asset.dto'
import { CompleteMaintenanceRecordDto } from './dto/complete-maintenance-record.dto'
import { CreateAssetDto } from './dto/create-asset.dto'
import { CreateMaintenanceRecordDto } from './dto/create-maintenance-record.dto'
import { UpdateAssetDto } from './dto/update-asset.dto'

/** Biomedical/equipment asset management — see ADR-0020. */
@ApiTags('inventory-assets')
@ApiBearerAuth()
@Controller({ path: 'inventory/assets', version: '1' })
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequirePermissions('inventory.assets.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('storeId') storeId?: string,
    @Query('status') status?: AssetStatus,
    @Query('itemId') itemId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.assetsService.list(orgId, {
      storeId,
      status,
      itemId,
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.assets.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.assetsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.assets.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(orgId, userId, dto)
  }

  @Patch(':id')
  @RequirePermissions('inventory.assets.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateAssetDto) {
    return this.assetsService.update(orgId, id, dto)
  }

  @Post(':id/assign')
  @RequirePermissions('inventory.assets.update')
  assign(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AssignAssetDto,
  ) {
    return this.assetsService.assign(orgId, userId, id, dto)
  }

  @Get(':id/assignments')
  @RequirePermissions('inventory.assets.read')
  listAssignments(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.assetsService.listAssignments(orgId, id)
  }

  @Get(':id/maintenance')
  @RequirePermissions('inventory.assets.read')
  listMaintenanceRecords(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.assetsService.listMaintenanceRecords(orgId, id)
  }

  @Post(':id/maintenance')
  @RequirePermissions('inventory.assets.update')
  createMaintenanceRecord(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceRecordDto,
  ) {
    return this.assetsService.createMaintenanceRecord(orgId, userId, id, dto)
  }

  @Post(':id/maintenance/:recordId/complete')
  @RequirePermissions('inventory.assets.update')
  completeMaintenanceRecord(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('recordId') recordId: string,
    @Body() dto: CompleteMaintenanceRecordDto,
  ) {
    return this.assetsService.completeMaintenanceRecord(orgId, userId, id, recordId, dto)
  }
}
