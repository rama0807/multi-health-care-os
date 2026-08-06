import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AdjustStockDto } from './dto/adjust-stock.dto'
import { SetOpeningStockDto } from './dto/set-opening-stock.dto'
import { UpdateStockLevelsDto } from './dto/update-stock-levels.dto'
import { StockService } from './stock.service'

/** Per-store-per-item stock ledger - see ADR-0020. */
@ApiTags('inventory-stock')
@ApiBearerAuth()
@Controller({ path: 'inventory/stock', version: '1' })
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @RequirePermissions('inventory.stock.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('storeId') storeId?: string,
    @Query('itemId') itemId?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('expiringWithinDays') expiringWithinDays?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.list(orgId, {
      storeId,
      itemId,
      lowStockOnly: lowStockOnly === 'true',
      expiringWithinDays: expiringWithinDays ? Number(expiringWithinDays) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.stock.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.stockService.getById(orgId, id)
  }

  @Post('opening')
  @RequirePermissions('inventory.stock.create')
  setOpeningStock(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: SetOpeningStockDto,
  ) {
    return this.stockService.setOpeningStock(orgId, userId, dto)
  }

  @Patch(':id/levels')
  @RequirePermissions('inventory.stock.update')
  updateLevels(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateStockLevelsDto) {
    return this.stockService.updateLevels(orgId, id, dto)
  }

  @Post('adjust')
  @RequirePermissions('inventory.stock.update')
  adjust(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: AdjustStockDto) {
    return this.stockService.adjust(orgId, userId, dto)
  }
}
