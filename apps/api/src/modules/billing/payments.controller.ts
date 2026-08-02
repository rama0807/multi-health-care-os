import { PaymentMode } from '@medicore/types'
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { CreatePaymentDto } from './dto/create-payment.dto'
import { PaymentsService } from './payments.service'

/** Payment collection — see ADR-0015. `billing.*` stays all-scope (staff-facing). */
@ApiTags('billing-payments')
@ApiBearerAuth()
@Controller({ path: 'billing', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('payments')
  @RequirePermissions('billing.read')
  list(
    @CurrentUser('orgId') orgId: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('patientId') patientId?: string,
    @Query('paymentMode') paymentMode?: PaymentMode,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.paymentsService.list(orgId, {
      invoiceId,
      patientId,
      paymentMode,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Get('payments/:id')
  @RequirePermissions('billing.read')
  getById(@CurrentUser('orgId') orgId: string, @Param('id') id: string) {
    return this.paymentsService.getById(orgId, id)
  }

  @Get('payments/:id/receipt/pdf')
  @RequirePermissions('billing.read')
  async downloadReceipt(@CurrentUser('orgId') orgId: string, @Param('id') id: string, @Res() reply: FastifyReply) {
    const { buffer, fileName } = await this.paymentsService.generateReceiptPdf(orgId, id)
    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${fileName}"`)
      .send(buffer)
  }

  @Post('invoices/:invoiceId/payments')
  @RequirePermissions('billing.create')
  create(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.create(orgId, invoiceId, dto, userId)
  }
}
