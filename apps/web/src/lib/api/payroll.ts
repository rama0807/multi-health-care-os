import type { PayrollSummaryQuery, PayrollSummaryResponse } from '@medicore/types'

import { apiClient } from './client'

export async function getPayrollSummary(query: PayrollSummaryQuery): Promise<PayrollSummaryResponse> {
  const { data } = await apiClient.get<{ data: PayrollSummaryResponse }>('/staff/payroll/summary', { params: query })
  return data.data
}

export async function downloadPayrollExport(query: PayrollSummaryQuery): Promise<void> {
  const response = await apiClient.get<Blob>('/staff/payroll/export', { params: query, responseType: 'blob' })
  downloadBlob(response.data, `payroll-${query.month}.csv`)
}

function downloadBlob(data: BlobPart, fileName: string): void {
  const url = window.URL.createObjectURL(new Blob([data]))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
