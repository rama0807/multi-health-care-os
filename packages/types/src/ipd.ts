import { z } from 'zod'

import {
  AdmissionStatus,
  AdmissionType,
  BedAllocationAction,
  BedStatus,
  BedType,
  RoomStatus,
  WardStatus,
  WardType,
} from './enums'

// ─── Wards ─────────────────────────────────────────────────────────────────

export interface Ward {
  id: string
  organizationId: string
  name: string
  code: string
  floor: string | null
  block: string | null
  type: WardType
  departmentId: string | null
  status: WardStatus
  createdAt: Date
  updatedAt: Date
}

export interface WardWithCounts extends Ward {
  department: { id: string; name: string; code: string } | null
  roomCount: number
  bedCount: number
  occupiedBedCount: number
  availableBedCount: number
}

export const CreateWardSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  floor: z.string().max(50).optional(),
  block: z.string().max(50).optional(),
  type: z.nativeEnum(WardType).default(WardType.GENERAL),
  departmentId: z.string().cuid().optional(),
})

export type CreateWardDto = z.infer<typeof CreateWardSchema>

export const UpdateWardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  floor: z.string().max(50).optional(),
  block: z.string().max(50).optional(),
  type: z.nativeEnum(WardType).optional(),
  departmentId: z.string().cuid().optional(),
  status: z.nativeEnum(WardStatus).optional(),
})

export type UpdateWardDto = z.infer<typeof UpdateWardSchema>

export interface WardQuery {
  search?: string
  type?: WardType
  status?: WardStatus
  departmentId?: string
  page?: number
  limit?: number
}

// ─── Rooms ─────────────────────────────────────────────────────────────────

export interface Room {
  id: string
  organizationId: string
  roomNumber: string
  wardId: string
  floor: string | null
  capacity: number
  chargesPerDay: string
  status: RoomStatus
  createdAt: Date
  updatedAt: Date
}

export interface RoomWithCounts extends Room {
  ward: { id: string; name: string; code: string; type: WardType }
  bedCount: number
  occupiedBedCount: number
}

export const CreateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(50),
  wardId: z.string().cuid(),
  floor: z.string().max(50).optional(),
  capacity: z.number().int().min(1).default(1),
  chargesPerDay: z.number().min(0),
})

export type CreateRoomDto = z.infer<typeof CreateRoomSchema>

export const UpdateRoomSchema = z.object({
  roomNumber: z.string().min(1).max(50).optional(),
  wardId: z.string().cuid().optional(),
  floor: z.string().max(50).optional(),
  capacity: z.number().int().min(1).optional(),
  chargesPerDay: z.number().min(0).optional(),
  status: z.nativeEnum(RoomStatus).optional(),
})

export type UpdateRoomDto = z.infer<typeof UpdateRoomSchema>

export interface RoomQuery {
  search?: string
  wardId?: string
  status?: RoomStatus
  page?: number
  limit?: number
}

// ─── Beds ──────────────────────────────────────────────────────────────────

export interface Bed {
  id: string
  organizationId: string
  bedNumber: string
  roomId: string
  wardId: string
  type: BedType
  status: BedStatus
  createdAt: Date
  updatedAt: Date
}

export interface BedWithDetails extends Bed {
  room: { id: string; roomNumber: string; chargesPerDay: string }
  ward: { id: string; name: string; code: string; type: WardType }
  currentAdmission: { id: string; admissionNumber: string; patientId: string; patientName: string } | null
}

export const CreateBedSchema = z.object({
  bedNumber: z.string().min(1).max(50),
  roomId: z.string().cuid(),
  type: z.nativeEnum(BedType).default(BedType.GENERAL),
})

export type CreateBedDto = z.infer<typeof CreateBedSchema>

export const UpdateBedSchema = z.object({
  bedNumber: z.string().min(1).max(50).optional(),
  roomId: z.string().cuid().optional(),
  type: z.nativeEnum(BedType).optional(),
  status: z.nativeEnum(BedStatus).optional(),
})

export type UpdateBedDto = z.infer<typeof UpdateBedSchema>

export interface BedQuery {
  search?: string
  wardId?: string
  roomId?: string
  type?: BedType
  status?: BedStatus
  page?: number
  limit?: number
}

// ─── Admissions ────────────────────────────────────────────────────────────

export interface Admission {
  id: string
  admissionNumber: string
  patientId: string
  encounterId: string | null
  attendingDoctorId: string
  departmentId: string | null
  wardId: string
  roomId: string | null
  bedId: string | null
  patientInsuranceId: string | null
  organizationId: string
  type: AdmissionType
  status: AdmissionStatus
  admissionReason: string
  diagnosis: string | null
  admittedAt: Date
  expectedDischargeAt: Date | null
  dischargedAt: Date | null
  dischargeNotes: string | null
  dischargeCondition: string | null
  dischargeApprovedAt: Date | null
  dischargeApprovedByUserId: string | null
  cancelledAt: Date | null
  cancelReason: string | null
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AdmissionWithDetails extends Admission {
  patient: { id: string; fullName: string; uhid: string }
  attendingDoctor: { id: string; fullName: string; specialization: string }
  department: { id: string; name: string; code: string } | null
  ward: { id: string; name: string; code: string; type: WardType }
  room: { id: string; roomNumber: string } | null
  bed: { id: string; bedNumber: string; status: BedStatus } | null
  patientInsurance: {
    id: string
    memberId: string
    provider: { id: string; name: string }
    plan: { id: string; name: string }
  } | null
}

export const CreateAdmissionSchema = z.object({
  patientId: z.string().cuid(),
  encounterId: z.string().cuid().optional(),
  attendingDoctorId: z.string().cuid(),
  departmentId: z.string().cuid().optional(),
  wardId: z.string().cuid(),
  roomId: z.string().cuid().optional(),
  bedId: z.string().cuid().optional(),
  patientInsuranceId: z.string().cuid().optional(),
  type: z.nativeEnum(AdmissionType).default(AdmissionType.SCHEDULED),
  admissionReason: z.string().min(1).max(2000),
  diagnosis: z.string().max(2000).optional(),
  expectedDischargeAt: z.coerce.date().optional(),
})

export type CreateAdmissionDto = z.infer<typeof CreateAdmissionSchema>

export const UpdateAdmissionSchema = z.object({
  attendingDoctorId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  admissionReason: z.string().min(1).max(2000).optional(),
  diagnosis: z.string().max(2000).optional(),
  expectedDischargeAt: z.coerce.date().optional(),
})

export type UpdateAdmissionDto = z.infer<typeof UpdateAdmissionSchema>

export const CancelAdmissionSchema = z.object({
  reason: z.string().max(1000).optional(),
})

export type CancelAdmissionDto = z.infer<typeof CancelAdmissionSchema>

export interface AdmissionQuery {
  search?: string
  patientId?: string
  attendingDoctorId?: string
  wardId?: string
  status?: AdmissionStatus
  type?: AdmissionType
  /** `ADMITTED` admissions where discharge has been approved but not yet finalized. */
  pendingDischarge?: boolean
  page?: number
  limit?: number
}

// ─── Bed Allocation / Transfer ─────────────────────────────────────────────

export interface BedAllocation {
  id: string
  admissionId: string
  bedId: string
  organizationId: string
  action: BedAllocationAction
  performedByUserId: string | null
  reason: string | null
  occurredAt: Date
}

export const AllocateBedSchema = z.object({
  bedId: z.string().cuid(),
  reason: z.string().max(500).optional(),
})

export type AllocateBedDto = z.infer<typeof AllocateBedSchema>

export const ReserveBedSchema = z.object({
  bedId: z.string().cuid(),
  reason: z.string().max(500).optional(),
})

export type ReserveBedDto = z.infer<typeof ReserveBedSchema>

export const VacateBedSchema = z.object({
  reason: z.string().max(500).optional(),
})

export type VacateBedDto = z.infer<typeof VacateBedSchema>

export interface BedTransfer {
  id: string
  admissionId: string
  organizationId: string
  fromBedId: string | null
  toBedId: string
  fromRoomId: string | null
  toRoomId: string | null
  fromWardId: string | null
  toWardId: string
  reason: string | null
  transferredByUserId: string | null
  transferredAt: Date
}

export interface BedTransferWithDetails extends BedTransfer {
  fromBed: { id: string; bedNumber: string } | null
  toBed: { id: string; bedNumber: string }
  fromWard: { id: string; name: string } | null
  toWard: { id: string; name: string }
}

export const TransferBedSchema = z.object({
  toBedId: z.string().cuid(),
  reason: z.string().max(500).optional(),
})

export type TransferBedDto = z.infer<typeof TransferBedSchema>

// ─── Dashboard ─────────────────────────────────────────────────────────────

export interface IpdDashboardStats {
  totalBeds: number
  availableBeds: number
  occupiedBeds: number
  icuOccupiedBeds: number
  icuTotalBeds: number
  icuOccupancyPercent: number
  inpatients: number
  occupancyPercent: number
  admissionsToday: number
  dischargesToday: number
  transfersToday: number
  pendingDischarge: number
  pendingNursingTasks: number
}
