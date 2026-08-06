import {
  UpdateOrganizationBrandingSchema,
  UpdateOrganizationEmailConfigSchema,
  UpdateOrganizationSettingsSchema,
  UpsertSubscriptionSchema,
} from '@medicore/types'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export class UpdateOrganizationSettingsDto extends createZodDto(UpdateOrganizationSettingsSchema) {}

export class UpdateOrganizationBrandingDto extends createZodDto(UpdateOrganizationBrandingSchema) {}

export class UpsertSubscriptionDto extends createZodDto(UpsertSubscriptionSchema) {}

export class UpdateOrganizationEmailConfigDto extends createZodDto(UpdateOrganizationEmailConfigSchema) {}

export class SendTestEmailDto extends createZodDto(z.object({ to: z.string().email() })) {}
