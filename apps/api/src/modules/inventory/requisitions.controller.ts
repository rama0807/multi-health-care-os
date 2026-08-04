import { RequisitionStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateStoreRequisitionDto } from './dto/create-store-requisition.dto'
import { IssueStoreRequisitionDto } from './dto/issue-store-requisition.dto'
import { ReceiveStoreRequisitionDto } from './dto/receive-store-requisition.dto'
import { RejectStoreRequisitionDto } from './dto/reject-store-requisition.dto'
import { RequisitionsService } from './requisitions.service'

/** Internal ward/OT/ICU/lab/radiology stock requests — see ADR-0020. */
@ApiTags('inventory-requisitions')
@ApiBearerAuth()
@Controller({ path: 'inventory/requisitions', version: '1' })
export class RequisitionsController {
  constructor(private readonly service: RequisitionsService) {}

  @Get()
  @RequirePermissions('inventory.requests.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('fromStoreId') fromStoreId?: string,
    @Query('toStoreId') toStoreId?: string,
    @Query('status') status?: RequisitionStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, {
      fromStoreId,
      toStoreId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.requests.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.requests.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateStoreRequisitionDto) {
    return this.service.create(orgId, userId, dto)
  }

  @Post(':id/approve')
  @RequirePermissions('inventory.requests.approve')
  approve(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.approve(orgId, userId, id)
  }

  @Post(':id/reject')
  @RequirePermissions('inventory.requests.approve')
  reject(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RejectStoreRequisitionDto,
  ) {
    return this.service.reject(orgId, userId, id, dto)
  }

  @Post(':id/issue')
  @RequirePermissions('inventory.requests.update')
  issue(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: IssueStoreRequisitionDto,
  ) {
    return this.service.issue(orgId, userId, id, dto)
  }

  @Post(':id/receive')
  @RequirePermissions('inventory.requests.update')
  receive(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ReceiveStoreRequisitionDto,
  ) {
    return this.service.receive(orgId, userId, id, dto)
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.requests.update')
  cancel(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.cancel(orgId, userId, id)
  }
}
