import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateInventoryBrandDto } from './dto/create-inventory-brand.dto'
import { CreateInventoryCategoryDto } from './dto/create-inventory-category.dto'
import { CreateInventoryItemGroupDto } from './dto/create-inventory-item-group.dto'
import { CreateInventoryManufacturerDto } from './dto/create-inventory-manufacturer.dto'
import { CreateInventoryUnitDto } from './dto/create-inventory-unit.dto'
import { UpdateInventoryBrandDto } from './dto/update-inventory-brand.dto'
import { UpdateInventoryCategoryDto } from './dto/update-inventory-category.dto'
import { UpdateInventoryItemGroupDto } from './dto/update-inventory-item-group.dto'
import { UpdateInventoryManufacturerDto } from './dto/update-inventory-manufacturer.dto'
import { UpdateInventoryUnitDto } from './dto/update-inventory-unit.dto'
import { ItemMasterService } from './item-master.service'

/** Item master lookups (categories, item groups, units, manufacturers, brands) — see ADR-0020. */
@ApiTags('inventory-item-master')
@ApiBearerAuth()
@Controller({ path: 'inventory', version: '1' })
export class ItemMasterController {
  constructor(private readonly service: ItemMasterService) {}

  @Get('categories')
  @RequirePermissions('inventory.items.read')
  listCategories(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.service.listCategories(orgId, isActive === undefined ? undefined : isActive === 'true')
  }

  @Post('categories')
  @RequirePermissions('inventory.items.create')
  createCategory(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryCategoryDto) {
    return this.service.createCategory(orgId, dto)
  }

  @Patch('categories/:id')
  @RequirePermissions('inventory.items.update')
  updateCategory(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryCategoryDto,
  ) {
    return this.service.updateCategory(orgId, id, dto)
  }

  @Get('item-groups')
  @RequirePermissions('inventory.items.read')
  listItemGroups(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.service.listItemGroups(orgId, isActive === undefined ? undefined : isActive === 'true')
  }

  @Post('item-groups')
  @RequirePermissions('inventory.items.create')
  createItemGroup(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryItemGroupDto) {
    return this.service.createItemGroup(orgId, dto)
  }

  @Patch('item-groups/:id')
  @RequirePermissions('inventory.items.update')
  updateItemGroup(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryItemGroupDto,
  ) {
    return this.service.updateItemGroup(orgId, id, dto)
  }

  @Get('units')
  @RequirePermissions('inventory.items.read')
  listUnits(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.service.listUnits(orgId, isActive === undefined ? undefined : isActive === 'true')
  }

  @Post('units')
  @RequirePermissions('inventory.items.create')
  createUnit(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryUnitDto) {
    return this.service.createUnit(orgId, dto)
  }

  @Patch('units/:id')
  @RequirePermissions('inventory.items.update')
  updateUnit(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateInventoryUnitDto) {
    return this.service.updateUnit(orgId, id, dto)
  }

  @Get('manufacturers')
  @RequirePermissions('inventory.items.read')
  listManufacturers(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.service.listManufacturers(orgId, isActive === undefined ? undefined : isActive === 'true')
  }

  @Post('manufacturers')
  @RequirePermissions('inventory.items.create')
  createManufacturer(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryManufacturerDto) {
    return this.service.createManufacturer(orgId, dto)
  }

  @Patch('manufacturers/:id')
  @RequirePermissions('inventory.items.update')
  updateManufacturer(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInventoryManufacturerDto,
  ) {
    return this.service.updateManufacturer(orgId, id, dto)
  }

  @Get('brands')
  @RequirePermissions('inventory.items.read')
  listBrands(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.service.listBrands(orgId, isActive === undefined ? undefined : isActive === 'true')
  }

  @Post('brands')
  @RequirePermissions('inventory.items.create')
  createBrand(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryBrandDto) {
    return this.service.createBrand(orgId, dto)
  }

  @Patch('brands/:id')
  @RequirePermissions('inventory.items.update')
  updateBrand(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateInventoryBrandDto) {
    return this.service.updateBrand(orgId, id, dto)
  }
}
