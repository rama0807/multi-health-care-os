import { z } from 'zod'

import { EmploymentStatus, EmploymentType } from './enums'
import { optionalString } from './zod-helpers'

export interface StaffHospitalSummary {
  id: string
  name: string
  code: string
}

export interface StaffDepartmentSummary {
  id: string
  name: string
  code: string
}

export interface StaffReportsToSummary {
  id: string
  fullName: string
  designation: string
}

export interface Staff {
  id: string
  userId: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string | null
  employeeId: string
  designation: string
  departmentId: string | null
  department: StaffDepartmentSummary | null
  hospitalId: string
  hospital: StaffHospitalSummary | null
  organizationId: string
  employmentType: EmploymentType
  employmentStatus: EmploymentStatus
  reportsToId: string | null
  reportsTo: StaffReportsToSummary | null
  joiningDate: Date
  dateOfLeaving: Date | null
  monthlySalary: number | null
  createdAt: Date
  updatedAt: Date
}

export const CreateStaffSchema = z.object({
  // Account fields - used to create (or link to) the staff member's login.
  email: z.string().email(),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: optionalString(z.string().regex(/^[6-9]\d{9}$/, 'Enter valid Indian mobile number')),
  // Which SystemRole the login gets - any non-doctor employee role (Nurse,
  // Receptionist, Lab Technician, Radiology Technician, Pharmacist, Cashier,
  // HR, Inventory Manager). Doctors keep their own dedicated flow.
  systemRole: z.enum([
    'NURSE',
    'RECEPTIONIST',
    'LAB_TECHNICIAN',
    'RADIOLOGY_TECHNICIAN',
    'PHARMACIST',
    'CASHIER',
    'HR',
    'INVENTORY_MANAGER',
  ]),

  // Employment profile fields.
  employeeId: z.string().min(1).max(50),
  designation: z.string().min(1).max(100),
  departmentId: optionalString(z.string().min(1)),
  hospitalId: z.string().min(1),
  employmentType: z.nativeEnum(EmploymentType).default(EmploymentType.FULL_TIME),
  reportsToId: optionalString(z.string().min(1)),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  monthlySalary: z.number().nonnegative().optional(),
})

export type CreateStaffDto = z.infer<typeof CreateStaffSchema>

export const UpdateStaffSchema = CreateStaffSchema.omit({
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  systemRole: true,
})
  .partial()
  .extend({
    employmentStatus: z.nativeEnum(EmploymentStatus).optional(),
    dateOfLeaving: optionalString(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD')),
  })

export type UpdateStaffDto = z.infer<typeof UpdateStaffSchema>

export interface StaffSearchQuery {
  q?: string
  departmentId?: string
  hospitalId?: string
  designation?: string
  employmentType?: EmploymentType
  employmentStatus?: EmploymentStatus
  reportsToId?: string
  sortBy?: 'createdAt' | 'firstName' | 'employeeId' | 'joiningDate'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export interface StaffDashboardStats {
  totalStaff: number
  activeStaff: number
  onLeaveToday: number
  presentToday: number
  absentToday: number
  lateToday: number
  pendingLeaveApprovals: number
  byDepartment: Array<{ departmentId: string; departmentName: string; count: number }>
  shiftCoverageToday: Array<{ shiftId: string; shiftName: string; assigned: number; clockedIn: number }>
}
