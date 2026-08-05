import { ReportFilterQuery, ReportGroupBy } from '@medicore/types'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AppointmentReportsService } from './appointment-reports.service'
import { BillingReportsService } from './billing-reports.service'
import { DoctorReportsService } from './doctor-reports.service'
import { InsuranceReportsService } from './insurance-reports.service'
import { InventoryReportsService } from './inventory-reports.service'
import { IpdReportsService } from './ipd-reports.service'
import { LaboratoryReportsService } from './laboratory-reports.service'
import { PatientReportsService } from './patient-reports.service'
import { PharmacyReportsService } from './pharmacy-reports.service'
import { RadiologyReportsService } from './radiology-reports.service'
import { StaffReportsService } from './staff-reports.service'

const GROUP_BY_VALUES: readonly string[] = ['day', 'week', 'month']

/**
 * Narrows raw query strings to the shared filter shape. An unrecognised
 * `groupBy` is dropped rather than rejected so a stale bookmark still
 * renders (falling back to the daily default) — the date bounds, where a
 * wrong value would silently change the answer, are validated in
 * `resolveRange` and do throw.
 */
export function toFilter(query: Record<string, string | undefined>): ReportFilterQuery {
  return {
    from: query.from || undefined,
    to: query.to || undefined,
    groupBy: GROUP_BY_VALUES.includes(query.groupBy ?? '') ? (query.groupBy as ReportGroupBy) : undefined,
    hospitalId: query.hospitalId || undefined,
    departmentId: query.departmentId || undefined,
    doctorId: query.doctorId || undefined,
  }
}

/**
 * Operational reports (Milestone 17 Checkpoint 17.1).
 *
 * Every endpoint is a read-only aggregation gated by the single `reports.read`
 * permission that already existed in the seed catalog — reporting is one
 * capability, not eleven, and splitting it per module would let an
 * organization grant "billing reports" to someone who cannot open billing.
 * Each service applies its own org scoping from the JWT; no handler accepts
 * an `organizationId` from the query string.
 */
@ApiTags('reports')
@ApiBearerAuth()
@Controller({ path: 'reports', version: '1' })
export class ReportsController {
  constructor(
    private readonly patientReports: PatientReportsService,
    private readonly appointmentReports: AppointmentReportsService,
    private readonly doctorReports: DoctorReportsService,
    private readonly laboratoryReports: LaboratoryReportsService,
    private readonly radiologyReports: RadiologyReportsService,
    private readonly pharmacyReports: PharmacyReportsService,
    private readonly inventoryReports: InventoryReportsService,
    private readonly billingReports: BillingReportsService,
    private readonly insuranceReports: InsuranceReportsService,
    private readonly ipdReports: IpdReportsService,
    private readonly staffReports: StaffReportsService,
  ) {}

  @Get('patients')
  @RequirePermissions('reports.read')
  patients(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.patientReports.getReport(orgId, toFilter(query))
  }

  @Get('appointments')
  @RequirePermissions('reports.read')
  appointments(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.appointmentReports.getReport(orgId, toFilter(query))
  }

  @Get('doctors')
  @RequirePermissions('reports.read')
  doctors(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.doctorReports.getReport(orgId, toFilter(query))
  }

  @Get('laboratory')
  @RequirePermissions('reports.read')
  laboratory(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.laboratoryReports.getReport(orgId, toFilter(query))
  }

  @Get('radiology')
  @RequirePermissions('reports.read')
  radiology(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.radiologyReports.getReport(orgId, toFilter(query))
  }

  @Get('pharmacy')
  @RequirePermissions('reports.read')
  pharmacy(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.pharmacyReports.getReport(orgId, toFilter(query))
  }

  @Get('inventory')
  @RequirePermissions('reports.read')
  inventory(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.inventoryReports.getReport(orgId, toFilter(query))
  }

  @Get('billing')
  @RequirePermissions('reports.read')
  billing(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.billingReports.getReport(orgId, toFilter(query))
  }

  @Get('insurance')
  @RequirePermissions('reports.read')
  insurance(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.insuranceReports.getReport(orgId, toFilter(query))
  }

  @Get('ipd')
  @RequirePermissions('reports.read')
  ipd(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.ipdReports.getReport(orgId, toFilter(query))
  }

  @Get('staff')
  @RequirePermissions('reports.read')
  staff(@CurrentUser('orgId') orgId: string, @Query() query: Record<string, string>) {
    return this.staffReports.getReport(orgId, toFilter(query))
  }
}
