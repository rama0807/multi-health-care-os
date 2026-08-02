import { DispenseOrderQuery } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DispenseService } from './dispense.service'
import { CancelDispenseOrderDto } from './dto/cancel-dispense-order.dto'
import { CreateDispenseOrderDto } from './dto/create-dispense-order.dto'
import { CreateDrugReturnDto } from './dto/create-drug-return.dto'
import { DispensePartialDto } from './dto/dispense-partial.dto'
import { PrepareDispenseItemsDto } from './dto/prepare-dispense-items.dto'

/**
 * Dispensing workflow — see ADR-0014. `pharmacy.*` stays all-scope
 * (staff-facing), so no own-scope check is needed on these routes.
 */
@ApiTags('pharmacy-dispense')
@ApiBearerAuth()
@Controller({ path: 'pharmacy/dispense', version: '1' })
export class DispenseController {
  constructor(private readonly dispenseService: DispenseService) {}

  @Get()
  @RequirePermissions('pharmacy.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: DispenseOrderQuery['status'],
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: DispenseOrderQuery['sortBy'],
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.dispenseService.list(orgId, {
      patientId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get('dashboard-stats')
  @RequirePermissions('pharmacy.read')
  getDashboardStats(@CurrentUser('orgId') orgId: string) {
    return this.dispenseService.getDashboardStats(orgId)
  }

  @Get(':id')
  @RequirePermissions('pharmacy.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.dispenseService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('pharmacy.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateDispenseOrderDto) {
    return this.dispenseService.createFromPrescription(orgId, dto, userId)
  }

  @Post(':id/prepare')
  @RequirePermissions('pharmacy.update')
  prepare(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PrepareDispenseItemsDto,
  ) {
    return this.dispenseService.prepareItems(orgId, id, dto, userId)
  }

  @Post(':id/ready')
  @RequirePermissions('pharmacy.update')
  markReady(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.dispenseService.markReady(orgId, id, userId)
  }

  @Post(':id/dispense-partial')
  @RequirePermissions('pharmacy.update')
  dispensePartial(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: DispensePartialDto,
  ) {
    return this.dispenseService.dispensePartial(orgId, id, dto, userId)
  }

  @Post(':id/dispense-complete')
  @RequirePermissions('pharmacy.update')
  dispenseComplete(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.dispenseService.dispenseComplete(orgId, id, userId)
  }

  @Post(':id/reject')
  @RequirePermissions('pharmacy.update')
  reject(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelDispenseOrderDto,
  ) {
    return this.dispenseService.reject(orgId, id, dto, userId)
  }

  @Post(':id/cancel')
  @RequirePermissions('pharmacy.update')
  cancel(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelDispenseOrderDto,
  ) {
    return this.dispenseService.cancel(orgId, id, dto, userId)
  }

  @Get(':id/returns')
  @RequirePermissions('pharmacy.read')
  listReturns(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.dispenseService.listReturns(orgId, id)
  }

  @Post(':id/returns')
  @RequirePermissions('pharmacy.update')
  createReturn(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateDrugReturnDto,
  ) {
    return this.dispenseService.createReturn(orgId, id, dto, userId)
  }
}
