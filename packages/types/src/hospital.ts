import { z } from 'zod'

import { SystemRole } from './enums'

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

/**
 * Hospital onboarding wizard (Checkpoint 16.1). One transactional call that
 * creates the hospital, its initial departments, and optionally provisions a
 * login for its administrator - the last step reuses the existing generic
 * `StaffOnboardingService` rather than adding a second account-provisioning
 * path.
 */
export const OnboardHospitalSchema = CreateHospitalSchema.extend({
  departments: z
    .array(
      z.object({
        name: z.string().min(2).max(100),
        code: z
          .string()
          .min(2)
          .max(20)
          .regex(/^[A-Z0-9-]+$/, 'Code must be uppercase alphanumeric with hyphens'),
        description: z.string().optional(),
      }),
    )
    .max(50)
    .optional(),
  admin: z
    .object({
      email: z.string().email(),
      firstName: z.string().min(1).max(50),
      lastName: z.string().min(1).max(50),
      phone: z.string().optional(),
      /**
       * Granted scoped to the new hospital. Identified by `SystemRole` rather
       * than a role id because that is the key the existing
       * `StaffOnboardingService` already resolves against, so this wizard
       * reuses it without modification.
       */
      systemRole: z.nativeEnum(SystemRole).default(SystemRole.ORG_ADMIN),
    })
    .optional(),
})

export type OnboardHospitalDto = z.infer<typeof OnboardHospitalSchema>

export interface OnboardHospitalResult {
  hospital: Hospital
  departments: Department[]
  admin: { userId: string; email: string; created: boolean } | null
}

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
