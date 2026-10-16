import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'
import { DentalGuard } from '../../common/guards/dental.guard'

import { DentalBillingService } from './dental-billing.service'
import { CreateDentalInvoiceDto, CreateDentalPaymentDto } from './dto'

/**
 * REST API controller for Grovyn Dental OS Billing.
 * Protected by DentalGuard to ensure only Dental organization members can access it.
 */
@ApiTags('Dental Billing')
@ApiBearerAuth()
@UseGuards(DentalGuard)
@Controller('dental/billing')
export class DentalBillingController {
  constructor(private readonly dentalBillingService: DentalBillingService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List dental invoices for the organization' })
  @RequirePermissions('dental_billing.view')
  getInvoices(
    @CurrentUser('orgId') orgId: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.dentalBillingService.getInvoices(orgId, patientId)
  }

  @Post('invoices')
  @ApiOperation({ summary: 'Create a new dental invoice' })
  @RequirePermissions('dental_billing.manage')
  createInvoice(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateDentalInvoiceDto,
  ) {
    return this.dentalBillingService.createInvoice(orgId, userId, dto)
  }

  @Post('invoices/:id/payments')
  @ApiOperation({ summary: 'Record a payment against a dental invoice' })
  @RequirePermissions('dental_billing.manage')
  recordPayment(
    @CurrentUser('orgId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Param('id') invoiceId: string,
    @Body() dto: CreateDentalPaymentDto,
  ) {
    return this.dentalBillingService.recordPayment(orgId, userId, invoiceId, dto)
  }
}
