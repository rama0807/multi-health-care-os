import type {
  AppointmentReport,
  BillingReport,
  CreateSavedReportDto,
  DoctorReport,
  ExecutiveDashboard,
  ExecutiveDashboardKey,
  InsuranceReport,
  InventoryReport,
  IpdReport,
  LaboratoryReport,
  PaginatedResponse,
  PatientReport,
  PharmacyReport,
  RadiologyReportStats,
  ReportDefinition,
  ReportExportFormat,
  ReportFilterQuery,
  ReportRunResult,
  SavedReport,
  SavedReportQuery,
  StaffReport,
  UpdateSavedReportDto,
} from '@medicore/types'

import { apiClient } from './client'

/**
 * Reports & Analytics client (Milestone 17).
 *
 * Every endpoint here is read-only apart from saved-report CRUD. The filter
 * shape is shared verbatim with the API's `ReportFilterQuery`, so a filter
 * the UI can express is always one the backend honours.
 */

/** Drops empty values so an unset filter never reaches the API as `?doctorId=`. */
function toParams(filters: ReportFilterQuery = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ) as Record<string, string>
}

async function getReport<T>(path: string, filters: ReportFilterQuery): Promise<T> {
  const { data } = await apiClient.get<{ data: T }>(`/reports/${path}`, { params: toParams(filters) })
  return data.data
}

// ─── Operational reports (17.1) ──────────────────────────────────────────────

export const getPatientReport = (f: ReportFilterQuery = {}) => getReport<PatientReport>('patients', f)
export const getAppointmentReport = (f: ReportFilterQuery = {}) => getReport<AppointmentReport>('appointments', f)
export const getDoctorReport = (f: ReportFilterQuery = {}) => getReport<DoctorReport>('doctors', f)
export const getLaboratoryReport = (f: ReportFilterQuery = {}) => getReport<LaboratoryReport>('laboratory', f)
export const getRadiologyReport = (f: ReportFilterQuery = {}) => getReport<RadiologyReportStats>('radiology', f)
export const getPharmacyReport = (f: ReportFilterQuery = {}) => getReport<PharmacyReport>('pharmacy', f)
export const getInventoryReport = (f: ReportFilterQuery = {}) => getReport<InventoryReport>('inventory', f)
export const getBillingReport = (f: ReportFilterQuery = {}) => getReport<BillingReport>('billing', f)
export const getInsuranceReport = (f: ReportFilterQuery = {}) => getReport<InsuranceReport>('insurance', f)
export const getIpdReport = (f: ReportFilterQuery = {}) => getReport<IpdReport>('ipd', f)
export const getStaffReport = (f: ReportFilterQuery = {}) => getReport<StaffReport>('staff', f)

// ─── Executive dashboards (17.2) ─────────────────────────────────────────────

export async function getExecutiveDashboard(
  key: ExecutiveDashboardKey,
  filters: ReportFilterQuery = {},
): Promise<ExecutiveDashboard> {
  const { data } = await apiClient.get<{ data: ExecutiveDashboard }>(`/reports/dashboards/${key}`, {
    params: toParams(filters),
  })
  return data.data
}

// ─── Report builder (17.3) ───────────────────────────────────────────────────

export async function listReportDefinitions(): Promise<ReportDefinition[]> {
  const { data } = await apiClient.get<{ data: ReportDefinition[] }>('/reports/builder/definitions')
  return data.data
}

export async function runReport(key: string, filters: ReportFilterQuery = {}): Promise<ReportRunResult> {
  const { data } = await apiClient.get<{ data: ReportRunResult }>(`/reports/builder/run/${key}`, {
    params: toParams(filters),
  })
  return data.data
}

/**
 * Downloads an export. The response is a binary blob rather than the usual
 * `{ data }` envelope, so it is handed to the browser through an object URL -
 * the same approach the invoice/receipt PDF downloads already use.
 */
export async function downloadReportExport(
  key: string,
  format: ReportExportFormat,
  filters: ReportFilterQuery = {},
): Promise<void> {
  const response = await apiClient.get<Blob>(`/reports/builder/export/${key}`, {
    params: { ...toParams(filters), format },
    responseType: 'blob',
  })

  // Prefer the server's filename - it already encodes the report key and the
  // exact period the export covers, which a client-side guess would not.
  const disposition = String(response.headers['content-disposition'] ?? '')
  const match = disposition.match(/filename="?([^"]+)"?/)
  const fileName = match?.[1] ?? `${key}.${format}`

  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

// ─── Saved reports (17.3) ────────────────────────────────────────────────────

export async function listSavedReports(query: SavedReportQuery = {}): Promise<PaginatedResponse<SavedReport>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<SavedReport> }>('/reports/builder/saved', {
    params: query,
  })
  return data.data
}

export async function createSavedReport(dto: CreateSavedReportDto): Promise<SavedReport> {
  const { data } = await apiClient.post<{ data: SavedReport }>('/reports/builder/saved', dto)
  return data.data
}

export async function updateSavedReport(id: string, dto: UpdateSavedReportDto): Promise<SavedReport> {
  const { data } = await apiClient.patch<{ data: SavedReport }>(`/reports/builder/saved/${id}`, dto)
  return data.data
}

export async function deleteSavedReport(id: string): Promise<{ id: string }> {
  const { data } = await apiClient.delete<{ data: { id: string } }>(`/reports/builder/saved/${id}`)
  return data.data
}

export async function runSavedReport(id: string): Promise<ReportRunResult> {
  const { data } = await apiClient.get<{ data: ReportRunResult }>(`/reports/builder/saved/${id}/run`)
  return data.data
}
