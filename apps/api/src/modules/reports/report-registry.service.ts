import {
  ReportColumnDef,
  ReportDefinition,
  ReportFilterKey,
  ReportFilterQuery,
  ReportPeriod,
  ReportRunResult,
} from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'

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

/** Rows beyond this are dropped, and `truncated` is set so the UI can say so. */
export const MAX_EXPORT_ROWS = 5000

type ReportRow = Record<string, string | number | null>

interface RegistryEntry extends ReportDefinition {
  run: (organizationId: string, query: ReportFilterQuery) => Promise<{ rows: ReportRow[]; period: ReportPeriod }>
}

/** Filters every date-ranged report honours. */
const RANGE_FILTERS: ReportFilterKey[] = ['from', 'to', 'groupBy']
const CLINICAL_FILTERS: ReportFilterKey[] = [...RANGE_FILTERS, 'hospitalId', 'departmentId', 'doctorId']

const col = (key: string, label: string, type: ReportColumnDef['type'] = 'string'): ReportColumnDef => ({
  key,
  label,
  type,
})

/**
 * Projects a registry entry down to the public definition, listing the fields
 * explicitly rather than spreading around `run` — the definition is what
 * crosses the API boundary, so it should be built by inclusion, not by
 * remembering to exclude the one field that must never be serialised.
 */
function toDefinition(entry: RegistryEntry): ReportDefinition {
  return {
    key: entry.key,
    label: entry.label,
    module: entry.module,
    description: entry.description,
    filters: entry.filters,
    columns: entry.columns,
  }
}

/**
 * The report builder's registry (Milestone 17 Checkpoint 17.3).
 *
 * Every runnable report is one entry pairing a `ReportDefinition` (what the
 * builder UI renders as filters and columns) with a `run` function that
 * reshapes an existing Checkpoint 17.1 service's output into flat rows.
 * Nothing here queries the database directly — the registry is a projection
 * layer, so CSV, Excel and PDF export share exactly one code path and can
 * never drift from the on-screen report they came from.
 */
@Injectable()
export class ReportRegistryService {
  private readonly entries: Map<string, RegistryEntry>

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
  ) {
    this.entries = new Map(this.buildEntries().map((entry) => [entry.key, entry]))
  }

  listDefinitions(): ReportDefinition[] {
    return [...this.entries.values()]
      .map(toDefinition)
      .sort((a, b) => a.module.localeCompare(b.module) || a.label.localeCompare(b.label))
  }

  getDefinition(key: string): ReportDefinition {
    const entry = this.entries.get(key)
    if (!entry) throw new NotFoundException(`Unknown report "${key}"`)
    return toDefinition(entry)
  }

  async run(organizationId: string, key: string, query: ReportFilterQuery): Promise<ReportRunResult> {
    const entry = this.entries.get(key)
    if (!entry) throw new NotFoundException(`Unknown report "${key}"`)

    const { rows, period } = await entry.run(organizationId, query)

    return {
      definition: toDefinition(entry),
      period,
      rows: rows.slice(0, MAX_EXPORT_ROWS),
      totalRows: rows.length,
      truncated: rows.length > MAX_EXPORT_ROWS,
    }
  }

  private buildEntries(): RegistryEntry[] {
    return [
      // ─── Patients ─────────────────────────────────────────────────────────
      {
        key: 'patients.registrations',
        label: 'Patient registrations',
        module: 'Patients',
        description: 'New patient registrations per bucket over the selected range.',
        filters: RANGE_FILTERS,
        columns: [col('bucket', 'Period', 'date'), col('registrations', 'Registrations', 'number')],
        run: async (orgId, query) => {
          const report = await this.patientReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.registrationTrend.map((p) => ({ bucket: p.bucket, registrations: p.value })),
          }
        },
      },
      {
        key: 'patients.demographics',
        label: 'Patient age & gender distribution',
        module: 'Patients',
        description:
          'Age bands and gender split across the period cohort (patients registered in, or seen during, the range).',
        filters: RANGE_FILTERS,
        columns: [col('band', 'Age band'), col('count', 'Patients', 'number')],
        run: async (orgId, query) => {
          const report = await this.patientReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: [
              ...report.ageDistribution.map((b) => ({ band: b.label, count: b.count })),
              ...report.genderDistribution.map((g) => ({ band: `Gender: ${g.label}`, count: g.count })),
            ],
          }
        },
      },

      // ─── Appointments ─────────────────────────────────────────────────────
      {
        key: 'appointments.volume',
        label: 'Appointment volume',
        module: 'Appointments',
        description: 'Appointments booked per bucket, with no-show and walk-in counts.',
        filters: CLINICAL_FILTERS,
        columns: [
          col('bucket', 'Period', 'date'),
          col('appointments', 'Appointments', 'number'),
          col('noShows', 'No-shows', 'number'),
          col('walkIns', 'Walk-ins', 'number'),
        ],
        run: async (orgId, query) => {
          const report = await this.appointmentReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.dailyTrend.map((point, index) => ({
              bucket: point.bucket,
              appointments: point.value,
              noShows: report.noShow.trend[index]?.value ?? 0,
              walkIns: report.walkIn.trend[index]?.value ?? 0,
            })),
          }
        },
      },
      {
        key: 'appointments.doctor-utilisation',
        label: 'Doctor utilisation',
        module: 'Appointments',
        description:
          "Booked appointment minutes against each doctor's scheduled availability, with outcome counts.",
        filters: CLINICAL_FILTERS,
        columns: [
          col('doctorName', 'Doctor'),
          col('departmentName', 'Department'),
          col('booked', 'Booked', 'number'),
          col('completed', 'Completed', 'number'),
          col('cancelled', 'Cancelled', 'number'),
          col('noShow', 'No-show', 'number'),
          col('bookedMinutes', 'Booked minutes', 'number'),
          col('utilisationPercent', 'Utilisation', 'percent'),
        ],
        run: async (orgId, query) => {
          const report = await this.appointmentReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.doctorUtilisation.map(({ doctorId: _doctorId, ...row }) => ({ ...row })),
          }
        },
      },

      // ─── Doctors ──────────────────────────────────────────────────────────
      {
        key: 'doctors.workload',
        label: 'Doctor workload',
        module: 'Doctors',
        description: 'OPD and IPD load, consultation counts, follow-up ratio and orders raised per doctor.',
        filters: CLINICAL_FILTERS,
        columns: [
          col('doctorName', 'Doctor'),
          col('specialization', 'Specialization'),
          col('departmentName', 'Department'),
          col('opdLoad', 'OPD', 'number'),
          col('ipdLoad', 'IPD', 'number'),
          col('consultations', 'Consultations', 'number'),
          col('followUpRatioPercent', 'Follow-up ratio', 'percent'),
          col('labOrders', 'Lab orders', 'number'),
          col('radiologyOrders', 'Imaging orders', 'number'),
          col('prescriptions', 'Prescriptions', 'number'),
        ],
        run: async (orgId, query) => {
          const report = await this.doctorReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.doctors.map(({ doctorId: _doctorId, followUps: _followUps, ...row }) => ({ ...row })),
          }
        },
      },

      // ─── Laboratory ───────────────────────────────────────────────────────
      {
        key: 'laboratory.tests',
        label: 'Lab tests performed',
        module: 'Laboratory',
        description:
          "Volume, abnormal count and allocated revenue per test. Revenue is billing-module charges split evenly across an order's tests.",
        filters: CLINICAL_FILTERS,
        columns: [
          col('testCode', 'Code'),
          col('testName', 'Test'),
          col('category', 'Category'),
          col('performed', 'Performed', 'number'),
          col('abnormal', 'Abnormal', 'number'),
          col('revenue', 'Revenue', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.laboratoryReports.getReport(orgId, query)
          return { period: report.period, rows: report.topTests.map((row) => ({ ...row })) }
        },
      },
      {
        key: 'laboratory.volume',
        label: 'Lab order volume',
        module: 'Laboratory',
        description: 'Lab orders placed per bucket, with the revenue booked in the same bucket.',
        filters: CLINICAL_FILTERS,
        columns: [
          col('bucket', 'Period', 'date'),
          col('orders', 'Orders', 'number'),
          col('revenue', 'Revenue', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.laboratoryReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.volumeTrend.map((point, index) => ({
              bucket: point.bucket,
              orders: point.value,
              revenue: report.revenueTrend[index]?.amount ?? '0.00',
            })),
          }
        },
      },

      // ─── Radiology ────────────────────────────────────────────────────────
      {
        key: 'radiology.machines',
        label: 'Radiology machine load',
        module: 'Radiology',
        description:
          'Studies and scheduled minutes per machine. Relative load only — this schema models no machine capacity.',
        filters: CLINICAL_FILTERS,
        columns: [
          col('machine', 'Machine'),
          col('studies', 'Studies', 'number'),
          col('scheduledMinutes', 'Scheduled minutes', 'number'),
          col('sharePercent', 'Share', 'percent'),
        ],
        run: async (orgId, query) => {
          const report = await this.radiologyReports.getReport(orgId, query)
          return { period: report.period, rows: report.machineUtilisation.map((row) => ({ ...row })) }
        },
      },
      {
        key: 'radiology.volume',
        label: 'Radiology volume by modality',
        module: 'Radiology',
        description: 'Investigations ordered per modality over the range.',
        filters: CLINICAL_FILTERS,
        columns: [col('label', 'Modality'), col('count', 'Studies', 'number')],
        run: async (orgId, query) => {
          const report = await this.radiologyReports.getReport(orgId, query)
          return { period: report.period, rows: report.byModality.map((row) => ({ ...row })) }
        },
      },

      // ─── Pharmacy ─────────────────────────────────────────────────────────
      {
        key: 'pharmacy.top-medicines',
        label: 'Top dispensed medicines',
        module: 'Pharmacy',
        description: 'Quantity dispensed and revenue per medicine over the range.',
        filters: RANGE_FILTERS,
        columns: [
          col('medicationName', 'Medicine'),
          col('quantityDispensed', 'Quantity', 'number'),
          col('dispenseCount', 'Dispense lines', 'number'),
          col('revenue', 'Revenue', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.pharmacyReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.topMedicines.map(({ drugId: _drugId, ...row }) => ({ ...row })),
          }
        },
      },
      {
        key: 'pharmacy.low-stock',
        label: 'Low-stock medicines',
        module: 'Pharmacy',
        description: 'Batches at or below their reorder level, measured on available (unreserved) stock.',
        filters: [],
        columns: [
          col('name', 'Medicine'),
          col('batchNumber', 'Batch'),
          col('currentStock', 'Stock', 'number'),
          col('availableStock', 'Available', 'number'),
          col('reorderLevel', 'Reorder level', 'number'),
          col('expiryDate', 'Expiry', 'date'),
        ],
        run: async (orgId, query) => {
          const report = await this.pharmacyReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.lowStock.map((row) => ({
              name: row.name,
              batchNumber: row.batchNumber,
              currentStock: row.currentStock,
              availableStock: row.availableStock,
              reorderLevel: row.reorderLevel,
              expiryDate: row.expiryDate,
            })),
          }
        },
      },
      {
        key: 'pharmacy.expiring',
        label: 'Expiring & expired medicines',
        module: 'Pharmacy',
        description: 'Batches expiring within 90 days, plus those already expired.',
        filters: [],
        columns: [
          col('name', 'Medicine'),
          col('batchNumber', 'Batch'),
          col('currentStock', 'Stock', 'number'),
          col('expiryDate', 'Expiry', 'date'),
          col('daysToExpiry', 'Days left', 'number'),
        ],
        run: async (orgId, query) => {
          const report = await this.pharmacyReports.getReport(orgId, query)
          const toRow = (r: { name: string; batchNumber: string; currentStock: number; expiryDate: string; daysToExpiry: number }) => ({
            name: r.name,
            batchNumber: r.batchNumber,
            currentStock: r.currentStock,
            expiryDate: r.expiryDate,
            daysToExpiry: r.daysToExpiry,
          })
          return { period: report.period, rows: [...report.expired.map(toRow), ...report.expiring.map(toRow)] }
        },
      },

      // ─── Inventory ────────────────────────────────────────────────────────
      {
        key: 'inventory.consumption',
        label: 'Inventory consumption',
        module: 'Inventory',
        description: 'Stock consumed per item, valued at catalog unit cost. Inter-store transfers excluded.',
        filters: RANGE_FILTERS,
        columns: [
          col('itemCode', 'Code'),
          col('itemName', 'Item'),
          col('categoryName', 'Category'),
          col('quantityConsumed', 'Quantity', 'number'),
          col('value', 'Value', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.inventoryReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.consumption.map(({ itemId: _itemId, ...row }) => ({ ...row })),
          }
        },
      },
      {
        key: 'inventory.vendors',
        label: 'Vendor performance',
        module: 'Inventory',
        description: 'Purchase orders, fulfilment rate, lead time and average rating per vendor.',
        filters: RANGE_FILTERS,
        columns: [
          col('vendorName', 'Vendor'),
          col('purchaseOrders', 'Purchase orders', 'number'),
          col('orderedValue', 'Ordered value', 'currency'),
          col('fullyReceived', 'Fully received', 'number'),
          col('fulfilmentRatePercent', 'Fulfilment', 'percent'),
          col('averageLeadTimeDays', 'Lead time (days)', 'number'),
          col('averageRating', 'Rating', 'number'),
        ],
        run: async (orgId, query) => {
          const report = await this.inventoryReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.vendorPerformance.map(({ vendorId: _vendorId, ...row }) => ({ ...row })),
          }
        },
      },
      {
        key: 'inventory.valuation',
        label: 'Stock valuation by store',
        module: 'Inventory',
        description: 'Saleable stock value per store, excluding damaged, expired and lost quantities.',
        filters: [],
        columns: [
          col('storeName', 'Store'),
          col('items', 'Item lines', 'number'),
          col('units', 'Units', 'number'),
          col('value', 'Value', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.inventoryReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.stockValuation.map(({ storeId: _storeId, ...row }) => ({ ...row })),
          }
        },
      },

      // ─── Billing ──────────────────────────────────────────────────────────
      {
        key: 'billing.revenue',
        label: 'Revenue & collections',
        module: 'Billing',
        description:
          'Invoiced value and cash collected per bucket. These are different measures and will not match.',
        filters: RANGE_FILTERS,
        columns: [
          col('bucket', 'Period', 'date'),
          col('invoiced', 'Invoiced', 'currency'),
          col('collected', 'Collected', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.billingReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.revenueTrend.map((point, index) => ({
              bucket: point.bucket,
              invoiced: point.amount,
              collected: report.collectionTrend[index]?.amount ?? '0.00',
            })),
          }
        },
      },
      {
        key: 'billing.outstanding',
        label: 'Outstanding ageing',
        module: 'Billing',
        description: 'Unpaid invoice balances bucketed by age. A live balance, not scoped to the date range.',
        filters: [],
        columns: [
          col('label', 'Age'),
          col('invoices', 'Invoices', 'number'),
          col('amount', 'Outstanding', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.billingReports.getReport(orgId, query)
          return { period: report.period, rows: report.outstandingAgeing.map((row) => ({ ...row })) }
        },
      },
      {
        key: 'billing.gst',
        label: 'GST summary',
        module: 'Billing',
        description:
          'Taxable value and tax per slab, derived from stored invoice lines. Not a substitute for a filed return.',
        filters: RANGE_FILTERS,
        columns: [
          col('taxPercent', 'Rate %'),
          col('lineCount', 'Lines', 'number'),
          col('taxableValue', 'Taxable value', 'currency'),
          col('taxAmount', 'Tax', 'currency'),
        ],
        run: async (orgId, query) => {
          const report = await this.billingReports.getReport(orgId, query)
          return { period: report.period, rows: report.gstSummary.map((row) => ({ ...row })) }
        },
      },

      // ─── Insurance ────────────────────────────────────────────────────────
      {
        key: 'insurance.providers',
        label: 'Claims by payer',
        module: 'Insurance',
        description: 'Claim volume, amounts, settlement rate and approval time per insurer or TPA.',
        filters: RANGE_FILTERS,
        columns: [
          col('providerName', 'Payer'),
          col('claims', 'Claims', 'number'),
          col('claimedAmount', 'Claimed', 'currency'),
          col('approvedAmount', 'Approved', 'currency'),
          col('settledClaims', 'Settled', 'number'),
          col('settlementRatePercent', 'Settlement rate', 'percent'),
          col('averageApprovalDays', 'Approval (days)', 'number'),
        ],
        run: async (orgId, query) => {
          const report = await this.insuranceReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.byProvider.map(({ providerId: _providerId, ...row }) => ({ ...row })),
          }
        },
      },

      // ─── IPD ──────────────────────────────────────────────────────────────
      {
        key: 'ipd.wards',
        label: 'Ward occupancy',
        module: 'IPD',
        description: 'Beds, live occupancy and average stay per ward.',
        filters: [...RANGE_FILTERS, 'departmentId'],
        columns: [
          col('wardName', 'Ward'),
          col('wardType', 'Type'),
          col('totalBeds', 'Beds', 'number'),
          col('occupiedBeds', 'Occupied', 'number'),
          col('availableBeds', 'Available', 'number'),
          col('occupancyPercent', 'Occupancy', 'percent'),
          col('admissionsInPeriod', 'Admissions', 'number'),
          col('averageStayDays', 'Avg stay (days)', 'number'),
        ],
        run: async (orgId, query) => {
          const report = await this.ipdReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.wardOccupancy.map(({ wardId: _wardId, ...row }) => ({ ...row })),
          }
        },
      },
      {
        key: 'ipd.admissions',
        label: 'Admissions & occupancy trend',
        module: 'IPD',
        description: 'Admissions per bucket alongside the bed-days occupancy rate for the same bucket.',
        filters: CLINICAL_FILTERS,
        columns: [
          col('bucket', 'Period', 'date'),
          col('admissions', 'Admissions', 'number'),
          col('occupancyPercent', 'Occupancy', 'percent'),
        ],
        run: async (orgId, query) => {
          const report = await this.ipdReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.admissionTrend.map((point, index) => ({
              bucket: point.bucket,
              admissions: point.value,
              occupancyPercent: report.occupancyRateTrend[index]?.value ?? 0,
            })),
          }
        },
      },

      // ─── Staff ────────────────────────────────────────────────────────────
      {
        key: 'staff.attendance',
        label: 'Staff attendance',
        module: 'Staff',
        description:
          "Per-staff attendance counts, worked minutes and overtime. Overtime uses the rostered shift's standard hours.",
        filters: [...RANGE_FILTERS, 'hospitalId', 'departmentId'],
        columns: [
          col('employeeId', 'Employee ID'),
          col('staffName', 'Staff'),
          col('departmentName', 'Department'),
          col('present', 'Present', 'number'),
          col('late', 'Late', 'number'),
          col('absent', 'Absent', 'number'),
          col('onLeave', 'On leave', 'number'),
          col('workedMinutes', 'Worked minutes', 'number'),
          col('overtimeMinutes', 'Overtime minutes', 'number'),
          col('attendanceRatePercent', 'Attendance', 'percent'),
        ],
        run: async (orgId, query) => {
          const report = await this.staffReports.getReport(orgId, query)
          return {
            period: report.period,
            rows: report.staff.map(({ staffId: _staffId, ...row }) => ({ ...row })),
          }
        },
      },
      {
        key: 'staff.departments',
        label: 'Department strength',
        module: 'Staff',
        description: 'Active staff headcount per department.',
        filters: ['hospitalId'],
        columns: [col('label', 'Department'), col('count', 'Active staff', 'number')],
        run: async (orgId, query) => {
          const report = await this.staffReports.getReport(orgId, query)
          return { period: report.period, rows: report.departmentStrength.map((row) => ({ ...row })) }
        },
      },
      {
        key: 'staff.leave',
        label: 'Leave trends',
        module: 'Staff',
        description: 'Approved leave requests by type over the range.',
        filters: [...RANGE_FILTERS, 'hospitalId', 'departmentId'],
        columns: [col('label', 'Leave type'), col('count', 'Requests', 'number')],
        run: async (orgId, query) => {
          const report = await this.staffReports.getReport(orgId, query)
          return { period: report.period, rows: report.leaveByType.map((row) => ({ ...row })) }
        },
      },
    ]
  }
}
