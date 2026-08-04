import { IpdOrderCategory, IpdOrderStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateIpdOrderDto } from './dto/create-ipd-order.dto'
import { DiscontinueIpdOrderDto } from './dto/discontinue-ipd-order.dto'
import { IpdOrdersService } from './ipd-orders.service'

@ApiTags('ipd-orders')
@ApiBearerAuth()
@Controller({ path: 'ipd/admissions/:admissionId/orders', version: '1' })
export class IpdOrdersController {
  constructor(private readonly ipdOrdersService: IpdOrdersService) {}

  @Get()
  @RequirePermissions('ipd.orders.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Param('admissionId') admissionId: string,
    @Query('category') category?: IpdOrderCategory,
    @Query('status') status?: IpdOrderStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ipdOrdersService.list(orgId, admissionId, {
      category,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post()
  @RequirePermissions('ipd.orders.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateIpdOrderDto,
  ) {
    return this.ipdOrdersService.create(orgId, admissionId, dto, userId)
  }

  @Patch(':orderId/discontinue')
  @RequirePermissions('ipd.orders.update')
  discontinue(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('admissionId') admissionId: string,
    @Param('orderId') orderId: string,
    @Body() dto: DiscontinueIpdOrderDto,
  ) {
    return this.ipdOrdersService.discontinue(orgId, admissionId, orderId, dto, userId)
  }
}
