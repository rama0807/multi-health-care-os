import { StockTransferStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateStockTransferDto } from './dto/create-stock-transfer.dto'
import { TransfersService } from './transfers.service'

/** Direct store-to-store stock transfers - see ADR-0020. */
@ApiTags('inventory-transfers')
@ApiBearerAuth()
@Controller({ path: 'inventory/transfers', version: '1' })
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @RequirePermissions('inventory.stock.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('storeId') storeId?: string,
    @Query('status') status?: StockTransferStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transfersService.list(orgId, {
      storeId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.stock.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.transfersService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.stock.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateStockTransferDto) {
    return this.transfersService.create(orgId, userId, dto)
  }

  @Post(':id/dispatch')
  @RequirePermissions('inventory.stock.update')
  dispatch(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.transfersService.dispatch(orgId, userId, id)
  }

  @Post(':id/receive')
  @RequirePermissions('inventory.stock.update')
  receive(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.transfersService.receive(orgId, userId, id)
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.stock.update')
  cancel(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.transfersService.cancel(orgId, userId, id, reason)
  }
}
