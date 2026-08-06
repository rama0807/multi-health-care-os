import { VendorInvoiceStatus } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreateVendorInvoiceDto } from './dto/create-vendor-invoice.dto'
import { RecordVendorInvoicePaymentDto } from './dto/record-vendor-invoice-payment.dto'
import { UpdateVendorInvoiceStatusDto } from './dto/update-vendor-invoice-status.dto'
import { VendorInvoicesService } from './vendor-invoices.service'

/** Vendor invoices - the final step of the procurement chain. See ADR-0020. */
@ApiTags('inventory-vendor-invoices')
@ApiBearerAuth()
@Controller({ path: 'inventory/vendor-invoices', version: '1' })
export class VendorInvoicesController {
  constructor(private readonly service: VendorInvoicesService) {}

  @Get()
  @RequirePermissions('inventory.procurement.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('vendorId') vendorId?: string,
    @Query('status') status?: VendorInvoiceStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.list(orgId, { vendorId, status, page: page ? Number(page) : undefined, limit: limit ? Number(limit) : undefined })
  }

  @Get(':id')
  @RequirePermissions('inventory.procurement.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.service.getById(orgId, id)
  }

  @Post()
  @RequirePermissions('inventory.procurement.manage')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateVendorInvoiceDto) {
    return this.service.create(orgId, userId, dto)
  }

  @Post(':id/payments')
  @RequirePermissions('inventory.procurement.manage')
  recordPayment(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RecordVendorInvoicePaymentDto,
  ) {
    return this.service.recordPayment(orgId, userId, id, dto)
  }

  @Post(':id/status')
  @RequirePermissions('inventory.procurement.manage')
  updateStatus(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorInvoiceStatusDto,
  ) {
    return this.service.updateStatus(orgId, userId, id, dto)
  }
}
