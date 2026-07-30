import { LabTestStatus, Priority } from './enums'

export interface LabTest {
  id: string
  labOrderNumber: string
  patientId: string
  doctorId: string
  appointmentId: string | null
  organizationId: string
  status: LabTestStatus
  priority: Priority
  sampleCollectedBy: string | null
  sampleCollectedAt: Date | null
  reportedAt: Date | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface LabTestItem {
  id: string
  labTestId: string
  testName: string
  testCode: string
  category: string
  result: string | null
  unit: string | null
  referenceRange: string | null
  isAbnormal: boolean
  abnormalType: 'HIGH' | 'LOW' | 'CRITICAL_HIGH' | 'CRITICAL_LOW' | null
  interpretation: string | null
  createdAt: Date
}
