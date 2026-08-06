import { PurchaseOrderStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CancelPurchaseOrderDto } from './dto/cancel-purchase-order.dto'
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto'
import { PurchaseOrdersService } from './purchase-orders.service'

/** Purchase Order - see ADR-0020. */
@ApiTags('inventory-purchase-orders')
@ApiBearerAuth()
@Controller({ path: 'inventory/purchase-orders', version: '1' })
export class PurchaseOrdersController {
  constructor(private readonly service: PurchaseOrdersService) {}

  @Get()
  @RequirePermissions('inventory.procurement.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('vendorId') vendorId?: string,
    @Query('storeId') storeId?: string,
    @Query('status') status?: PurchaseOrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, {
      vendorId,
      storeId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.procurement.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.procurement.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreatePurchaseOrderDto) {
    return this.service.create(orgId, userId, dto)
  }

  @Post(':id/submit')
  @RequirePermissions('inventory.procurement.update')
  submit(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.submit(orgId, userId, id)
  }

  @Post(':id/approve')
  @RequirePermissions('inventory.procurement.approve')
  approve(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.approve(orgId, userId, id)
  }

  @Post(':id/send')
  @RequirePermissions('inventory.procurement.update')
  send(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.send(orgId, userId, id)
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.procurement.update')
  cancel(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelPurchaseOrderDto,
  ) {
    return this.service.cancel(orgId, userId, id, dto)
  }
}
