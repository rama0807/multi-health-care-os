import { z } from 'zod'

import { MedicationRoute, PrescriptionStatus } from './enums'

export interface PrescriptionItem {
  id: string
  prescriptionId: string
  medicationName: string
  genericName: string | null
  strength: string | null
  form: string | null
  dosage: string
  frequency: string
  duration: string
  route: MedicationRoute
  instructions: string | null
  quantity: number
  createdAt: Date
}

export interface Prescription {
  id: string
  prescriptionNumber: string
  patientId: string
  doctorId: string
  encounterId: string | null
  organizationId: string
  status: PrescriptionStatus
  notes: string | null
  prescribedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface PrescriptionWithItems extends Prescription {
  items: PrescriptionItem[]
  patient: {
    id: string
    fullName: string
    uhid: string
  }
  doctor: {
    id: string
    fullName: string
    specialization: string
  }
}

export const CreatePrescriptionItemSchema = z.object({
  medicationName: z.string().min(1).max(200),
  genericName: z.string().max(200).optional(),
  strength: z.string().max(50).optional(),
  form: z.string().max(50).optional(),
  dosage: z.string().min(1).max(100),
  frequency: z.string().min(1).max(100),
  duration: z.string().min(1).max(100),
  route: z.nativeEnum(MedicationRoute).default(MedicationRoute.ORAL),
  instructions: z.string().max(500).optional(),
  quantity: z.number().int().min(1).max(1000).default(1),
})

export type CreatePrescriptionItemDto = z.infer<typeof CreatePrescriptionItemSchema>

export const CreatePrescriptionSchema = z.object({
  encounterId: z.string().cuid(),
  notes: z.string().max(2000).optional(),
  items: z.array(CreatePrescriptionItemSchema).min(1, 'At least one medication is required'),
})

export type CreatePrescriptionDto = z.infer<typeof CreatePrescriptionSchema>

export const UpdatePrescriptionStatusSchema = z.object({
  status: z.nativeEnum(PrescriptionStatus),
})

export type UpdatePrescriptionStatusDto = z.infer<typeof UpdatePrescriptionStatusSchema>

export interface PrescriptionQuery {
  patientId?: string
  doctorId?: string
  encounterId?: string
  status?: PrescriptionStatus
  page?: number
  limit?: number
}

export interface DrugInteractionWarning {
  medicationA: string
  medicationB: string
  severity: 'moderate' | 'severe'
  description: string
}
