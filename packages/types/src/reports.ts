import { z } from 'zod'

// Reports & Analytics (Milestone 17 / ADR-0026).
//
// Every shape here describes a *read-only aggregation* over data other
// modules already own. Nothing in this file introduces a new clinical,
// billing or inventory concept — if a number cannot be derived from an
// existing column it is not reported (see TECH_DEBT for the two metrics
// this rule genuinely constrains: appointment waiting time and radiology
// machine utilisation).

// ─── Shared query/primitive shapes ──────────────────────────────────────────

/** Time-series bucket granularity. */
export type ReportGroupBy = 'day' | 'week' | 'month'

/** Export formats supported by the report engine (Checkpoint 17.3). */
export type ReportExportFormat = 'csv' | 'xlsx' | 'pdf'

/**
 * The filter set every operational report accepts. `from`/`to` are ISO
 * date strings (`YYYY-MM-DD` or a full ISO timestamp); omitting them
 * defaults to the last 30 days. `hospitalId`/`departmentId`/`doctorId`
 * are only honoured by reports whose underlying table can actually be
 * narrowed by them — each report documents which it supports.
 */
export interface ReportFilterQuery {
  from?: string
  to?: string
  groupBy?: ReportGroupBy
  hospitalId?: string
  departmentId?: string
  doctorId?: string
}

/** The resolved range a report actually ran over, echoed back to the caller. */
export interface ReportPeriod {
  from: string
  to: string
  groupBy: ReportGroupBy
  /** Number of whole days in `[from, to)`. */
  days: number
}

/** One point on a time series. `bucket` is the bucket's start date (YYYY-MM-DD). */
export interface ReportSeriesPoint {
  bucket: string
  value: number
}

/** One point on a monetary time series — amounts are fixed-2 decimal strings. */
export interface ReportAmountSeriesPoint {
  bucket: string
  amount: string
}

/** A named count, used for every breakdown/distribution in this file. */
export interface ReportBreakdown {
  label: string
  count: number
}

/** A named monetary total. */
export interface ReportAmountBreakdown {
  label: string
  amount: string
}

/**
 * Period-over-period comparison: the same metric measured over the
 * requested range and over the immediately preceding range of equal
 * length. `changePercent` is null when the previous period was zero
 * (an undefined growth rate is reported as null, never as 0 or 100).
 */
export interface ReportComparison {
  current: number
  previous: number
  changePercent: number | null
}

export interface ReportAmountComparison {
  current: string
  previous: string
  changePercent: number | null
}

// ─── 17.1 Patient reports ───────────────────────────────────────────────────

export interface PatientAgeBand {
  label: string
  minAge: number
  /** Exclusive upper bound; null for the open-ended top band. */
  maxAge: number | null
  count: number
}

export interface PatientReport {
  period: ReportPeriod
  /** Patients registered in the period. */
  registrations: number
  registrationTrend: ReportSeriesPoint[]
  /**
   * Patients with at least one appointment, encounter or admission in the
   * period — "active" means clinically seen, not `Patient.isActive`.
   */
  activePatients: number
  /** Registered-in-period patients who were seen in the period. */
  newPatients: number
  /** Patients seen in the period who registered before it. */
  returningPatients: number
  ageDistribution: PatientAgeBand[]
  genderDistribution: ReportBreakdown[]
  registrationsComparison: ReportComparison
}

// ─── 17.1 Appointment reports ───────────────────────────────────────────────

export interface DoctorUtilisationRow {
  doctorId: string
  doctorName: string
  departmentName: string | null
  /** Appointments booked in the period, any status. */
  booked: number
  completed: number
  cancelled: number
  noShow: number
  /** Minutes of booked appointment time. */
  bookedMinutes: number
  /**
   * Booked minutes as a percentage of the doctor's scheduled availability
   * over the same period, derived from `DoctorSchedule`/`DoctorScheduleDay`.
   * Null when the doctor has no active weekly schedule to measure against.
   */
  utilisationPercent: number | null
}

export interface AppointmentReport {
  period: ReportPeriod
  total: number
  dailyTrend: ReportSeriesPoint[]
  byStatus: ReportBreakdown[]
  byType: ReportBreakdown[]
  doctorUtilisation: DoctorUtilisationRow[]
  /**
   * Mean minutes between an appointment's `scheduledAt` and the start of
   * its `Encounter` — a *scheduling delay*, not a waiting-room time. No
   * arrival/check-in timestamp exists in this schema (TD-0051), so this is
   * the closest honest measure and is labelled as such in the UI. Null when
   * no appointment in the period has a linked encounter.
   */
  averageConsultationDelayMinutes: number | null
  /** Sample size behind `averageConsultationDelayMinutes`. */
  consultationDelaySampleSize: number
  noShow: {
    count: number
    /** No-shows as a percentage of appointments that reached a terminal state. */
    ratePercent: number
    byDoctor: ReportBreakdown[]
    trend: ReportSeriesPoint[]
  }
  walkIn: {
    count: number
    ratePercent: number
    trend: ReportSeriesPoint[]
  }
  totalComparison: ReportComparison
}

// ─── 17.1 Doctor reports ────────────────────────────────────────────────────

export interface DoctorWorkloadRow {
  doctorId: string
  doctorName: string
  specialization: string
  departmentName: string | null
  /** Non-IPD encounters — the outpatient consultation load. */
  opdLoad: number
  /** Admissions where this doctor is the attending physician. */
  ipdLoad: number
  /** All encounters authored by the doctor in the period. */
  consultations: number
  followUps: number
  /** Follow-up encounters as a percentage of the doctor's consultations. */
  followUpRatioPercent: number
  labOrders: number
  radiologyOrders: number
  prescriptions: number
}

export interface DoctorReport {
  period: ReportPeriod
  totalOpdLoad: number
  totalIpdLoad: number
  totalConsultations: number
  followUpRatioPercent: number
  doctors: DoctorWorkloadRow[]
  consultationTrend: ReportSeriesPoint[]
}

// ─── 17.1 Laboratory reports ────────────────────────────────────────────────

export interface LabTestVolumeRow {
  testCode: string
  testName: string
  category: string
  performed: number
  abnormal: number
  /** Revenue is sourced from `Charge` rows with `sourceModule = LABORATORY`. */
  revenue: string
}

export interface LaboratoryReport {
  period: ReportPeriod
  ordersPlaced: number
  testsPerformed: number
  pending: number
  byStatus: ReportBreakdown[]
  byCategory: ReportBreakdown[]
  volumeTrend: ReportSeriesPoint[]
  /**
   * Mean hours from order creation to `reportedAt` over orders reported in
   * the period. Null when nothing was reported.
   */
  averageTurnaroundHours: number | null
  turnaroundSampleSize: number
  topTests: LabTestVolumeRow[]
  totalRevenue: string
  revenueTrend: ReportAmountSeriesPoint[]
}

// ─── 17.1 Radiology reports ─────────────────────────────────────────────────

export interface RadiologyMachineRow {
  machine: string
  studies: number
  /** Sum of `RadiologyOrder.durationMinutes` for studies on this machine. */
  scheduledMinutes: number
  /** Share of all scheduled radiology minutes in the period. */
  sharePercent: number
}

export interface RadiologyReportStats {
  period: ReportPeriod
  investigations: number
  pendingReports: number
  byStatus: ReportBreakdown[]
  byModality: ReportBreakdown[]
  volumeTrend: ReportSeriesPoint[]
  averageTurnaroundHours: number | null
  turnaroundSampleSize: number
  /**
   * Relative machine load, derived from scheduled study minutes. This is not
   * a duty-cycle utilisation figure — no machine-capacity or operating-hours
   * model exists in this schema (TD-0052).
   */
  machineUtilisation: RadiologyMachineRow[]
  totalRevenue: string
}

// ─── 17.1 Pharmacy reports ──────────────────────────────────────────────────

export interface DispensedMedicineRow {
  drugId: string | null
  medicationName: string
  quantityDispensed: number
  dispenseCount: number
  /** `quantityDispensed` × the drug's catalog price; null for unmatched drugs. */
  revenue: string | null
}

export interface PharmacyStockAlertRow {
  drugId: string
  name: string
  batchNumber: string
  currentStock: number
  availableStock: number
  minStockLevel: number
  reorderLevel: number
  expiryDate: string
  daysToExpiry: number
}

export interface PharmacyReport {
  period: ReportPeriod
  ordersDispensed: number
  itemsDispensed: number
  totalQuantityDispensed: number
  dispenseTrend: ReportSeriesPoint[]
  byStatus: ReportBreakdown[]
  topMedicines: DispensedMedicineRow[]
  lowStock: PharmacyStockAlertRow[]
  expiring: PharmacyStockAlertRow[]
  expired: PharmacyStockAlertRow[]
  totalRevenue: string
}

// ─── 17.1 Inventory reports ─────────────────────────────────────────────────

export interface InventoryConsumptionRow {
  itemId: string
  itemName: string
  itemCode: string
  categoryName: string | null
  /** Net negative movement across issues/adjustments in the period. */
  quantityConsumed: number
  /** `quantityConsumed` × `InventoryItem.unitCost`. */
  value: string
}

export interface VendorPerformanceRow {
  vendorId: string
  vendorName: string
  purchaseOrders: number
  orderedValue: string
  /** Purchase orders fully received (every line's received >= ordered). */
  fullyReceived: number
  fulfilmentRatePercent: number
  /** Mean days from PO creation to its last goods-receipt note. */
  averageLeadTimeDays: number | null
  /** Mean of this vendor's `VendorRating` rows; null when never rated. */
  averageRating: number | null
}

export interface StockValuationRow {
  storeId: string
  storeName: string
  items: number
  units: number
  value: string
}

export interface InventoryReport {
  period: ReportPeriod
  consumption: InventoryConsumptionRow[]
  totalConsumptionValue: string
  consumptionTrend: ReportAmountSeriesPoint[]
  purchaseOrders: number
  purchaseValue: string
  purchaseTrend: ReportAmountSeriesPoint[]
  vendorPerformance: VendorPerformanceRow[]
  stockValuation: StockValuationRow[]
  totalStockValue: string
}

// ─── 17.1 Billing reports ───────────────────────────────────────────────────

export interface GstSlabRow {
  /** Tax percent as a fixed-2 string, e.g. "18.00". */
  taxPercent: string
  taxableValue: string
  taxAmount: string
  lineCount: number
}

export interface OutstandingAgeingRow {
  label: string
  invoices: number
  amount: string
}

export interface BillingReport {
  period: ReportPeriod
  /** Invoiced value (finalised invoices raised in the period). */
  revenue: string
  revenueTrend: ReportAmountSeriesPoint[]
  revenueByType: ReportAmountBreakdown[]
  /** Cash actually received in the period. */
  collections: string
  collectionTrend: ReportAmountSeriesPoint[]
  collectionsByMode: ReportAmountBreakdown[]
  outstanding: string
  outstandingInvoices: number
  outstandingAgeing: OutstandingAgeingRow[]
  discounts: string
  discountedInvoices: number
  refunds: string
  refundCount: number
  gstSummary: GstSlabRow[]
  totalTaxableValue: string
  totalTax: string
  revenueComparison: ReportAmountComparison
  collectionsComparison: ReportAmountComparison
}

// ─── 17.1 Insurance reports ─────────────────────────────────────────────────

export interface InsuranceProviderPerformanceRow {
  providerId: string | null
  providerName: string
  claims: number
  claimedAmount: string
  approvedAmount: string
  settledClaims: number
  settlementRatePercent: number
  averageApprovalDays: number | null
}

export interface InsuranceReport {
  period: ReportPeriod
  claims: number
  claimedAmount: string
  approvedAmount: string
  settledAmount: string
  byStatus: ReportBreakdown[]
  claimTrend: ReportSeriesPoint[]
  /** Settled (or partially settled) claims as a share of decided claims. */
  settlementRatePercent: number
  /** Mean days from `submittedAt` to `settledAt`. */
  averageSettlementDays: number | null
  /** Mean days from pre-auth `submittedAt` to `decidedAt`. */
  averagePreAuthApprovalDays: number | null
  pendingClaims: number
  pendingClaimedAmount: string
  pendingPreAuthorizations: number
  byProvider: InsuranceProviderPerformanceRow[]
}

// ─── 17.1 IPD reports ───────────────────────────────────────────────────────

export interface WardOccupancyRow {
  wardId: string
  wardName: string
  wardType: string
  totalBeds: number
  occupiedBeds: number
  availableBeds: number
  occupancyPercent: number
  admissionsInPeriod: number
  averageStayDays: number | null
}

export interface IpdReport {
  period: ReportPeriod
  admissions: number
  discharges: number
  currentInpatients: number
  admissionTrend: ReportSeriesPoint[]
  byType: ReportBreakdown[]
  /** Mean days between `admittedAt` and `dischargedAt` for discharges in the period. */
  averageStayDays: number | null
  stayLengthSampleSize: number
  totalBeds: number
  occupiedBeds: number
  bedOccupancyPercent: number
  /** Occupied bed-days divided by available bed-days, bucketed across the period. */
  occupancyRateTrend: ReportSeriesPoint[]
  wardOccupancy: WardOccupancyRow[]
  admissionsComparison: ReportComparison
}

// ─── 17.1 Staff reports ─────────────────────────────────────────────────────

export interface StaffAttendanceRow {
  staffId: string
  employeeId: string
  staffName: string
  departmentName: string | null
  present: number
  late: number
  absent: number
  onLeave: number
  workedMinutes: number
  overtimeMinutes: number
  attendanceRatePercent: number
}

export interface StaffReport {
  period: ReportPeriod
  totalStaff: number
  activeStaff: number
  attendanceByStatus: ReportBreakdown[]
  attendanceTrend: ReportSeriesPoint[]
  overallAttendanceRatePercent: number
  totalOvertimeMinutes: number
  leaveByType: ReportBreakdown[]
  leaveDaysTaken: number
  pendingLeaveRequests: number
  departmentStrength: ReportBreakdown[]
  staff: StaffAttendanceRow[]
}

// ─── 17.2 Executive dashboards ──────────────────────────────────────────────

export type ExecutiveDashboardKey = 'ceo' | 'medical-director' | 'operations' | 'finance' | 'department'

/** A headline KPI tile. `format` tells the UI how to render `value`. */
export interface DashboardKpi {
  key: string
  label: string
  value: string
  format: 'number' | 'currency' | 'percent' | 'days' | 'hours'
  /** Period-over-period change, null when there is no meaningful previous value. */
  changePercent: number | null
  /** Whether a rise in this metric is good — drives the up/down colouring. */
  higherIsBetter: boolean
  hint?: string
}

export interface DashboardChart {
  key: string
  title: string
  type: 'line' | 'bar' | 'area' | 'pie' | 'heatmap'
  /** Free-form rows; `series` names which numeric keys to plot. */
  data: Array<Record<string, string | number>>
  xKey: string
  series: Array<{ key: string; label: string }>
  /** Rendering hint for currency axes/tooltips. */
  valueFormat?: 'number' | 'currency' | 'percent'
  note?: string
}

export interface DashboardTable {
  key: string
  title: string
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>
  rows: Array<Record<string, string | number | null>>
  note?: string
}

export interface ExecutiveDashboard {
  key: ExecutiveDashboardKey
  title: string
  period: ReportPeriod
  kpis: DashboardKpi[]
  charts: DashboardChart[]
  tables: DashboardTable[]
  /** Populated only by the department dashboard. */
  departmentId?: string | null
  departmentName?: string | null
}

// ─── 17.3 Report builder ────────────────────────────────────────────────────

export type ReportColumnType = 'string' | 'number' | 'currency' | 'percent' | 'date'

export interface ReportColumnDef {
  key: string
  label: string
  type: ReportColumnType
}

export type ReportFilterKey = 'from' | 'to' | 'groupBy' | 'hospitalId' | 'departmentId' | 'doctorId'

/** A runnable report in the registry — the single source of truth for the builder. */
export interface ReportDefinition {
  key: string
  label: string
  module: string
  description: string
  /** Which of the shared filters this report actually honours. */
  filters: ReportFilterKey[]
  columns: ReportColumnDef[]
}

export interface ReportRunResult {
  definition: ReportDefinition
  period: ReportPeriod
  rows: Array<Record<string, string | number | null>>
  totalRows: number
  /** Set when `rows` was capped — the UI must disclose the truncation. */
  truncated: boolean
}

export interface SavedReport {
  id: string
  organizationId: string
  name: string
  description: string | null
  reportKey: string
  filters: ReportFilterQuery
  isShared: boolean
  createdByUserId: string
  createdByName: string | null
  /**
   * Scheduling is a **placeholder** in Milestone 17 — the fields are
   * persisted so Milestone 18 (Notifications) has somewhere to read from,
   * but nothing in this repo dispatches a scheduled report yet (TD-0053).
   */
  scheduleEnabled: boolean
  scheduleCron: string | null
  scheduleRecipients: string[]
  lastRunAt: Date | string | null
  createdAt: Date | string
  updatedAt: Date | string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/

export const ReportFilterSchema = z.object({
  from: z.string().regex(ISO_DATE, 'Format: YYYY-MM-DD').optional(),
  to: z.string().regex(ISO_DATE, 'Format: YYYY-MM-DD').optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
  hospitalId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  doctorId: z.string().min(1).optional(),
})

export const CreateSavedReportSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  reportKey: z.string().min(1).max(80),
  filters: ReportFilterSchema.optional(),
  isShared: z.boolean().optional(),
  scheduleEnabled: z.boolean().optional(),
  // Validated for shape even though nothing dispatches it yet (TD-0053) —
  // persisting an unparseable cron would just move the failure to whoever
  // builds the dispatcher in Milestone 18.
  scheduleCron: z
    .string()
    .regex(/^(\S+\s+){4}\S+$/, 'Format: 5-field cron expression, e.g. "0 6 * * 1"')
    .optional(),
  scheduleRecipients: z.array(z.string().email()).max(20).optional(),
})

export type CreateSavedReportDto = z.infer<typeof CreateSavedReportSchema>

export const UpdateSavedReportSchema = CreateSavedReportSchema.partial()

export type UpdateSavedReportDto = z.infer<typeof UpdateSavedReportSchema>

export interface SavedReportQuery {
  page?: number
  limit?: number
  reportKey?: string
  search?: string
}
