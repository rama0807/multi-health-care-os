import type {
  AdministerDoseDto,
  CreateAdHocDoseDto,
  GenerateScheduledDosesDto,
  MedicationAdministrationQuery,
  MedicationAdministrationWithDetails,
  PaginatedResponse,
  RecordDoseExceptionDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function listMedicationAdministrations(
  admissionId: string,
  query: MedicationAdministrationQuery = {},
): Promise<PaginatedResponse<MedicationAdministrationWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<MedicationAdministrationWithDetails> }>(
    `/ipd/admissions/${admissionId}/mar`,
    { params: query },
  )
  return data.data
}

export async function generateScheduledDoses(
  admissionId: string,
  dto: GenerateScheduledDosesDto,
): Promise<{ created: number }> {
  const { data } = await apiClient.post<{ data: { created: number } }>(
    `/ipd/admissions/${admissionId}/mar/generate-scheduled`,
    dto,
  )
  return data.data
}

export async function createAdHocDose(
  admissionId: string,
  dto: CreateAdHocDoseDto,
): Promise<MedicationAdministrationWithDetails> {
  const { data } = await apiClient.post<{ data: MedicationAdministrationWithDetails }>(
    `/ipd/admissions/${admissionId}/mar/ad-hoc`,
    dto,
  )
  return data.data
}

export async function administerDose(
  admissionId: string,
  doseId: string,
  dto: AdministerDoseDto,
): Promise<MedicationAdministrationWithDetails> {
  const { data } = await apiClient.patch<{ data: MedicationAdministrationWithDetails }>(
    `/ipd/admissions/${admissionId}/mar/${doseId}/administer`,
    dto,
  )
  return data.data
}

function recordException(action: 'missed' | 'refused' | 'held' | 'delayed') {
  return async (
    admissionId: string,
    doseId: string,
    dto: RecordDoseExceptionDto,
  ): Promise<MedicationAdministrationWithDetails> => {
    const { data } = await apiClient.patch<{ data: MedicationAdministrationWithDetails }>(
      `/ipd/admissions/${admissionId}/mar/${doseId}/${action}`,
      dto,
    )
    return data.data
  }
}

export const markDoseMissed = recordException('missed')
export const markDoseRefused = recordException('refused')
export const markDoseHeld = recordException('held')
export const markDoseDelayed = recordException('delayed')
