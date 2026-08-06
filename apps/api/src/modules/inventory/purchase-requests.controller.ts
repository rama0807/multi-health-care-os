import { PurchaseRequestStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreatePurchaseRequestDto } from './dto/create-purchase-request.dto'
import { RejectPurchaseRequestDto } from './dto/reject-purchase-request.dto'
import { PurchaseRequestsService } from './purchase-requests.service'

/** Purchase Request - the first step of the procurement chain. See ADR-0020. */
@ApiTags('inventory-purchase-requests')
@ApiBearerAuth()
@Controller({ path: 'inventory/purchase-requests', version: '1' })
export class PurchaseRequestsController {
  constructor(private readonly service: PurchaseRequestsService) {}

  @Get()
  @RequirePermissions('inventory.procurement.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('storeId') storeId?: string,
    @Query('status') status?: PurchaseRequestStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, { storeId, status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined })
  }

  @Get(':id')
  @RequirePermissions('inventory.procurement.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.procurement.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreatePurchaseRequestDto) {
    return this.service.create(orgId, userId, dto)
  }

  @Post(':id/submit')
  @RequirePermissions('inventory.procurement.update')
  submit(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.submit(orgId, id)
  }

  @Post(':id/approve')
  @RequirePermissions('inventory.procurement.approve')
  approve(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.approve(orgId, userId, id)
  }

  @Post(':id/reject')
  @RequirePermissions('inventory.procurement.approve')
  reject(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RejectPurchaseRequestDto,
  ) {
    return this.service.reject(orgId, userId, id, dto)
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.procurement.update')
  cancel(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.cancel(orgId, id)
  }
}
