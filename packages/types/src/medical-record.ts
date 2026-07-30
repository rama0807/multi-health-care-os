export interface VitalSigns {
  bloodPressureSystolic?: number
  bloodPressureDiastolic?: number
  heartRate?: number
  temperature?: number
  temperatureUnit?: 'C' | 'F'
  weight?: number
  weightUnit?: 'kg' | 'lbs'
  height?: number
  heightUnit?: 'cm' | 'in'
  spo2?: number
  respiratoryRate?: number
  bloodGlucose?: number
}

export interface MedicalRecord {
  id: string
  patientId: string
  doctorId: string
  appointmentId: string | null
  organizationId: string
  chiefComplaint: string
  historyOfPresentIllness: string | null
  pastMedicalHistory: string | null
  examination: string | null
  diagnosis: string
  icdCode: string | null
  plan: string | null
  followUpInstructions: string | null
  followUpDays: number | null
  vitalSigns: VitalSigns | null
  recordedAt: Date
  createdAt: Date
}
