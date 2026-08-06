import { Module } from '@nestjs/common'

import { NotificationsModule } from '../notifications/notifications.module'

import { AppointmentReportsService } from './appointment-reports.service'
import { BillingReportsService } from './billing-reports.service'
import { DashboardsController } from './dashboards.controller'
import { DashboardsService } from './dashboards.service'
import { DoctorReportsService } from './doctor-reports.service'
import { InsuranceReportsService } from './insurance-reports.service'
import { InventoryReportsService } from './inventory-reports.service'
import { IpdReportsService } from './ipd-reports.service'
import { LaboratoryReportsService } from './laboratory-reports.service'
import { PatientReportsService } from './patient-reports.service'
import { PharmacyReportsService } from './pharmacy-reports.service'
import { RadiologyReportsService } from './radiology-reports.service'
import { ReportBuilderController } from './report-builder.controller'
import { ReportExportService } from './report-export.service'
import { ReportRegistryService } from './report-registry.service'
import { ReportsController } from './reports.controller'
import { SavedReportsService } from './saved-reports.service'
import { ScheduledReportsDispatcher } from './scheduled-reports.dispatcher'
import { StaffReportsService } from './staff-reports.service'

/**
 * Reports & Analytics (Milestone 17 / ADR-0026).
 *
 * A pure read layer: it writes to exactly one table (`SavedReport`) and no
 * clinical, billing or inventory table. The one piece of another module's
 * business logic it reuses (`ShiftsService.standardMinutes`, for overtime) is
 * a static helper called directly rather than pulled in through DI, which
 * keeps the reporting layer free of module cycles.
 *
 * Milestone 18 added its single module import - see the `imports` note below.
 */
@Module({
  // Milestone 18 adds the only import this module has ever needed: scheduled
  // reports notify their owner in-app when a run completes (TD-0053). The
  // dependency is one-way - the notification module reads `report-range.util`
  // as a plain function, never through DI - so no cycle is possible.
  imports: [NotificationsModule],
  controllers: [ReportsController, DashboardsController, ReportBuilderController],
  providers: [
    ScheduledReportsDispatcher,
    DashboardsService,
    ReportRegistryService,
    ReportExportService,
    SavedReportsService,
    PatientReportsService,
    AppointmentReportsService,
    DoctorReportsService,
    LaboratoryReportsService,
    RadiologyReportsService,
    PharmacyReportsService,
    InventoryReportsService,
    BillingReportsService,
    InsuranceReportsService,
    IpdReportsService,
    StaffReportsService,
  ],
  exports: [
    PatientReportsService,
    AppointmentReportsService,
    DoctorReportsService,
    LaboratoryReportsService,
    RadiologyReportsService,
    PharmacyReportsService,
    InventoryReportsService,
    BillingReportsService,
    InsuranceReportsService,
    IpdReportsService,
    StaffReportsService,
  ],
})
export class ReportsModule {}
