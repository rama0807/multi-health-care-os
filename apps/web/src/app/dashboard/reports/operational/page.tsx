'use client'

import type {
  DashboardChart,
  ReportAmountSeriesPoint,
  ReportBreakdown,
  ReportFilterQuery,
  ReportSeriesPoint,
} from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getAppointmentReport,
  getBillingReport,
  getDoctorReport,
  getInsuranceReport,
  getInventoryReport,
  getIpdReport,
  getLaboratoryReport,
  getPatientReport,
  getPharmacyReport,
  getRadiologyReport,
  getStaffReport,
} from '@/lib/api/reports'

import { ChartCard } from '../_components/charts'
import { ReportFilters, defaultFilters } from '../_components/report-filters'

// ─── Shared view shape ───────────────────────────────────────────────────────

interface ModuleView {
  stats: Array<{ label: string; value: string }>
  charts: DashboardChart[]
  table?: {
    title: string
    columns: string[]
    rows: Array<Array<string | number | null>>
    note?: string
  }
}

/**
 * One entry per module. `load` fetches *and* shapes in a single typed step,
 * so every field access below is checked against the real report type — no
 * `any` bridge between the API client and the renderer.
 */
interface ModuleConfig {
  key: string
  label: string
  /** Rendered only where the underlying tables genuinely support it. */
  doctorFilter?: boolean
  load: (filters: ReportFilterQuery) => Promise<ModuleView>
}

// ─── Chart/stat adapters ─────────────────────────────────────────────────────

const line = (key: string, title: string, points: ReportSeriesPoint[], label: string): DashboardChart => ({
  key,
  title,
  type: 'line',
  xKey: 'bucket',
  series: [{ key: 'value', label }],
  data: points.map((p) => ({ bucket: p.bucket, value: p.value })),
})

const bars = (
  key: string,
  title: string,
  points: ReportAmountSeriesPoint[],
  label: string,
): DashboardChart => ({
  key,
  title,
  type: 'bar',
  xKey: 'bucket',
  valueFormat: 'currency',
  series: [{ key: 'value', label }],
  data: points.map((p) => ({ bucket: p.bucket, value: Number(p.amount) })),
})

const pie = (key: string, title: string, rows: ReportBreakdown[]): DashboardChart => ({
  key,
  title,
  type: 'pie',
  xKey: 'label',
  series: [{ key: 'value', label: 'Count' }],
  data: rows.map((r) => ({ label: r.label, value: r.count })),
})

const categoryBars = (
  key: string,
  title: string,
  rows: Array<{ label: string; value: number }>,
  seriesLabel: string,
  valueFormat?: DashboardChart['valueFormat'],
): DashboardChart => ({
  key,
  title,
  type: 'bar',
  xKey: 'label',
  ...(valueFormat ? { valueFormat } : {}),
  series: [{ key: 'value', label: seriesLabel }],
  data: rows,
})

const money = (value: string) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const orDash = (value: number | null, suffix = '') => (value === null ? '—' : `${value}${suffix}`)

// ─── Module definitions ──────────────────────────────────────────────────────

const MODULES: ModuleConfig[] = [
  {
    key: 'patients',
    label: 'Patients',
    load: async (filters) => {
      const report = await getPatientReport(filters)
      return {
        stats: [
          { label: 'Registrations', value: String(report.registrations) },
          { label: 'Active patients', value: String(report.activePatients) },
          { label: 'New patients', value: String(report.newPatients) },
          { label: 'Returning patients', value: String(report.returningPatients) },
        ],
        charts: [
          line('reg', 'Daily registrations', report.registrationTrend, 'Registrations'),
          pie('gender', 'Gender distribution', report.genderDistribution),
          categoryBars(
            'age',
            'Age distribution',
            report.ageDistribution.map((b) => ({ label: b.label, value: b.count })),
            'Patients',
          ),
        ],
      }
    },
  },
  {
    key: 'appointments',
    label: 'Appointments',
    doctorFilter: true,
    load: async (filters) => {
      const report = await getAppointmentReport(filters)
      return {
        stats: [
          { label: 'Appointments', value: String(report.total) },
          { label: 'No-show rate', value: `${report.noShow.ratePercent}%` },
          { label: 'Walk-in share', value: `${report.walkIn.ratePercent}%` },
          { label: 'Avg consultation delay', value: orDash(report.averageConsultationDelayMinutes, ' min') },
        ],
        charts: [
          line('daily', 'Daily appointments', report.dailyTrend, 'Appointments'),
          pie('status', 'By status', report.byStatus),
          line('noshow', 'No-shows', report.noShow.trend, 'No-shows'),
        ],
        table: {
          title: 'Doctor utilisation',
          columns: ['Doctor', 'Department', 'Booked', 'Completed', 'No-show', 'Utilisation %'],
          rows: report.doctorUtilisation.map((d) => [
            d.doctorName,
            d.departmentName,
            d.booked,
            d.completed,
            d.noShow,
            d.utilisationPercent,
          ]),
          note: 'Consultation delay is measured from the scheduled slot to when the encounter was opened — this system records no arrival time, so it is a scheduling delay, not a waiting-room time.',
        },
      }
    },
  },
  {
    key: 'doctors',
    label: 'Doctors',
    doctorFilter: true,
    load: async (filters) => {
      const report = await getDoctorReport(filters)
      return {
        stats: [
          { label: 'Consultations', value: String(report.totalConsultations) },
          { label: 'OPD load', value: String(report.totalOpdLoad) },
          { label: 'IPD load', value: String(report.totalIpdLoad) },
          { label: 'Follow-up ratio', value: `${report.followUpRatioPercent}%` },
        ],
        charts: [
          line('cons', 'Consultations', report.consultationTrend, 'Consultations'),
          categoryBars(
            'load',
            'Consultations by doctor',
            report.doctors.slice(0, 12).map((d) => ({ label: d.doctorName, value: d.consultations })),
            'Consultations',
          ),
        ],
        table: {
          title: 'Workload by doctor',
          columns: ['Doctor', 'Specialization', 'OPD', 'IPD', 'Consultations', 'Follow-up %'],
          rows: report.doctors.map((d) => [
            d.doctorName,
            d.specialization,
            d.opdLoad,
            d.ipdLoad,
            d.consultations,
            d.followUpRatioPercent,
          ]),
        },
      }
    },
  },
  {
    key: 'laboratory',
    label: 'Laboratory',
    doctorFilter: true,
    load: async (filters) => {
      const report = await getLaboratoryReport(filters)
      return {
        stats: [
          { label: 'Orders placed', value: String(report.ordersPlaced) },
          { label: 'Tests performed', value: String(report.testsPerformed) },
          { label: 'Pending', value: String(report.pending) },
          { label: 'Avg turnaround', value: orDash(report.averageTurnaroundHours, ' h') },
        ],
        charts: [
          line('vol', 'Order volume', report.volumeTrend, 'Orders'),
          bars('rev', 'Lab revenue', report.revenueTrend, 'Revenue'),
          pie('cat', 'By category', report.byCategory),
        ],
        table: {
          title: 'Tests performed',
          columns: ['Code', 'Test', 'Category', 'Performed', 'Abnormal', 'Revenue'],
          rows: report.topTests.map((t) => [
            t.testCode,
            t.testName,
            t.category,
            t.performed,
            t.abnormal,
            money(t.revenue),
          ]),
          note: "Revenue comes from billing-module charges raised against the lab order, split evenly across that order's tests.",
        },
      }
    },
  },
  {
    key: 'radiology',
    label: 'Radiology',
    doctorFilter: true,
    load: async (filters) => {
      const report = await getRadiologyReport(filters)
      return {
        stats: [
          { label: 'Investigations', value: String(report.investigations) },
          { label: 'Pending reports', value: String(report.pendingReports) },
          { label: 'Avg turnaround', value: orDash(report.averageTurnaroundHours, ' h') },
          { label: 'Revenue', value: money(report.totalRevenue) },
        ],
        charts: [
          line('vol', 'Study volume', report.volumeTrend, 'Studies'),
          pie('mod', 'By modality', report.byModality),
        ],
        table: {
          title: 'Machine load',
          columns: ['Machine', 'Studies', 'Scheduled minutes', 'Share %'],
          rows: report.machineUtilisation.map((m) => [
            m.machine,
            m.studies,
            m.scheduledMinutes,
            m.sharePercent,
          ]),
          note: 'Relative load only — this system models no machine capacity or operating hours, so this is not a duty-cycle utilisation figure.',
        },
      }
    },
  },
  {
    key: 'pharmacy',
    label: 'Pharmacy',
    load: async (filters) => {
      const report = await getPharmacyReport(filters)
      return {
        stats: [
          { label: 'Orders dispensed', value: String(report.ordersDispensed) },
          { label: 'Units dispensed', value: String(report.totalQuantityDispensed) },
          { label: 'Low stock', value: String(report.lowStock.length) },
          { label: 'Expiring / expired', value: `${report.expiring.length} / ${report.expired.length}` },
        ],
        charts: [line('disp', 'Dispensing volume', report.dispenseTrend, 'Dispenses')],
        table: {
          title: 'Top dispensed medicines',
          columns: ['Medicine', 'Quantity', 'Lines', 'Revenue'],
          rows: report.topMedicines.map((m) => [
            m.medicationName,
            m.quantityDispensed,
            m.dispenseCount,
            m.revenue === null ? null : money(m.revenue),
          ]),
          note: 'Revenue is blank for dispensed items the pharmacist never resolved to a priced catalog batch.',
        },
      }
    },
  },
  {
    key: 'inventory',
    label: 'Inventory',
    load: async (filters) => {
      const report = await getInventoryReport(filters)
      return {
        stats: [
          { label: 'Consumption value', value: money(report.totalConsumptionValue) },
          { label: 'Purchase orders', value: String(report.purchaseOrders) },
          { label: 'Purchase value', value: money(report.purchaseValue) },
          { label: 'Stock value', value: money(report.totalStockValue) },
        ],
        charts: [
          bars('cons', 'Consumption value', report.consumptionTrend, 'Consumed'),
          bars('po', 'Purchase value', report.purchaseTrend, 'Purchased'),
        ],
        table: {
          title: 'Vendor performance',
          columns: ['Vendor', 'POs', 'Ordered', 'Fulfilment %', 'Lead time (d)', 'Rating'],
          rows: report.vendorPerformance.map((v) => [
            v.vendorName,
            v.purchaseOrders,
            money(v.orderedValue),
            v.fulfilmentRatePercent,
            v.averageLeadTimeDays,
            v.averageRating,
          ]),
        },
      }
    },
  },
  {
    key: 'billing',
    label: 'Billing',
    load: async (filters) => {
      const report = await getBillingReport(filters)
      return {
        stats: [
          { label: 'Revenue (invoiced)', value: money(report.revenue) },
          { label: 'Collections', value: money(report.collections) },
          { label: 'Outstanding', value: money(report.outstanding) },
          { label: 'Refunds', value: money(report.refunds) },
        ],
        charts: [
          bars('rev', 'Invoiced revenue', report.revenueTrend, 'Invoiced'),
          bars('coll', 'Collections', report.collectionTrend, 'Collected'),
          categoryBars(
            'ageing',
            'Outstanding ageing',
            report.outstandingAgeing.map((r) => ({ label: r.label, value: Number(r.amount) })),
            'Outstanding',
            'currency',
          ),
        ],
        table: {
          title: 'GST summary',
          columns: ['Rate %', 'Lines', 'Taxable value', 'Tax'],
          rows: report.gstSummary.map((g) => [
            g.taxPercent,
            g.lineCount,
            money(g.taxableValue),
            money(g.taxAmount),
          ]),
          note: 'Derived from stored invoice line totals. Not a substitute for a filed GST return.',
        },
      }
    },
  },
  {
    key: 'insurance',
    label: 'Insurance',
    load: async (filters) => {
      const report = await getInsuranceReport(filters)
      return {
        stats: [
          { label: 'Claims', value: String(report.claims) },
          { label: 'Settlement rate', value: `${report.settlementRatePercent}%` },
          { label: 'Avg settlement', value: orDash(report.averageSettlementDays, ' d') },
          { label: 'Pending claims', value: String(report.pendingClaims) },
        ],
        charts: [
          line('claims', 'Claims filed', report.claimTrend, 'Claims'),
          pie('status', 'By status', report.byStatus),
        ],
        table: {
          title: 'Payer performance',
          columns: ['Payer', 'Claims', 'Claimed', 'Approved', 'Settlement %', 'Approval (d)'],
          rows: report.byProvider.map((p) => [
            p.providerName,
            p.claims,
            money(p.claimedAmount),
            money(p.approvedAmount),
            p.settlementRatePercent,
            p.averageApprovalDays,
          ]),
        },
      }
    },
  },
  {
    key: 'ipd',
    label: 'IPD',
    doctorFilter: true,
    load: async (filters) => {
      const report = await getIpdReport(filters)
      return {
        stats: [
          { label: 'Admissions', value: String(report.admissions) },
          { label: 'Discharges', value: String(report.discharges) },
          { label: 'Avg stay', value: orDash(report.averageStayDays, ' d') },
          { label: 'Bed occupancy', value: `${report.bedOccupancyPercent}%` },
        ],
        charts: [
          line('adm', 'Admissions', report.admissionTrend, 'Admissions'),
          line('occ', 'Bed-days occupancy rate', report.occupancyRateTrend, 'Occupancy %'),
          {
            key: 'ward-heat',
            title: 'Ward occupancy',
            type: 'heatmap',
            xKey: 'label',
            valueFormat: 'percent',
            series: [{ key: 'value', label: 'Occupancy %' }],
            data: report.wardOccupancy.map((w) => ({ label: w.wardName, value: w.occupancyPercent })),
          },
        ],
        table: {
          title: 'Ward occupancy',
          columns: ['Ward', 'Type', 'Beds', 'Occupied', 'Occupancy %', 'Admissions', 'Avg stay (d)'],
          rows: report.wardOccupancy.map((w) => [
            w.wardName,
            w.wardType,
            w.totalBeds,
            w.occupiedBeds,
            w.occupancyPercent,
            w.admissionsInPeriod,
            w.averageStayDays,
          ]),
        },
      }
    },
  },
  {
    key: 'staff',
    label: 'Staff',
    load: async (filters) => {
      const report = await getStaffReport(filters)
      return {
        stats: [
          { label: 'Active staff', value: String(report.activeStaff) },
          { label: 'Attendance rate', value: `${report.overallAttendanceRatePercent}%` },
          { label: 'Overtime', value: `${Math.round(report.totalOvertimeMinutes / 60)} h` },
          { label: 'Leave days', value: String(report.leaveDaysTaken) },
        ],
        charts: [
          line('att', 'Daily attendance', report.attendanceTrend, 'Present'),
          pie('status', 'Attendance by status', report.attendanceByStatus),
          pie('dept', 'Department strength', report.departmentStrength),
        ],
        table: {
          title: 'Attendance by staff member',
          columns: ['Employee', 'Name', 'Department', 'Present', 'Late', 'Absent', 'Attendance %'],
          rows: report.staff.map((s) => [
            s.employeeId,
            s.staffName,
            s.departmentName,
            s.present,
            s.late,
            s.absent,
            s.attendanceRatePercent,
          ]),
        },
      }
    },
  },
]

/** Operational reports (Milestone 17 Checkpoints 17.1/17.4). */
export default function OperationalReportsPage() {
  const [moduleKey, setModuleKey] = useState<string>('patients')
  const [filters, setFilters] = useState<ReportFilterQuery>(defaultFilters())

  const config = MODULES.find((m) => m.key === moduleKey) ?? MODULES[0]

  const reportQuery = useQuery({
    queryKey: ['reports', 'operational', config.key, filters],
    queryFn: () => config.load(filters),
  })
  const view = reportQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Operational Reports</h1>
          <p className="text-sm text-muted-foreground">Module-by-module operational analytics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/reports">Dashboards</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/reports/builder">Report builder</Link>
          </Button>
        </div>
      </div>

      <Tabs value={config.key} onValueChange={setModuleKey}>
        <TabsList className="flex-wrap">
          {MODULES.map((m) => (
            <TabsTrigger key={m.key} value={m.key}>
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ReportFilters
        value={filters}
        onChange={setFilters}
        show={config.doctorFilter ? ['groupBy', 'doctorId'] : ['groupBy']}
      />

      {reportQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
        </div>
      ) : reportQuery.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Could not load this report. {reportQuery.error.message}
        </div>
      ) : view ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {view.stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border bg-card p-4 shadow-sm">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {view.charts.map((chart) => (
              <ChartCard key={chart.key} chart={chart} />
            ))}
          </div>

          {view.table && (
            <div className="rounded-lg border bg-card shadow-sm">
              <div className="border-b p-4">
                <h3 className="text-sm font-semibold text-foreground">{view.table.title}</h3>
                {view.table.note && <p className="mt-0.5 text-xs text-muted-foreground">{view.table.note}</p>}
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {view.table.columns.map((column, index) => (
                        <TableHead key={column} className={index === 0 ? undefined : 'text-right'}>
                          {column}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {view.table.rows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={view.table.columns.length}
                          className="text-center text-sm text-muted-foreground"
                        >
                          No data for the selected period
                        </TableCell>
                      </TableRow>
                    ) : (
                      view.table.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell
                              key={cellIndex}
                              className={cellIndex === 0 ? undefined : 'text-right tabular-nums'}
                            >
                              {/* An absent measurement prints as a dash, never as 0. */}
                              {cell === null || cell === undefined ? '—' : String(cell)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
