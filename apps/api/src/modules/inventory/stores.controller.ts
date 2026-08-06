import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AssignStoreManagerDto } from './dto/assign-store-manager.dto'
import { CreateInventoryStoreDto } from './dto/create-inventory-store.dto'
import { UpdateInventoryStoreDto } from './dto/update-inventory-store.dto'
import { StoresService } from './stores.service'

/** Store management (Central/ICU/OT/Ward/... stores) - see ADR-0020. */
@ApiTags('inventory-stores')
@ApiBearerAuth()
@Controller({ path: 'inventory/stores', version: '1' })
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Get()
  @RequirePermissions('inventory.stores.read')
  list(@CurrentUser('orgId') orgId: string, @Query('isActive') isActive?: string) {
    return this.storesService.list(orgId, isActive === undefined ? undefined : isActive === 'true')
  }

  @Get(':id')
  @RequirePermissions('inventory.stores.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.storesService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.stores.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateInventoryStoreDto) {
    return this.storesService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('inventory.stores.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateInventoryStoreDto) {
    return this.storesService.update(orgId, id, dto)
  }

  @Post(':id/deactivate')
  @RequirePermissions('inventory.stores.delete')
  deactivate(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.storesService.deactivate(orgId, id)
  }

  @Get(':id/managers')
  @RequirePermissions('inventory.stores.read')
  listManagers(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.storesService.listManagers(orgId, id)
  }

  @Post(':id/managers')
  @RequirePermissions('inventory.stores.update')
  assignManager(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AssignStoreManagerDto,
  ) {
    return this.storesService.assignManager(orgId, id, userId, dto)
  }

  @Delete(':id/managers/:managerId')
  @RequirePermissions('inventory.stores.update')
  removeManager(
    @CurrentUser('orgId') orgId: string,
    @Param('id') id: string,
    @Param('managerId') managerId: string,
  ) {
    return this.storesService.removeManager(orgId, id, managerId)
  }
}
