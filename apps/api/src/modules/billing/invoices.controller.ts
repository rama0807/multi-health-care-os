import { InvoiceQuery, InvoiceStatus, InvoiceType, JwtPayload } from '@medicore/types'
import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { PermissionsService } from '../../common/permissions/permissions.service'

import { AddInvoiceItemDto } from './dto/add-invoice-item.dto'
import { ApplyDiscountDto } from './dto/apply-discount.dto'
import { CancelInvoiceDto } from './dto/cancel-invoice.dto'
import { CreateInvoiceDto } from './dto/create-invoice.dto'
import { RejectDiscountDto } from './dto/reject-discount.dto'
import { InvoicesService } from './invoices.service'

/** Invoicing — see ADR-0015. `billing.*` stays all-scope (staff-facing). */
@ApiTags('billing-invoices')
@ApiBearerAuth()
@Controller({ path: 'billing/invoices', version: '1' })
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('billing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
    @Query('status') status?: InvoiceStatus,
    @Query('type') type?: InvoiceType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: InvoiceQuery['sortBy'],
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.invoicesService.list(orgId, {
      patientId,
      status,
      type,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      sortBy,
      sortOrder,
    })
  }

  @Get(':id')
  @RequirePermissions('billing.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.invoicesService.getById(orgId, id)
  }

  @Get(':id/pdf')
  @RequirePermissions('billing.read')
  async downloadPdf(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Res() reply: FastifyReply) {
    const { buffer, fileName } = await this.invoicesService.generatePdf(orgId, id)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer)
  }

  @Post()
  @RequirePermissions('billing.create')
  create(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Body() dto: CreateInvoiceDto) {
    return this.invoicesService.create(orgId, dto, userId)
  }

  @Post(':id/items')
  @RequirePermissions('billing.update')
  addItem(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: AddInvoiceItemDto,
  ) {
    return this.invoicesService.addItem(orgId, id, dto, userId)
  }

  @Post(':id/discount')
  @RequirePermissions('billing.update')
  applyDiscount(
    @CurrentUser() user: JwtPayload,
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: ApplyDiscountDto,
  ) {
    const canManage = this.permissionsService.has(user, 'billing', 'manage')
    return this.invoicesService.applyDiscount(orgId, id, dto, userId, canManage)
  }

  @Post(':id/discount/approve')
  @RequirePermissions('billing.manage')
  approveDiscount(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.invoicesService.approveDiscount(orgId, id, userId)
  }

  @Post(':id/discount/reject')
  @RequirePermissions('billing.manage')
  rejectDiscount(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: RejectDiscountDto,
  ) {
    return this.invoicesService.rejectDiscount(orgId, id, dto, userId)
  }

  @Patch(':id/finalize')
  @RequirePermissions('billing.update')
  finalize(@CurrentUser('orgId') orgId: string, @CurrentUser('sub') userId: string, @Param('id') id: string) {
    return this.invoicesService.finalize(orgId, id, userId)
  }

  @Patch(':id/cancel')
  @RequirePermissions('billing.update')
  cancel(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return this.invoicesService.cancel(orgId, id, dto, userId)
  }
}
