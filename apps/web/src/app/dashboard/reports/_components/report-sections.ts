import type { DashboardChart, DashboardKpi, ReportAmountSeriesPoint, ReportBreakdown, ReportFilterQuery, ReportSeriesPoint } from '@medicore/types'

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
} from '@/lib/api/reports'

import type { ModuleView } from './module-section'

/**
 * Domain-analytics loaders for the redesigned Reports & Analytics hub.
 *
 * Every function here only *reshapes* what the Milestone 17 report services
 * already return - `ReportFilterQuery` in, `ModuleView` (kpis/charts/tables,
 * the same shapes the executive dashboards use) out. No new metric is
 * computed here; where a report exposes a period-over-period comparison
 * (`*Comparison` fields), it is surfaced as a trend KPI - where it doesn't,
 * the stat renders with no trend rather than a fabricated one.
 */

// ─── KPI builders ────────────────────────────────────────────────────────────

function kpi(
  key: string,
  label: string,
  value: string,
  format: DashboardKpi['format'],
  opts: { changePercent?: number | null; higherIsBetter?: boolean; hint?: string } = {},
): DashboardKpi {
  return {
    key,
    label,
    value,
    format,
    changePercent: opts.changePercent ?? null,
    higherIsBetter: opts.higherIsBetter ?? true,
    hint: opts.hint,
  }
}

/** A KPI built from a `ReportComparison` (numeric current/previous/changePercent). */
function comparisonKpi(
  key: string,
  label: string,
  comparison: { current: number; changePercent: number | null },
  format: DashboardKpi['format'] = 'number',
  higherIsBetter = true,
  hint?: string,
): DashboardKpi {
  return kpi(key, label, String(comparison.current), format, { changePercent: comparison.changePercent, higherIsBetter, hint })
}

/** A KPI built from a `ReportAmountComparison` (string current/previous/changePercent). */
function amountComparisonKpi(
  key: string,
  label: string,
  comparison: { current: string; changePercent: number | null },
  higherIsBetter = true,
  hint?: string,
): DashboardKpi {
  return kpi(key, label, comparison.current, 'currency', { changePercent: comparison.changePercent, higherIsBetter, hint })
}

// ─── Chart builders (mirrors `_components/charts.tsx`'s conventions) ────────

const lineChart = (key: string, title: string, points: ReportSeriesPoint[], label: string): DashboardChart => ({
  key,
  title,
  type: 'line',
  xKey: 'bucket',
  series: [{ key: 'value', label }],
  data: points.map((p) => ({ bucket: p.bucket, value: p.value })),
})

const amountBarChart = (key: string, title: string, points: ReportAmountSeriesPoint[], label: string): DashboardChart => ({
  key,
  title,
  type: 'bar',
  xKey: 'bucket',
  valueFormat: 'currency',
  series: [{ key: 'value', label }],
  data: points.map((p) => ({ bucket: p.bucket, value: Number(p.amount) })),
})

const pieChart = (key: string, title: string, rows: ReportBreakdown[]): DashboardChart => ({
  key,
  title,
  type: 'pie',
  xKey: 'label',
  series: [{ key: 'value', label: 'Count' }],
  data: rows.map((r) => ({ label: r.label, value: r.count })),
})

const categoryBarChart = (
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

// ─── Revenue analytics (Billing) ─────────────────────────────────────────────

export async function loadRevenue(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getBillingReport(filters)
  return {
    kpis: [
      amountComparisonKpi('revenue', 'Invoiced revenue', report.revenueComparison),
      amountComparisonKpi('collections', 'Collections', report.collectionsComparison),
      kpi('outstanding', 'Outstanding', report.outstanding, 'currency', { higherIsBetter: false }),
      kpi('refunds', 'Refunds', report.refunds, 'currency', { higherIsBetter: false }),
    ],
    charts: [
      amountBarChart('rev', 'Invoiced revenue', report.revenueTrend, 'Invoiced'),
      amountBarChart('coll', 'Collections', report.collectionTrend, 'Collected'),
      categoryBarChart(
        'ageing',
        'Outstanding ageing',
        report.outstandingAgeing.map((r) => ({ label: r.label, value: Number(r.amount) })),
        'Outstanding',
        'currency',
      ),
    ],
    tables: [
      {
        key: 'gst',
        title: 'GST summary',
        columns: [
          { key: 'rate', label: 'Rate %', align: 'left' },
          { key: 'lines', label: 'Lines', align: 'right' },
          { key: 'taxable', label: 'Taxable value', align: 'right' },
          { key: 'tax', label: 'Tax', align: 'right' },
        ],
        rows: report.gstSummary.map((g) => ({
          rate: g.taxPercent,
          lines: g.lineCount,
          taxable: money(g.taxableValue),
          tax: money(g.taxAmount),
        })),
        note: 'Derived from stored invoice line totals. Not a substitute for a filed GST return.',
      },
    ],
  }
}

// ─── Patient analytics ───────────────────────────────────────────────────────

export async function loadPatients(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getPatientReport(filters)
  return {
    kpis: [
      comparisonKpi('registrations', 'Registrations', report.registrationsComparison),
      kpi('active', 'Active patients', String(report.activePatients), 'number'),
      kpi('new', 'New patients', String(report.newPatients), 'number'),
      kpi('returning', 'Returning patients', String(report.returningPatients), 'number'),
    ],
    charts: [
      lineChart('reg', 'Daily registrations', report.registrationTrend, 'Registrations'),
      pieChart('gender', 'Gender distribution', report.genderDistribution),
      categoryBarChart(
        'age',
        'Age distribution',
        report.ageDistribution.map((b) => ({ label: b.label, value: b.count })),
        'Patients',
      ),
    ],
  }
}

// ─── Doctor productivity (Doctors + Appointments' utilisation) ─────────────

export async function loadDoctors(filters: ReportFilterQuery): Promise<ModuleView> {
  const [doctors, appointments] = await Promise.all([getDoctorReport(filters), getAppointmentReport(filters)])
  return {
    kpis: [
      kpi('consultations', 'Consultations', String(doctors.totalConsultations), 'number'),
      kpi('opd', 'OPD load', String(doctors.totalOpdLoad), 'number'),
      kpi('ipd', 'IPD load', String(doctors.totalIpdLoad), 'number'),
      kpi('followup', 'Follow-up ratio', String(doctors.followUpRatioPercent), 'percent'),
    ],
    charts: [
      lineChart('cons', 'Consultations', doctors.consultationTrend, 'Consultations'),
      categoryBarChart(
        'load',
        'Consultations by doctor',
        doctors.doctors.slice(0, 12).map((d) => ({ label: d.doctorName, value: d.consultations })),
        'Consultations',
      ),
    ],
    tables: [
      {
        key: 'workload',
        title: 'Workload by doctor',
        columns: [
          { key: 'doctor', label: 'Doctor' },
          { key: 'specialization', label: 'Specialization' },
          { key: 'opd', label: 'OPD', align: 'right' },
          { key: 'ipd', label: 'IPD', align: 'right' },
          { key: 'consultations', label: 'Consultations', align: 'right' },
          { key: 'followup', label: 'Follow-up %', align: 'right' },
        ],
        rows: doctors.doctors.map((d) => ({
          doctor: d.doctorName,
          specialization: d.specialization,
          opd: d.opdLoad,
          ipd: d.ipdLoad,
          consultations: d.consultations,
          followup: d.followUpRatioPercent,
        })),
      },
      {
        key: 'utilisation',
        title: 'Appointment utilisation',
        columns: [
          { key: 'doctor', label: 'Doctor' },
          { key: 'department', label: 'Department' },
          { key: 'booked', label: 'Booked', align: 'right' },
          { key: 'completed', label: 'Completed', align: 'right' },
          { key: 'noShow', label: 'No-show', align: 'right' },
          { key: 'utilisation', label: 'Utilisation %', align: 'right' },
        ],
        rows: appointments.doctorUtilisation.map((d) => ({
          doctor: d.doctorName,
          department: d.departmentName,
          booked: d.booked,
          completed: d.completed,
          noShow: d.noShow,
          utilisation: d.utilisationPercent,
        })),
        note: 'Utilisation is booked minutes over real scheduled availability, breaks excluded.',
      },
    ],
  }
}

// ─── OPD / IPD trends (Appointments + IPD, admissions side only) ───────────

export async function loadOpdIpdTrends(filters: ReportFilterQuery): Promise<ModuleView> {
  const [appointments, ipd] = await Promise.all([getAppointmentReport(filters), getIpdReport(filters)])
  return {
    kpis: [
      comparisonKpi('opd', 'OPD appointments', appointments.totalComparison),
      comparisonKpi('ipd', 'IPD admissions', ipd.admissionsComparison),
      kpi('discharges', 'Discharges', String(ipd.discharges), 'number'),
      kpi('stay', 'Avg stay', ipd.averageStayDays === null ? '-' : String(ipd.averageStayDays), 'days'),
    ],
    charts: [
      lineChart('opd-vol', 'OPD appointment volume', appointments.dailyTrend, 'Appointments'),
      pieChart('opd-status', 'OPD status mix', appointments.byStatus),
      lineChart('ipd-vol', 'IPD admissions', ipd.admissionTrend, 'Admissions'),
    ],
  }
}

// ─── Bed occupancy (IPD, ward side only) ────────────────────────────────────

export async function loadBedOccupancy(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getIpdReport(filters)
  return {
    kpis: [
      kpi('occupancy', 'Bed occupancy', String(report.bedOccupancyPercent), 'percent', {
        hint: 'Live snapshot, not a period average',
      }),
      kpi('total-beds', 'Total beds', String(report.totalBeds), 'number'),
      kpi('occupied-beds', 'Occupied beds', String(report.occupiedBeds), 'number'),
      kpi('current-inpatients', 'Current inpatients', String(report.currentInpatients), 'number'),
    ],
    charts: [
      lineChart('occ-rate', 'Bed-days occupancy rate', report.occupancyRateTrend, 'Occupancy %'),
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
    tables: [
      {
        key: 'wards',
        title: 'Ward occupancy',
        columns: [
          { key: 'ward', label: 'Ward' },
          { key: 'type', label: 'Type' },
          { key: 'beds', label: 'Beds', align: 'right' },
          { key: 'occupied', label: 'Occupied', align: 'right' },
          { key: 'occupancy', label: 'Occupancy %', align: 'right' },
          { key: 'admissions', label: 'Admissions', align: 'right' },
          { key: 'stay', label: 'Avg stay (d)', align: 'right' },
        ],
        rows: report.wardOccupancy.map((w) => ({
          ward: w.wardName,
          type: w.wardType,
          beds: w.totalBeds,
          occupied: w.occupiedBeds,
          occupancy: w.occupancyPercent,
          admissions: w.admissionsInPeriod,
          stay: w.averageStayDays,
        })),
      },
    ],
  }
}

// ─── Laboratory analytics ────────────────────────────────────────────────────

export async function loadLaboratory(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getLaboratoryReport(filters)
  return {
    kpis: [
      kpi('orders', 'Orders placed', String(report.ordersPlaced), 'number'),
      kpi('tests', 'Tests performed', String(report.testsPerformed), 'number'),
      kpi('pending', 'Pending', String(report.pending), 'number', { higherIsBetter: false }),
      kpi('turnaround', 'Avg turnaround', report.averageTurnaroundHours === null ? '-' : String(report.averageTurnaroundHours), 'hours', {
        higherIsBetter: false,
      }),
    ],
    charts: [
      lineChart('vol', 'Order volume', report.volumeTrend, 'Orders'),
      amountBarChart('rev', 'Lab revenue', report.revenueTrend, 'Revenue'),
      pieChart('cat', 'By category', report.byCategory),
    ],
    tables: [
      {
        key: 'tests',
        title: 'Tests performed',
        columns: [
          { key: 'code', label: 'Code' },
          { key: 'test', label: 'Test' },
          { key: 'category', label: 'Category' },
          { key: 'performed', label: 'Performed', align: 'right' },
          { key: 'abnormal', label: 'Abnormal', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right' },
        ],
        rows: report.topTests.map((t) => ({
          code: t.testCode,
          test: t.testName,
          category: t.category,
          performed: t.performed,
          abnormal: t.abnormal,
          revenue: money(t.revenue),
        })),
        note: "Revenue comes from billing-module charges raised against the lab order, split evenly across that order's tests.",
      },
    ],
  }
}

// ─── Pharmacy analytics ──────────────────────────────────────────────────────

export async function loadPharmacy(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getPharmacyReport(filters)
  return {
    kpis: [
      kpi('dispensed', 'Orders dispensed', String(report.ordersDispensed), 'number'),
      kpi('units', 'Units dispensed', String(report.totalQuantityDispensed), 'number'),
      kpi('low-stock', 'Low stock', String(report.lowStock.length), 'number', { higherIsBetter: false }),
      kpi('expiring', 'Expiring / expired', `${report.expiring.length} / ${report.expired.length}`, 'number', {
        higherIsBetter: false,
      }),
    ],
    charts: [lineChart('disp', 'Dispensing volume', report.dispenseTrend, 'Dispenses')],
    tables: [
      {
        key: 'top-medicines',
        title: 'Top dispensed medicines',
        columns: [
          { key: 'medicine', label: 'Medicine' },
          { key: 'quantity', label: 'Quantity', align: 'right' },
          { key: 'lines', label: 'Lines', align: 'right' },
          { key: 'revenue', label: 'Revenue', align: 'right' },
        ],
        rows: report.topMedicines.map((m) => ({
          medicine: m.medicationName,
          quantity: m.quantityDispensed,
          lines: m.dispenseCount,
          revenue: m.revenue === null ? null : money(m.revenue),
        })),
        note: 'Revenue is blank for dispensed items the pharmacist never resolved to a priced catalog batch.',
      },
      {
        key: 'stock-alerts',
        title: 'Stock alerts',
        columns: [
          { key: 'medicine', label: 'Medicine' },
          { key: 'batch', label: 'Batch' },
          { key: 'stock', label: 'Stock', align: 'right' },
          { key: 'daysToExpiry', label: 'Days to expiry', align: 'right' },
        ],
        rows: [...report.lowStock, ...report.expiring]
          .slice(0, 20)
          .map((row) => ({ medicine: row.name, batch: row.batchNumber, stock: row.currentStock, daysToExpiry: row.daysToExpiry })),
        note: 'Low-stock and expiring batches are point-in-time - measured now, not scoped to the selected period.',
      },
    ],
  }
}

// ─── Insurance analytics ─────────────────────────────────────────────────────

export async function loadInsurance(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getInsuranceReport(filters)
  return {
    kpis: [
      kpi('claims', 'Claims', String(report.claims), 'number'),
      kpi('settlement-rate', 'Settlement rate', String(report.settlementRatePercent), 'percent'),
      kpi('settlement-days', 'Avg settlement', report.averageSettlementDays === null ? '-' : String(report.averageSettlementDays), 'days', {
        higherIsBetter: false,
      }),
      kpi('pending', 'Pending claims', String(report.pendingClaims), 'number', { higherIsBetter: false }),
    ],
    charts: [lineChart('claims', 'Claims filed', report.claimTrend, 'Claims'), pieChart('status', 'By status', report.byStatus)],
    tables: [
      {
        key: 'payers',
        title: 'Payer performance',
        columns: [
          { key: 'payer', label: 'Payer' },
          { key: 'claims', label: 'Claims', align: 'right' },
          { key: 'claimed', label: 'Claimed', align: 'right' },
          { key: 'approved', label: 'Approved', align: 'right' },
          { key: 'settlement', label: 'Settlement %', align: 'right' },
          { key: 'approval', label: 'Approval (d)', align: 'right' },
        ],
        rows: report.byProvider.map((p) => ({
          payer: p.providerName,
          claims: p.claims,
          claimed: money(p.claimedAmount),
          approved: money(p.approvedAmount),
          settlement: p.settlementRatePercent,
          approval: p.averageApprovalDays,
        })),
      },
    ],
  }
}

// ─── Inventory analytics ─────────────────────────────────────────────────────

export async function loadInventory(filters: ReportFilterQuery): Promise<ModuleView> {
  const report = await getInventoryReport(filters)
  return {
    kpis: [
      kpi('consumption', 'Consumption value', report.totalConsumptionValue, 'currency', { higherIsBetter: false }),
      kpi('purchase-orders', 'Purchase orders', String(report.purchaseOrders), 'number'),
      kpi('purchase-value', 'Purchase value', report.purchaseValue, 'currency', { higherIsBetter: false }),
      kpi('stock-value', 'Stock value', report.totalStockValue, 'currency'),
    ],
    charts: [
      amountBarChart('cons', 'Consumption value', report.consumptionTrend, 'Consumed'),
      amountBarChart('po', 'Purchase value', report.purchaseTrend, 'Purchased'),
    ],
    tables: [
      {
        key: 'vendors',
        title: 'Vendor performance',
        columns: [
          { key: 'vendor', label: 'Vendor' },
          { key: 'pos', label: 'POs', align: 'right' },
          { key: 'ordered', label: 'Ordered', align: 'right' },
          { key: 'fulfilment', label: 'Fulfilment %', align: 'right' },
          { key: 'leadTime', label: 'Lead time (d)', align: 'right' },
          { key: 'rating', label: 'Rating', align: 'right' },
        ],
        rows: report.vendorPerformance.map((v) => ({
          vendor: v.vendorName,
          pos: v.purchaseOrders,
          ordered: money(v.orderedValue),
          fulfilment: v.fulfilmentRatePercent,
          leadTime: v.averageLeadTimeDays,
          rating: v.averageRating,
        })),
      },
    ],
  }
}
