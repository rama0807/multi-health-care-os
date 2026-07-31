import type { Department, Hospital } from '@medicore/types'

import { apiClient } from './client'

export async function listHospitals(): Promise<Hospital[]> {
  const { data } = await apiClient.get<{ data: Hospital[] }>('/hospitals')
  return data.data
}

export async function listDepartments(hospitalId?: string): Promise<Department[]> {
  const { data } = await apiClient.get<{ data: Department[] }>('/departments', {
    params: hospitalId ? { hospitalId } : undefined,
  })
  return data.data
}
