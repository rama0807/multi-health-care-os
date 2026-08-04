import type {
  Attendance,
  AttendanceCalendarDay,
  AttendanceDashboardStats,
  AttendanceSearchQuery,
  ClockInDto,
  ClockOutDto,
  CorrectAttendanceDto,
  MarkAttendanceDto,
  PaginatedResponse,
} from '@medicore/types'

import { apiClient } from './client'

export async function getAttendanceDashboardStats(): Promise<AttendanceDashboardStats> {
  const { data } = await apiClient.get<{ data: AttendanceDashboardStats }>('/attendance/dashboard/stats')
  return data.data
}

export async function listAttendance(query: AttendanceSearchQuery = {}): Promise<PaginatedResponse<Attendance>> {
  const { data } = await apiClient.get<{ data: PaginatedResponse<Attendance> }>('/attendance', { params: query })
  return data.data
}

export async function getAttendanceCalendar(staffId: string, month: string): Promise<AttendanceCalendarDay[]> {
  const { data } = await apiClient.get<{ data: { days: AttendanceCalendarDay[] } }>('/attendance/calendar', {
    params: { staffId, month },
  })
  return data.data.days
}

export async function clockIn(dto: ClockInDto = {}): Promise<Attendance> {
  const { data } = await apiClient.post<{ data: Attendance }>('/attendance/clock-in', dto)
  return data.data
}

export async function clockOut(dto: ClockOutDto = {}): Promise<Attendance> {
  const { data } = await apiClient.post<{ data: Attendance }>('/attendance/clock-out', dto)
  return data.data
}

export async function markAttendance(dto: MarkAttendanceDto): Promise<Attendance> {
  const { data } = await apiClient.post<{ data: Attendance }>('/attendance/mark', dto)
  return data.data
}

export async function correctAttendance(id: string, dto: CorrectAttendanceDto): Promise<Attendance> {
  const { data } = await apiClient.patch<{ data: Attendance }>(`/attendance/${id}/correct`, dto)
  return data.data
}
