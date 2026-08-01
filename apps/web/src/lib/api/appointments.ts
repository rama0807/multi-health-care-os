import type {
  Appointment,
  AppointmentQuery,
  AppointmentWithDetails,
  AvailableSlot,
  CreateAppointmentDto,
  CreateRecurringAppointmentDto,
  CreateWalkInAppointmentDto,
  PaginatedResponse,
  RecurringBookingResult,
  UpdateAppointmentStatusDto,
} from '@medicore/types'

import { apiClient } from './client'

export async function listAppointments(query: AppointmentQuery): Promise<PaginatedResponse<AppointmentWithDetails>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<AppointmentWithDetails> }>('/appointments', {
    params: query,
  })
  return data.data
}

export async function getAppointment(id: string): Promise<AppointmentWithDetails> {
  const { data } = await apiClient.get<{ data: AppointmentWithDetails }>(`/appointments/${id}`)
  return data.data
}

export async function getAppointmentAvailableSlots(
  doctorId: string,
  date: string,
  duration?: number,
): Promise<AvailableSlot[]> {
  const { data } = await apiClient.get<{ data: { slots: AvailableSlot[] } }>('/appointments/available-slots', {
    params: { doctorId, date, duration },
  })
  return data.data.slots
}

export async function createAppointment(dto: CreateAppointmentDto): Promise<Appointment> {
  const { data } = await apiClient.post<{ data: Appointment }>('/appointments', dto)
  return data.data
}

export async function updateAppointmentStatus(id: string, dto: UpdateAppointmentStatusDto): Promise<Appointment> {
  const { data } = await apiClient.patch<{ data: Appointment }>(`/appointments/${id}/status`, dto)
  return data.data
}

export async function createWalkInAppointment(dto: CreateWalkInAppointmentDto): Promise<Appointment> {
  const { data } = await apiClient.post<{ data: Appointment }>('/appointments/walk-in', dto)
  return data.data
}

export async function createRecurringAppointment(
  dto: CreateRecurringAppointmentDto,
): Promise<RecurringBookingResult> {
  const { data } = await apiClient.post<{ data: RecurringBookingResult }>('/appointments/recurring', dto)
  return data.data
}
