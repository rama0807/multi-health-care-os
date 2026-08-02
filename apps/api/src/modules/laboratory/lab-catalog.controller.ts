import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateLabCatalogItemDto } from './dto/create-lab-catalog-item.dto'
import { UpdateLabCatalogItemDto } from './dto/update-lab-catalog-item.dto'
import { LabCatalogService } from './lab-catalog.service'

/**
 * Org-configurable catalog of orderable lab tests (ADR-0012). Not
 * own-scoped — a catalog item isn't tied to an ordering doctor, so only
 * the plain `laboratory.*` permission (all-scope) gates these routes.
 */
@ApiTags('laboratory-catalog')
@ApiBearerAuth()
@Controller({ path: 'laboratory/catalog', version: '1' })
export class LabCatalogController {
  constructor(private readonly catalogService: LabCatalogService) {}

  @Get()
  @RequirePermissions('laboratory.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.list(orgId, {
      category,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      search,
    })
  }

  @Get(':id')
  @RequirePermissions('laboratory.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.catalogService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('laboratory.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateLabCatalogItemDto) {
    return this.catalogService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('laboratory.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateLabCatalogItemDto) {
    return this.catalogService.update(orgId, id, dto)
  }
}
