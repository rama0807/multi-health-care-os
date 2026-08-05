import {
  MarkNotificationsSchema,
  PreviewNotificationTemplateSchema,
  RegisterDeviceSchema,
  SendNotificationSchema,
  UpdateNotificationPreferenceSchema,
  UpsertNotificationTemplateSchema,
} from '@medicore/types'
import { createZodDto } from 'nestjs-zod'

export class SendNotificationDto extends createZodDto(SendNotificationSchema) {}
export class MarkNotificationsDto extends createZodDto(MarkNotificationsSchema) {}
export class UpdateNotificationPreferenceDto extends createZodDto(UpdateNotificationPreferenceSchema) {}
export class RegisterDeviceDto extends createZodDto(RegisterDeviceSchema) {}
export class UpsertNotificationTemplateDto extends createZodDto(UpsertNotificationTemplateSchema) {}
export class PreviewNotificationTemplateDto extends createZodDto(PreviewNotificationTemplateSchema) {}
