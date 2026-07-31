import { z } from 'zod'

export interface Hospital {
  id: string
  organizationId: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  pincode: string | null
  phone: string | null
  email: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Department {
  id: string
  hospitalId: string
  organizationId: string
  name: string
  code: string
  description: string | null
  headDoctorId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export const CreateHospitalSchema = z.object({
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
})

export type CreateHospitalDto = z.infer<typeof CreateHospitalSchema>

export const UpdateHospitalSchema = CreateHospitalSchema.partial()

export type UpdateHospitalDto = z.infer<typeof UpdateHospitalSchema>

export const CreateDepartmentSchema = z.object({
  hospitalId: z.string(),
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
  description: z.string().optional(),
  headDoctorId: z.string().optional(),
})

export type CreateDepartmentDto = z.infer<typeof CreateDepartmentSchema>

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial().omit({ hospitalId: true })

export type UpdateDepartmentDto = z.infer<typeof UpdateDepartmentSchema>
