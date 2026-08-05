import {
  UpdateOrganizationBrandingSchema,
  UpdateOrganizationSettingsSchema,
  UpsertSubscriptionSchema,
} from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class UpdateOrganizationSettingsDto extends createZodDto(UpdateOrganizationSettingsSchema) {}

export class UpdateOrganizationBrandingDto extends createZodDto(UpdateOrganizationBrandingSchema) {}

export class UpsertSubscriptionDto extends createZodDto(UpsertSubscriptionSchema) {}
