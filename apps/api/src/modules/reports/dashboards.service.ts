import {
  DashboardChart,
  DashboardKpi,
  ExecutiveDashboard,
  ExecutiveDashboardKey,
  ReportFilterQuery,
  ReportSeriesPoint,
  ReportAmountSeriesPoint,
} from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

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

const DASHBOARD_TITLES: Record<ExecutiveDashboardKey, string> = {
  ceo: 'CEO Dashboard',
  'medical-director': 'Medical Director Dashboard',
  operations: 'Operations Dashboard',
  finance: 'Finance Dashboard',
  department: 'Department Dashboard',
}

export const DASHBOARD_KEYS = Object.keys(DASHBOARD_TITLES) as ExecutiveDashboardKey[]

/**
 * Executive dashboards (Milestone 17 Checkpoint 17.2).
 *
 * Every figure here is composed from the Checkpoint 17.1 report services —
 * this class runs no Prisma query of its own except the one lookup that
 * resolves a department's name. That is deliberate: a dashboard that
 * re-queried the same tables would eventually disagree with the report it
 * links to, and "revenue" would mean one thing on the CEO tile and another
 * on the billing report.
 *
 * The five dashboards differ only in *which* of those services they compose
 * and how they frame them, so the cost is one composition pass rather than
 * five parallel implementations.
 */
@Injectable()
export class DashboardsService {
  constructor(
    private readonly prisma: PrismaService,
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

  async getDashboard(
    organizationId: string,
    key: ExecutiveDashboardKey,
    query: ReportFilterQuery = {},
  ): Promise<ExecutiveDashboard> {
    switch (key) {
      case 'ceo':
        return this.ceo(organizationId, query)
      case 'medical-director':
        return this.medicalDirector(organizationId, query)
      case 'operations':
        return this.operations(organizationId, query)
      case 'finance':
        return this.finance(organizationId, query)
      case 'department':
        return this.department(organizationId, query)
      default:
        throw new BadRequestException(`Unknown dashboard "${key as string}"`)
    }
  }

  // ─── CEO ──────────────────────────────────────────────────────────────────

  private async ceo(organizationId: string, query: ReportFilterQuery): Promise<ExecutiveDashboard> {
    const [billing, patients, ipd, appointments, insurance] = await Promise.all([
      this.billingReports.getReport(organizationId, query),
      this.patientReports.getReport(organizationId, query),
      this.ipdReports.getReport(organizationId, query),
      this.appointmentReports.getReport(organizationId, query),
      this.insuranceReports.getReport(organizationId, query),
    ])

    return {
      key: 'ceo',
      title: DASHBOARD_TITLES.ceo,
      period: billing.period,
      kpis: [
        money('revenue', 'Revenue (invoiced)', billing.revenue, billing.revenueComparison.changePercent),
        money('collections', 'Collections', billing.collections, billing.collectionsComparison.changePercent),
        money('outstanding', 'Outstanding', billing.outstanding, null, false),
        count('patients', 'Active patients', patients.activePatients, null),
        count(
          'registrations',
          'New registrations',
          patients.registrations,
          patients.registrationsComparison.changePercent,
        ),
        count('admissions', 'Admissions', ipd.admissions, ipd.admissionsComparison.changePercent),
        percent('occupancy', 'Bed occupancy', ipd.bedOccupancyPercent, null),
        count('appointments', 'Appointments', appointments.total, appointments.totalComparison.changePercent),
      ],
      charts: [
        amountChart('revenue-trend', 'Revenue vs collections', 'area', [
          { key: 'revenue', label: 'Invoiced', points: billing.revenueTrend },
          { key: 'collections', label: 'Collected', points: billing.collectionTrend },
        ]),
        countChart('growth', 'Patient growth', 'line', [
          { key: 'registrations', label: 'New registrations', points: patients.registrationTrend },
          { key: 'admissions', label: 'Admissions', points: ipd.admissionTrend },
        ]),
        {
          key: 'revenue-mix',
          title: 'Revenue by invoice type',
          type: 'pie',
          data: billing.revenueByType.map((row) => ({ label: row.label, value: Number(row.amount) })),
          xKey: 'label',
          series: [{ key: 'value', label: 'Revenue' }],
          valueFormat: 'currency',
        },
      ],
      tables: [
        {
          key: 'payer-mix',
          title: 'Insurance payers',
          columns: [
            { key: 'providerName', label: 'Payer' },
            { key: 'claims', label: 'Claims', align: 'right' },
            { key: 'claimedAmount', label: 'Claimed', align: 'right' },
            { key: 'settlementRatePercent', label: 'Settled %', align: 'right' },
          ],
          rows: insurance.byProvider.slice(0, 10).map((row) => ({
            providerName: row.providerName,
            claims: row.claims,
            claimedAmount: row.claimedAmount,
            settlementRatePercent: row.settlementRatePercent,
          })),
        },
      ],
    }
  }

  // ─── Medical Director ─────────────────────────────────────────────────────

  private async medicalDirector(
    organizationId: string,
    query: ReportFilterQuery,
  ): Promise<ExecutiveDashboard> {
    const [doctors, appointments, laboratory, radiology, ipd] = await Promise.all([
      this.doctorReports.getReport(organizationId, query),
      this.appointmentReports.getReport(organizationId, query),
      this.laboratoryReports.getReport(organizationId, query),
      this.radiologyReports.getReport(organizationId, query),
      this.ipdReports.getReport(organizationId, query),
    ])

    return {
      key: 'medical-director',
      title: DASHBOARD_TITLES['medical-director'],
      period: doctors.period,
      kpis: [
        count('consultations', 'Consultations', doctors.totalConsultations, null),
        count('opd', 'OPD load', doctors.totalOpdLoad, null),
        count('ipd', 'IPD load', doctors.totalIpdLoad, null),
        percent('follow-up', 'Follow-up ratio', doctors.followUpRatioPercent, null),
        hours('lab-tat', 'Lab turnaround', laboratory.averageTurnaroundHours, {
          hint: `${laboratory.turnaroundSampleSize} reported orders`,
        }),
        hours('rad-tat', 'Radiology turnaround', radiology.averageTurnaroundHours, {
          hint: `${radiology.turnaroundSampleSize} reported studies`,
        }),
        days('los', 'Average stay', ipd.averageStayDays, {
          higherIsBetter: false,
          hint: `${ipd.stayLengthSampleSize} discharges`,
        }),
        percent('no-show', 'No-show rate', appointments.noShow.ratePercent, null, false),
      ],
      charts: [
        countChart('clinical-volume', 'Clinical volume', 'line', [
          { key: 'consultations', label: 'Consultations', points: doctors.consultationTrend },
          { key: 'lab', label: 'Lab orders', points: laboratory.volumeTrend },
          { key: 'radiology', label: 'Imaging', points: radiology.volumeTrend },
        ]),
        {
          key: 'doctor-load',
          title: 'Consultations by doctor',
          type: 'bar',
          data: doctors.doctors.slice(0, 12).map((d) => ({ label: d.doctorName, value: d.consultations })),
          xKey: 'label',
          series: [{ key: 'value', label: 'Consultations' }],
        },
      ],
      tables: [
        {
          key: 'doctor-workload',
          title: 'Doctor workload',
          columns: [
            { key: 'doctorName', label: 'Doctor' },
            { key: 'departmentName', label: 'Department' },
            { key: 'opdLoad', label: 'OPD', align: 'right' },
            { key: 'ipdLoad', label: 'IPD', align: 'right' },
            { key: 'followUpRatioPercent', label: 'Follow-up %', align: 'right' },
            { key: 'utilisationPercent', label: 'Utilisation %', align: 'right' },
          ],
          rows: doctors.doctors.slice(0, 25).map((d) => ({
            doctorName: d.doctorName,
            departmentName: d.departmentName,
            opdLoad: d.opdLoad,
            ipdLoad: d.ipdLoad,
            followUpRatioPercent: d.followUpRatioPercent,
            utilisationPercent:
              appointments.doctorUtilisation.find((u) => u.doctorId === d.doctorId)?.utilisationPercent ?? null,
          })),
          note: 'Utilisation is booked appointment minutes over scheduled availability; blank when the doctor has no active weekly schedule.',
        },
      ],
    }
  }

  // ─── Operations ───────────────────────────────────────────────────────────

  private async operations(organizationId: string, query: ReportFilterQuery): Promise<ExecutiveDashboard> {
    const [appointments, ipd, laboratory, radiology, pharmacy, staff, inventory] = await Promise.all([
      this.appointmentReports.getReport(organizationId, query),
      this.ipdReports.getReport(organizationId, query),
      this.laboratoryReports.getReport(organizationId, query),
      this.radiologyReports.getReport(organizationId, query),
      this.pharmacyReports.getReport(organizationId, query),
      this.staffReports.getReport(organizationId, query),
      this.inventoryReports.getReport(organizationId, query),
    ])

    return {
      key: 'operations',
      title: DASHBOARD_TITLES.operations,
      period: appointments.period,
      kpis: [
        count('appointments', 'Appointments', appointments.total, appointments.totalComparison.changePercent),
        percent('walk-in', 'Walk-in share', appointments.walkIn.ratePercent, null),
        count('inpatients', 'Current inpatients', ipd.currentInpatients, null),
        percent('occupancy', 'Bed occupancy', ipd.bedOccupancyPercent, null),
        count('lab-pending', 'Pending lab orders', laboratory.pending, null, false),
        count('rad-pending', 'Pending reports', radiology.pendingReports, null, false),
        count('low-stock', 'Low-stock medicines', pharmacy.lowStock.length, null, false),
        percent('attendance', 'Staff attendance', staff.overallAttendanceRatePercent, null),
      ],
      charts: [
        countChart('throughput', 'Daily throughput', 'bar', [
          { key: 'appointments', label: 'Appointments', points: appointments.dailyTrend },
          { key: 'admissions', label: 'Admissions', points: ipd.admissionTrend },
          { key: 'dispenses', label: 'Dispenses', points: pharmacy.dispenseTrend },
        ]),
        countChart('occupancy-trend', 'Bed occupancy rate', 'area', [
          { key: 'occupancy', label: 'Occupancy %', points: ipd.occupancyRateTrend },
        ]),
        {
          key: 'ward-heatmap',
          title: 'Ward occupancy',
          type: 'heatmap',
          data: ipd.wardOccupancy.map((w) => ({
            label: w.wardName,
            value: w.occupancyPercent,
            beds: w.totalBeds,
          })),
          xKey: 'label',
          series: [{ key: 'value', label: 'Occupancy %' }],
          valueFormat: 'percent',
        },
      ],
      tables: [
        {
          key: 'expiring',
          title: 'Medicines expiring within 90 days',
          columns: [
            { key: 'name', label: 'Medicine' },
            { key: 'batchNumber', label: 'Batch' },
            { key: 'currentStock', label: 'Stock', align: 'right' },
            { key: 'daysToExpiry', label: 'Days left', align: 'right' },
          ],
          rows: pharmacy.expiring.slice(0, 15).map((row) => ({
            name: row.name,
            batchNumber: row.batchNumber,
            currentStock: row.currentStock,
            daysToExpiry: row.daysToExpiry,
          })),
        },
        {
          key: 'consumption',
          title: 'Top consumed inventory items',
          columns: [
            { key: 'itemName', label: 'Item' },
            { key: 'categoryName', label: 'Category' },
            { key: 'quantityConsumed', label: 'Qty', align: 'right' },
            { key: 'value', label: 'Value', align: 'right' },
          ],
          rows: inventory.consumption.slice(0, 15).map((row) => ({
            itemName: row.itemName,
            categoryName: row.categoryName,
            quantityConsumed: row.quantityConsumed,
            value: row.value,
          })),
        },
      ],
    }
  }

  // ─── Finance ──────────────────────────────────────────────────────────────

  private async finance(organizationId: string, query: ReportFilterQuery): Promise<ExecutiveDashboard> {
    const [billing, insurance, inventory] = await Promise.all([
      this.billingReports.getReport(organizationId, query),
      this.insuranceReports.getReport(organizationId, query),
      this.inventoryReports.getReport(organizationId, query),
    ])

    return {
      key: 'finance',
      title: DASHBOARD_TITLES.finance,
      period: billing.period,
      kpis: [
        money('revenue', 'Revenue (invoiced)', billing.revenue, billing.revenueComparison.changePercent),
        money('collections', 'Collections', billing.collections, billing.collectionsComparison.changePercent),
        money('outstanding', 'Outstanding', billing.outstanding, null, false),
        money('discounts', 'Discounts', billing.discounts, null, false),
        money('refunds', 'Refunds', billing.refunds, null, false),
        money('tax', 'GST collected', billing.totalTax, null),
        money('claims', 'Insurance settled', insurance.settledAmount, null),
        money('purchases', 'Purchase value', inventory.purchaseValue, null, false),
      ],
      charts: [
        amountChart('cashflow', 'Invoiced vs collected', 'line', [
          { key: 'revenue', label: 'Invoiced', points: billing.revenueTrend },
          { key: 'collections', label: 'Collected', points: billing.collectionTrend },
        ]),
        {
          key: 'payment-modes',
          title: 'Collections by payment mode',
          type: 'pie',
          data: billing.collectionsByMode.map((row) => ({ label: row.label, value: Number(row.amount) })),
          xKey: 'label',
          series: [{ key: 'value', label: 'Collected' }],
          valueFormat: 'currency',
        },
        {
          key: 'ageing',
          title: 'Outstanding ageing',
          type: 'bar',
          data: billing.outstandingAgeing.map((row) => ({ label: row.label, value: Number(row.amount) })),
          xKey: 'label',
          series: [{ key: 'value', label: 'Outstanding' }],
          valueFormat: 'currency',
          note: 'Aged from each invoice due date where one is set, otherwise from its issue date.',
        },
      ],
      tables: [
        {
          key: 'gst',
          title: 'GST summary by slab',
          columns: [
            { key: 'taxPercent', label: 'Rate %' },
            { key: 'lineCount', label: 'Lines', align: 'right' },
            { key: 'taxableValue', label: 'Taxable value', align: 'right' },
            { key: 'taxAmount', label: 'Tax', align: 'right' },
          ],
          rows: billing.gstSummary.map((row) => ({ ...row })),
          note: 'Derived from stored invoice line totals, which are tax-inclusive. Not a substitute for a filed GST return.',
        },
        {
          key: 'vendors',
          title: 'Vendor performance',
          columns: [
            { key: 'vendorName', label: 'Vendor' },
            { key: 'purchaseOrders', label: 'POs', align: 'right' },
            { key: 'orderedValue', label: 'Ordered', align: 'right' },
            { key: 'fulfilmentRatePercent', label: 'Fulfilled %', align: 'right' },
            { key: 'averageLeadTimeDays', label: 'Lead time (d)', align: 'right' },
          ],
          rows: inventory.vendorPerformance.slice(0, 15).map((row) => ({
            vendorName: row.vendorName,
            purchaseOrders: row.purchaseOrders,
            orderedValue: row.orderedValue,
            fulfilmentRatePercent: row.fulfilmentRatePercent,
            averageLeadTimeDays: row.averageLeadTimeDays,
          })),
        },
      ],
    }
  }

  // ─── Department ───────────────────────────────────────────────────────────

  private async department(organizationId: string, query: ReportFilterQuery): Promise<ExecutiveDashboard> {
    if (!query.departmentId) {
      throw new BadRequestException('The department dashboard requires a "departmentId" filter')
    }

    const department = await this.prisma.department.findFirst({
      where: { id: query.departmentId, organizationId },
      select: { id: true, name: true },
    })
    if (!department) throw new NotFoundException('Department not found')

    const [appointments, doctors, ipd, staff] = await Promise.all([
      this.appointmentReports.getReport(organizationId, query),
      this.doctorReports.getReport(organizationId, query),
      this.ipdReports.getReport(organizationId, query),
      this.staffReports.getReport(organizationId, query),
    ])

    return {
      key: 'department',
      title: `${department.name} Dashboard`,
      period: appointments.period,
      departmentId: department.id,
      departmentName: department.name,
      kpis: [
        count('appointments', 'Appointments', appointments.total, appointments.totalComparison.changePercent),
        count('consultations', 'Consultations', doctors.totalConsultations, null),
        count('admissions', 'Admissions', ipd.admissions, ipd.admissionsComparison.changePercent),
        days('los', 'Average stay', ipd.averageStayDays, { higherIsBetter: false }),
        percent('no-show', 'No-show rate', appointments.noShow.ratePercent, null, false),
        percent('follow-up', 'Follow-up ratio', doctors.followUpRatioPercent, null),
        count('staff', 'Active staff', staff.activeStaff, null),
        percent('attendance', 'Staff attendance', staff.overallAttendanceRatePercent, null),
      ],
      charts: [
        countChart('volume', 'Department volume', 'line', [
          { key: 'appointments', label: 'Appointments', points: appointments.dailyTrend },
          { key: 'consultations', label: 'Consultations', points: doctors.consultationTrend },
          { key: 'admissions', label: 'Admissions', points: ipd.admissionTrend },
        ]),
        {
          key: 'status-mix',
          title: 'Appointment outcomes',
          type: 'pie',
          data: appointments.byStatus.map((row) => ({ label: row.label, value: row.count })),
          xKey: 'label',
          series: [{ key: 'value', label: 'Appointments' }],
        },
      ],
      tables: [
        {
          key: 'doctors',
          title: 'Doctors in this department',
          columns: [
            { key: 'doctorName', label: 'Doctor' },
            { key: 'specialization', label: 'Specialization' },
            { key: 'consultations', label: 'Consultations', align: 'right' },
            { key: 'ipdLoad', label: 'Admissions', align: 'right' },
          ],
          rows: doctors.doctors.map((d) => ({
            doctorName: d.doctorName,
            specialization: d.specialization,
            consultations: d.consultations,
            ipdLoad: d.ipdLoad,
          })),
        },
        {
          key: 'wards',
          title: 'Ward occupancy',
          columns: [
            { key: 'wardName', label: 'Ward' },
            { key: 'totalBeds', label: 'Beds', align: 'right' },
            { key: 'occupiedBeds', label: 'Occupied', align: 'right' },
            { key: 'occupancyPercent', label: 'Occupancy %', align: 'right' },
          ],
          rows: ipd.wardOccupancy.map((w) => ({
            wardName: w.wardName,
            totalBeds: w.totalBeds,
            occupiedBeds: w.occupiedBeds,
            occupancyPercent: w.occupancyPercent,
          })),
        },
      ],
    }
  }
}

// ─── KPI/chart builders ─────────────────────────────────────────────────────

function money(
  key: string,
  label: string,
  value: string,
  change: number | null,
  higherIsBetter = true,
): DashboardKpi {
  return { key, label, value, format: 'currency', changePercent: change, higherIsBetter }
}

function count(
  key: string,
  label: string,
  value: number,
  change: number | null,
  higherIsBetter = true,
): DashboardKpi {
  return { key, label, value: String(value), format: 'number', changePercent: change, higherIsBetter }
}

function percent(
  key: string,
  label: string,
  value: number,
  change: number | null,
  higherIsBetter = true,
): DashboardKpi {
  return { key, label, value: String(value), format: 'percent', changePercent: change, higherIsBetter }
}

/**
 * A null measurement renders as an em dash rather than 0 — "no discharges to
 * measure" and "discharged the same day" are different facts and must not
 * look identical on a tile.
 */
function days(
  key: string,
  label: string,
  value: number | null,
  opts: { higherIsBetter?: boolean; hint?: string } = {},
): DashboardKpi {
  return {
    key,
    label,
    value: value === null ? '—' : String(value),
    format: 'days',
    changePercent: null,
    higherIsBetter: opts.higherIsBetter ?? true,
    ...(opts.hint ? { hint: opts.hint } : {}),
  }
}

function hours(
  key: string,
  label: string,
  value: number | null,
  opts: { higherIsBetter?: boolean; hint?: string } = {},
): DashboardKpi {
  return {
    key,
    label,
    value: value === null ? '—' : String(value),
    format: 'hours',
    changePercent: null,
    higherIsBetter: opts.higherIsBetter ?? false,
    ...(opts.hint ? { hint: opts.hint } : {}),
  }
}

/** Zips several equally-bucketed series into the row-per-bucket shape Recharts wants. */
function countChart(
  key: string,
  title: string,
  type: DashboardChart['type'],
  series: Array<{ key: string; label: string; points: ReportSeriesPoint[] }>,
): DashboardChart {
  const buckets = series[0]?.points.map((p) => p.bucket) ?? []
  return {
    key,
    title,
    type,
    xKey: 'bucket',
    series: series.map(({ key: seriesKey, label }) => ({ key: seriesKey, label })),
    data: buckets.map((bucket, index) => {
      const row: Record<string, string | number> = { bucket }
      for (const s of series) row[s.key] = s.points[index]?.value ?? 0
      return row
    }),
  }
}

function amountChart(
  key: string,
  title: string,
  type: DashboardChart['type'],
  series: Array<{ key: string; label: string; points: ReportAmountSeriesPoint[] }>,
): DashboardChart {
  const buckets = series[0]?.points.map((p) => p.bucket) ?? []
  return {
    key,
    title,
    type,
    xKey: 'bucket',
    valueFormat: 'currency',
    series: series.map(({ key: seriesKey, label }) => ({ key: seriesKey, label })),
    data: buckets.map((bucket, index) => {
      const row: Record<string, string | number> = { bucket }
      for (const s of series) row[s.key] = Number(s.points[index]?.amount ?? 0)
      return row
    }),
  }
}
