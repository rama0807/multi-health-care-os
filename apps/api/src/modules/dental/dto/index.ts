import { createZodDto } from 'nestjs-zod'

import {
  CreateDentalChairSchema,
  CreateDentalClinicalNoteSchema,
  CreateDentalEncounterSchema,
  CreateDentalImagingRecordSchema,
  CreateDentalMedicalHistorySchema,
  CreateDentalPatientProfileSchema,
  CreateDentalProcedureSchema,
  CreateDentalRecallSchema,
  CreateDentalSafetyAlertSchema,
  CreateDentalVendorSchema,
  CreateLabCaseSchema,
  CreateOdontogramSchema,
  CreateTreatmentPlanSchema,
  RecordAcceptanceSchema,
  UpdateDentalChairSchema,
  UpdateDentalClinicalNoteSchema,
  UpdateDentalEncounterSchema,
  UpdateDentalPatientProfileSchema,
  UpdateDentalVendorSchema,
  UpdateLabCaseStatusSchema,
  CreateDentalInvoiceSchema,
  CreateDentalPaymentSchema,
} from './dental.schemas'

// Patient Profile
export class CreateDentalPatientProfileDto extends createZodDto(CreateDentalPatientProfileSchema) {}
export class UpdateDentalPatientProfileDto extends createZodDto(UpdateDentalPatientProfileSchema) {}

// Medical History & Safety Alerts
export class CreateDentalMedicalHistoryDto extends createZodDto(CreateDentalMedicalHistorySchema) {}
export class CreateDentalSafetyAlertDto extends createZodDto(CreateDentalSafetyAlertSchema) {}

// Imaging
export class CreateDentalImagingRecordDto extends createZodDto(CreateDentalImagingRecordSchema) {}

// Chair
export class CreateDentalChairDto extends createZodDto(CreateDentalChairSchema) {}
export class UpdateDentalChairDto extends createZodDto(UpdateDentalChairSchema) {}

// Encounter
export class CreateDentalEncounterDto extends createZodDto(CreateDentalEncounterSchema) {}
export class UpdateDentalEncounterDto extends createZodDto(UpdateDentalEncounterSchema) {}

// Clinical Note
export class CreateDentalClinicalNoteDto extends createZodDto(CreateDentalClinicalNoteSchema) {}
export class UpdateDentalClinicalNoteDto extends createZodDto(UpdateDentalClinicalNoteSchema) {}

// Odontogram
export class CreateOdontogramDto extends createZodDto(CreateOdontogramSchema) {}

// Treatment Plan
export class CreateTreatmentPlanDto extends createZodDto(CreateTreatmentPlanSchema) {}
export class RecordAcceptanceDto extends createZodDto(RecordAcceptanceSchema) {}

// Procedure
export class CreateDentalProcedureDto extends createZodDto(CreateDentalProcedureSchema) {}

// Vendor
export class CreateDentalVendorDto extends createZodDto(CreateDentalVendorSchema) {}
export class UpdateDentalVendorDto extends createZodDto(UpdateDentalVendorSchema) {}

// Lab Case
export class CreateLabCaseDto extends createZodDto(CreateLabCaseSchema) {}
export class UpdateLabCaseStatusDto extends createZodDto(UpdateLabCaseStatusSchema) {}

// Recall
export class CreateDentalRecallDto extends createZodDto(CreateDentalRecallSchema) {}

export * from './create-dental-staff.dto'

// Billing
export class CreateDentalInvoiceDto extends createZodDto(CreateDentalInvoiceSchema) {}
export class CreateDentalPaymentDto extends createZodDto(CreateDentalPaymentSchema) {}

