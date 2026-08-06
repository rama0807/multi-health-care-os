import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateServiceCatalogItemDto } from './dto/create-service-catalog-item.dto'
import { UpdateServiceCatalogItemDto } from './dto/update-service-catalog-item.dto'
import { ServiceCatalogService } from './service-catalog.service'

/** Service catalog with pricing - see ADR-0015. Not own-scoped: no owning doctor. */
@ApiTags('billing-catalog')
@ApiBearerAuth()
@Controller({ path: 'billing/catalog', version: '1' })
export class ServiceCatalogController {
  constructor(private readonly catalogService: ServiceCatalogService) {}

  @Get()
  @RequirePermissions('billing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'name' | 'category' | 'price' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.catalogService.list(orgId, {
      search,
      category,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get(':id')
  @RequirePermissions('billing.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.catalogService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('billing.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateServiceCatalogItemDto) {
    return this.catalogService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('billing.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateServiceCatalogItemDto) {
    return this.catalogService.update(orgId, id, dto)
  }
}
