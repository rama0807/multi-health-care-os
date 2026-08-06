import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateRadiologyCatalogItemDto } from './dto/create-radiology-catalog-item.dto'
import { UpdateRadiologyCatalogItemDto } from './dto/update-radiology-catalog-item.dto'
import { RadiologyCatalogService } from './radiology-catalog.service'

/**
 * Org-configurable catalog of orderable radiology studies (ADR-0013). Not
 * own-scoped - a catalog item isn't tied to an ordering doctor, so only the
 * plain `radiology.*` permission (all-scope) gates these routes, mirroring
 * `LabCatalogController`.
 */
@ApiTags('radiology-catalog')
@ApiBearerAuth()
@Controller({ path: 'radiology/catalog', version: '1' })
export class RadiologyCatalogController {
  constructor(private readonly catalogService: RadiologyCatalogService) {}

  @Get()
  @RequirePermissions('radiology.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('category') category?: string,
    @Query('modality') modality?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.catalogService.list(orgId, {
      category,
      modality,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      search,
    })
  }

  @Get(':id')
  @RequirePermissions('radiology.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.catalogService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('radiology.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateRadiologyCatalogItemDto) {
    return this.catalogService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('radiology.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateRadiologyCatalogItemDto) {
    return this.catalogService.update(orgId, id, dto)
  }
}
