import { InventoryItemType } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateInventoryItemDto } from './dto/create-inventory-item.dto'
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto'
import { InventoryItemsService } from './inventory-items.service'

/** The item master entity — see ADR-0020. */
@ApiTags('inventory-items')
@ApiBearerAuth()
@Controller({ path: 'inventory/items', version: '1' })
export class InventoryItemsController {
  constructor(private readonly service: InventoryItemsService) {}

  @Get()
  @RequirePermissions('inventory.items.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('itemGroupId') itemGroupId?: string,
    @Query('itemType') itemType?: InventoryItemType,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'name' | 'code' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.service.list(orgId, {
      search,
      categoryId,
      itemGroupId,
      itemType,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.items.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.items.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryItemDto) {
    return this.service.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('inventory.items.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.service.update(orgId, id, dto)
  }
}
