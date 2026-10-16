import { z } from 'zod'

// ─── Dental Patient Profile ──────────────────────────────────────────────────

export const CreateDentalPatientProfileSchema = z.object({
  patientId: z.string().min(1),
  referralSource: z.string().optional(),
  primaryDentistId: z.string().optional(),
  isHighRisk: z.boolean().default(false),
  clinicalNotes: z.string().optional(),
})

export type CreateDentalPatientProfileDto = z.infer<typeof CreateDentalPatientProfileSchema>

export const UpdateDentalPatientProfileSchema = CreateDentalPatientProfileSchema.partial().omit({
  patientId: true,
})

export type UpdateDentalPatientProfileDto = z.infer<typeof UpdateDentalPatientProfileSchema>

// ─── Dental Medical History & Safety Alerts ────────────────────────────────────

export const CreateDentalMedicalHistorySchema = z.object({
  patientId: z.string().min(1),
  allergies: z.array(z.string()).default([]),
  currentMedications: z.array(z.string()).default([]),
  conditions: z.array(z.string()).default([]),
  isPregnant: z.boolean().optional(),
  preMedicationNotes: z.string().optional(),
  emergencyContact: z.any().optional(),
})

export type CreateDentalMedicalHistoryDto = z.infer<typeof CreateDentalMedicalHistorySchema>

export const CreateDentalSafetyAlertSchema = z.object({
  patientId: z.string().min(1),
  alertType: z.string().min(1), // ALLERGY, MEDICAL_CONDITION, etc.
  severity: z.string().min(1),  // LOW, MEDIUM, HIGH, CRITICAL
  description: z.string().min(1),
  isActive: z.boolean().default(true),
})

export type CreateDentalSafetyAlertDto = z.infer<typeof CreateDentalSafetyAlertSchema>

// ─── Dental Imaging ──────────────────────────────────────────────────────────

export const CreateDentalImagingRecordSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  imagingType: z.enum(['OPG', 'BITEWING', 'PERIAPICAL', 'CBCT', 'INTRAORAL_PHOTO', 'OTHER']).default('OTHER'),
  title: z.string().optional(),
  storagePath: z.string().min(1),
  storageKey: z.string().min(1),
  mimeType: z.string().default('image/jpeg'),
  fileSizeBytes: z.number().int().default(0),
  notes: z.string().optional(),
})

export type CreateDentalImagingRecordDto = z.infer<typeof CreateDentalImagingRecordSchema>

// ─── Dental Chair ────────────────────────────────────────────────────────────

export const CreateDentalChairSchema = z.object({
  name: z.string().min(1).max(100),
  number: z.number().int().positive().optional(),
  hospitalId: z.string().optional(),
  equipment: z.array(z.string()).default([]),
  notes: z.string().optional(),
})

export type CreateDentalChairDto = z.infer<typeof CreateDentalChairSchema>

export const UpdateDentalChairSchema = CreateDentalChairSchema.partial().extend({
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE']).optional(),
  isActive: z.boolean().optional(),
})

export type UpdateDentalChairDto = z.infer<typeof UpdateDentalChairSchema>

// ─── Dental Encounter ────────────────────────────────────────────────────────

export const CreateDentalEncounterSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().optional(),
  chairId: z.string().optional(),
  dentistId: z.string().min(1),
  assistantId: z.string().optional(),
  chiefComplaint: z.string().optional(),
  visitDate: z.coerce.date().optional(),
})

export type CreateDentalEncounterDto = z.infer<typeof CreateDentalEncounterSchema>

export const UpdateDentalEncounterSchema = z.object({
  chairId: z.string().optional(),
  assistantId: z.string().optional(),
  chiefComplaint: z.string().optional(),
  status: z.enum(['OPEN', 'SIGNED', 'AMENDED']).optional(),
})

export type UpdateDentalEncounterDto = z.infer<typeof UpdateDentalEncounterSchema>

// ─── Dental Clinical Note ────────────────────────────────────────────────────

export const CreateDentalClinicalNoteSchema = z.object({
  encounterId: z.string().min(1),
  patientId: z.string().min(1),
  templateId: z.string().optional(),
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  additionalNotes: z.string().optional(),
})

export type CreateDentalClinicalNoteDto = z.infer<typeof CreateDentalClinicalNoteSchema>

export const UpdateDentalClinicalNoteSchema = CreateDentalClinicalNoteSchema.partial().omit({
  encounterId: true,
  patientId: true,
})

export type UpdateDentalClinicalNoteDto = z.infer<typeof UpdateDentalClinicalNoteSchema>

// ─── Odontogram ──────────────────────────────────────────────────────────────

const ToothSurfaceEnum = z.enum([
  'MESIAL', 'DISTAL', 'BUCCAL', 'LINGUAL', 'OCCLUSAL', 'INCISAL', 'PALATAL', 'LABIAL',
])

const ToothConditionEnum = z.enum([
  'SOUND', 'CARIES', 'RESTORED_COMPOSITE', 'RESTORED_AMALGAM', 'RESTORED_GOLD',
  'CROWN', 'BRIDGE_ABUTMENT', 'BRIDGE_PONTIC', 'IMPLANT', 'MISSING',
  'MISSING_UNERUPTED', 'IMPACTED', 'EXTRACTED', 'ROOT_CANAL', 'ROOT_STUMP',
  'FRACTURE', 'SEALANT', 'VENEER', 'DENTURE_FULL', 'DENTURE_PARTIAL', 'OTHER',
])

const OdontogramToothSchema = z.object({
  toothNumber: z.number().int().min(11).max(85),
  condition: ToothConditionEnum.default('SOUND'),
  surfaces: z.array(ToothSurfaceEnum).default([]),
  notes: z.string().optional(),
})

export const CreateOdontogramSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  notes: z.string().optional(),
  teeth: z.array(OdontogramToothSchema).min(1),
})

export type CreateOdontogramDto = z.infer<typeof CreateOdontogramSchema>

// ─── Treatment Plan ──────────────────────────────────────────────────────────

const TreatmentPlanItemSchema = z.object({
  toothNumber: z.number().int().optional(),
  surfaces: z.array(ToothSurfaceEnum).default([]),
  procedureName: z.string().min(1),
  procedureCode: z.string().optional(),
  sequence: z.number().int().default(0),
  estimatedCost: z.number().positive(),
  estimatedVisits: z.number().int().positive().default(1),
  durationMinutes: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

const TreatmentPlanOptionSchema = z.object({
  label: z.string().min(1),
  totalCost: z.number().positive(),
  discount: z.number().min(0).optional(),
  netCost: z.number().positive(),
  notes: z.string().optional(),
  items: z.array(TreatmentPlanItemSchema).min(1),
})

export const CreateTreatmentPlanSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
  notes: z.string().optional(),
  options: z.array(TreatmentPlanOptionSchema).min(1),
})

export type CreateTreatmentPlanDto = z.infer<typeof CreateTreatmentPlanSchema>

export const RecordAcceptanceSchema = z.object({
  optionId: z.string().min(1),
  status: z.enum(['ACCEPTED', 'DECLINED', 'DEFERRED', 'CALLBACK_REQUESTED']),
  callbackDate: z.coerce.date().optional(),
  notes: z.string().optional(),
})

export type RecordAcceptanceDto = z.infer<typeof RecordAcceptanceSchema>

// ─── Dental Procedure ────────────────────────────────────────────────────────

export const CreateDentalProcedureSchema = z.object({
  patientId: z.string().min(1),
  encounterId: z.string().min(1),
  toothNumber: z.number().int().optional(),
  surfaces: z.array(ToothSurfaceEnum).default([]),
  procedureName: z.string().min(1),
  procedureCode: z.string().optional(),
  cost: z.number().positive(),
  notes: z.string().optional(),
})

export type CreateDentalProcedureDto = z.infer<typeof CreateDentalProcedureSchema>

// ─── Dental Vendor ───────────────────────────────────────────────────────────

export const CreateDentalVendorSchema = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  vendorType: z.enum(['LAB', 'MATERIAL_SUPPLIER', 'EQUIPMENT_VENDOR']).default('LAB'),
  services: z.array(z.string()).default([]),
  defaultTurnaround: z.number().int().positive().optional(),
  notes: z.string().optional(),
})

export type CreateDentalVendorDto = z.infer<typeof CreateDentalVendorSchema>

export const UpdateDentalVendorSchema = CreateDentalVendorSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export type UpdateDentalVendorDto = z.infer<typeof UpdateDentalVendorSchema>

// ─── Lab Case ────────────────────────────────────────────────────────────────

const LabCaseMeasurementSchema = z.object({
  toothNumber: z.number().int(),
  restorationMaterial: z.string().optional(),
  shade: z.string().optional(),
  shadeSystem: z.string().optional(),
  measurements: z.record(z.unknown()).default({}),
  impressionType: z.string().optional(),
  scanInfo: z.string().optional(),
  notes: z.string().optional(),
})

export const CreateLabCaseSchema = z.object({
  patientId: z.string().min(1),
  procedureId: z.string().optional(),
  vendorId: z.string().optional(),
  restorationName: z.string().min(1),
  notes: z.string().optional(),
  measurements: z.array(LabCaseMeasurementSchema).optional(),
})

export type CreateLabCaseDto = z.infer<typeof CreateLabCaseSchema>

export const UpdateLabCaseStatusSchema = z.object({
  status: z.enum([
    'DRAFT', 'MEASUREMENT_PENDING', 'SENT_TO_VENDOR', 'IN_PRODUCTION',
    'READY_FOR_PICKUP', 'PICKED_UP', 'RECEIVED', 'TRY_IN',
    'CORRECTION_NEEDED', 'APPROVED', 'DELIVERED', 'REMAKE', 'CANCELLED',
  ]),
  notes: z.string().optional(),
})

export type UpdateLabCaseStatusDto = z.infer<typeof UpdateLabCaseStatusSchema>

// ─── Dental Recall ───────────────────────────────────────────────────────────

export const CreateDentalRecallSchema = z.object({
  patientId: z.string().min(1),
  recallType: z.enum(['CHECK_UP', 'CLEANING', 'FOLLOW_UP', 'POST_PROCEDURE']),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
})

export type CreateDentalRecallDto = z.infer<typeof CreateDentalRecallSchema>

// ─── Dental Billing & Payments ───────────────────────────────────────────────

export const CreateDentalInvoiceItemSchema = z.object({
  chargeId: z.string().optional(),
  description: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  unitPrice: z.number().min(0),
  taxPercentage: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
})

export const CreateDentalInvoiceSchema = z.object({
  patientId: z.string().min(1),
  dentalPatientProfileId: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  discountType: z.enum(['FLAT', 'PERCENTAGE']).optional(),
  discountValue: z.number().min(0).optional(),
  discountReason: z.string().optional(),
  items: z.array(CreateDentalInvoiceItemSchema).min(1),
})

export type CreateDentalInvoiceDto = z.infer<typeof CreateDentalInvoiceSchema>

export const CreateDentalPaymentSchema = z.object({
  invoiceId: z.string().min(1),
  patientId: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(['CASH', 'CARD', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'INSURANCE']),
  transactionId: z.string().optional(),
  paymentDate: z.coerce.date().optional(),
  notes: z.string().optional(),
})

export type CreateDentalPaymentDto = z.infer<typeof CreateDentalPaymentSchema>
