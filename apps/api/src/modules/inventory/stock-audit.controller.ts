import { StockAuditStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateStockAuditDto } from './dto/create-stock-audit.dto'
import { RecordAuditCountDto } from './dto/record-audit-count.dto'
import { StockAuditService } from './stock-audit.service'

/** Cycle counting / physical verification — see ADR-0020. */
@ApiTags('inventory-stock-audit')
@ApiBearerAuth()
@Controller({ path: 'inventory/audits', version: '1' })
export class StockAuditController {
  constructor(private readonly service: StockAuditService) {}

  @Get()
  @RequirePermissions('inventory.audit.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('storeId') storeId?: string,
    @Query('status') status?: StockAuditStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, { storeId, status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined })
  }

  @Get(':id')
  @RequirePermissions('inventory.audit.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.audit.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateStockAuditDto) {
    return this.service.create(orgId, userId, dto)
  }

  @Post(':id/start')
  @RequirePermissions('inventory.audit.update')
  start(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.start(orgId, userId, id)
  }

  @Post(':id/counts')
  @RequirePermissions('inventory.audit.update')
  recordCounts(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: RecordAuditCountDto) {
    return this.service.recordCounts(orgId, id, dto)
  }

  @Post(':id/complete')
  @RequirePermissions('inventory.audit.manage')
  complete(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.complete(orgId, userId, id)
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.audit.update')
  cancel(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.service.cancel(orgId, userId, id)
  }
}
