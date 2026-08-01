import { LeaveType } from './enums'

export interface AvailableSlot {
  start: string
  end: string
}

export interface DoctorAvailabilityResult {
  doctorId: string
  date: string
  isWorkingDay: boolean
  onLeave: boolean
  leaveType?: LeaveType
  slots: AvailableSlot[]
}

export interface DoctorTodayStatus {
  doctorId: string
  date: string
  isWorkingDay: boolean
  onLeave: boolean
  leaveType?: LeaveType
  withinShiftNow: boolean
  nextShiftStart?: string
}

export interface UpcomingLeaveEntry {
  leaveId: string
  doctorId: string
  doctorName: string
  leaveType: LeaveType
  startDate: string
  endDate: string
}

export interface DoctorAvailabilityDashboardStats {
  availableToday: number
  onLeaveToday: number
  offDutyToday: number
  upcomingLeave: UpcomingLeaveEntry[]
}
