import { Module } from '@nestjs/common'

import { AppointmentInvoiceListener } from './appointment-invoice.listener'
import { BillingDashboardService } from './billing-dashboard.service'
import { BillingController } from './billing.controller'
import { ChargesController } from './charges.controller'
import { ChargesService } from './charges.service'
import { InvoicesController } from './invoices.controller'
import { InvoicesService } from './invoices.service'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { RefundsController } from './refunds.controller'
import { RefundsService } from './refunds.service'
import { ServiceCatalogController } from './service-catalog.controller'
import { ServiceCatalogService } from './service-catalog.service'

/**
 * Billing - see ADR-0015. Insurance is explicitly out of scope this
 * milestone (per instruction) - `InsuranceModule` remains its own
 * untouched scaffold, picked up in Milestone 11.
 */
@Module({
  controllers: [
    BillingController,
    ServiceCatalogController,
    ChargesController,
    InvoicesController,
    PaymentsController,
    RefundsController,
  ],
  providers: [
    BillingDashboardService,
    ServiceCatalogService,
    ChargesService,
    InvoicesService,
    PaymentsService,
    RefundsService,
    AppointmentInvoiceListener,
  ],
  exports: [ServiceCatalogService, ChargesService, InvoicesService, PaymentsService, RefundsService],
})
export class BillingModule {}
