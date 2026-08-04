import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateVendorDto } from './dto/create-vendor.dto'
import { RateVendorDto } from './dto/rate-vendor.dto'
import { UpdateVendorDto } from './dto/update-vendor.dto'
import { VendorsService } from './vendors.service'

/** Vendor management — CRUD, rating, purchase history, outstanding balance. See ADR-0020. */
@ApiTags('inventory-vendors')
@ApiBearerAuth()
@Controller({ path: 'inventory/vendors', version: '1' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @RequirePermissions('inventory.vendors.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: 'name' | 'code' | 'createdAt',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.vendorsService.list(orgId, {
      search,
      isActive: isActive === undefined ? undefined : isActive === 'true',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get(':id')
  @RequirePermissions('inventory.vendors.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.vendorsService.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.vendors.create')
  create(@CurrentUser('orgId') orgId: string, @Body() dto: CreateVendorDto) {
    return this.vendorsService.create(orgId, dto)
  }

  @Patch(':id')
  @RequirePermissions('inventory.vendors.update')
  update(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.vendorsService.update(orgId, id, dto)
  }

  @Get(':id/purchase-history')
  @RequirePermissions('inventory.vendors.read')
  purchaseHistory(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.vendorsService.purchaseHistory(orgId, id)
  }

  @Get(':id/ratings')
  @RequirePermissions('inventory.vendors.read')
  listRatings(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.vendorsService.listRatings(orgId, id)
  }

  @Post(':id/ratings')
  @RequirePermissions('inventory.vendors.update')
  rate(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RateVendorDto,
  ) {
    return this.vendorsService.rate(orgId, id, userId, dto)
  }
}
