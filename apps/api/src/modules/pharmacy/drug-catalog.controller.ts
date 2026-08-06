import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { DrugCatalogService } from './drug-catalog.service'
import { AdjustDrugStockDto } from './dto/adjust-drug-stock.dto'
import { CreateDrugDto } from './dto/create-drug.dto'
import { UpdateDrugDto } from './dto/update-drug.dto'

/**
 * Drug Catalog - see ADR-0014. Not own-scoped: `pharmacy.*` is all-scope
 * for every role that has it (staff-facing, like billing/insurance), so
 * only the plain permission gates these routes.
 */
@ApiTags('pharmacy-catalog')
@ApiBearerAuth()
@Controller({ path: 'pharmacy/catalog', version: '1' })
export class DrugCatalogController {
  constructor(private readonly catalogService: DrugCatalogService) {}

  @Get()
  @RequirePermissions('pharmacy.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('lowStockOnly') lowStockOnly?: string,
    @Query('expiringWithinDays') expiringWithinDays?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'genericName' | 'expiryDate' | 'currentStock' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.catalogService.list(orgId, {
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      lowStockOnly: lowStockOnly === 'true',
      expiringWithinDays: expiringWithinDays ? Number(expiringWithinDays) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get(':id')
  @RequirePermissions('pharmacy.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.catalogService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('pharmacy.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateDrugDto) {
    return this.catalogService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('pharmacy.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateDrugDto) {
    return this.catalogService.update(orgId, id, dto)
  }

  @Post(':id/adjust-stock')
  @RequirePermissions('pharmacy.update')
  adjustStock(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: AdjustDrugStockDto) {
    return this.catalogService.adjustStock(orgId, id, dto)
  }
}
