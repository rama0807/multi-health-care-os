import { z } from 'zod'

import { OrganizationType, SubscriptionTier } from './enums'

export interface Organization {
  id: string
  name: string
  slug: string
  type: OrganizationType
  email: string
  phone: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  pincode: string | null
  logo: string | null
  website: string | null
  licenseNumber: string | null
  subscriptionTier: SubscriptionTier
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface OrganizationSettings {
  uhidPrefix: string
  uhidResetYearly: boolean
  timezone: string
  currency: string
  currencySymbol: string
  dateFormat: string
  timeFormat: '12h' | '24h'
  gstNumber?: string
  gstRate: number
  defaultAppointmentDuration: number
  workingDays: number[]
  workingHoursStart: string
  workingHoursEnd: string
}

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  website: z.string().url().optional(),
  licenseNumber: z.string().optional(),
})
