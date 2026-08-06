import { GrnStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateGoodsReceiptNoteDto } from './dto/create-goods-receipt-note.dto'
import { CreateVendorReturnDto } from './dto/create-vendor-return.dto'
import { GoodsReceiptService } from './goods-receipt.service'

/** Goods Receipt Notes + Vendor Returns - see ADR-0020. */
@ApiTags('inventory-grn')
@ApiBearerAuth()
@Controller({ path: 'inventory', version: '1' })
export class GoodsReceiptController {
  constructor(private readonly service: GoodsReceiptService) {}

  @Get('grn')
  @RequirePermissions('inventory.procurement.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('storeId') storeId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('status') status?: GrnStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, {
      storeId,
      purchaseOrderId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('grn/:id')
  @RequirePermissions('inventory.procurement.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post('grn')
  @RequirePermissions('inventory.procurement.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateGoodsReceiptNoteDto) {
    return this.service.create(orgId, userId, dto)
  }

  @Post('grn/:id/complete')
  @RequirePermissions('inventory.procurement.update')
  complete(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.complete(orgId, id)
  }

  @Post('grn/:id/cancel')
  @RequirePermissions('inventory.procurement.update')
  cancel(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.cancel(orgId, userId, id)
  }

  @Get('vendor-returns')
  @RequirePermissions('inventory.procurement.read')
  listReturns(@CurrentUser('orgId') orgId: string) {
    return this.service.listReturns(orgId)
  }

  @Get('vendor-returns/:id')
  @RequirePermissions('inventory.procurement.read')
  getReturnById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getReturnById(orgId, id)
  }

  @Post('vendor-returns')
  @RequirePermissions('inventory.procurement.manage')
  createReturn(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateVendorReturnDto) {
    return this.service.createReturn(orgId, userId, dto)
  }

  @Post('vendor-returns/:id/acknowledge')
  @RequirePermissions('inventory.procurement.manage')
  acknowledgeReturn(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.acknowledgeReturn(orgId, userId, id)
  }
}
