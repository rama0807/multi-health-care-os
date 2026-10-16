/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
import { apiClient } from './client'

function unwrap<T = any>(response: any): T {
  if (response && typeof response === 'object' && 'data' in response && response.data !== undefined) {
    return response.data as T
  }
  return response as T
}

export async function getDentalDashboardSummary(): Promise<DentalDashboardSummary> {
  const { data } = await apiClient.get('/dental/dashboard/summary')
  return unwrap<DentalDashboardSummary>(data)
}

export interface DentalDashboardSummary {
  appointments: {
    total: number
    confirmed: number
    pending: number
    cancelled: number
    noShow: number
    completed: number
    inProgress: number
    totalPatients: number
  }
  patients: {
    total: number
    newPatients: number
    returning: number
  }
  todayFinancials: {
    production: number
    collections: number
  }
  outstanding: {
    total: number
    overdue: number
    dueSoon: number
  }
  pipeline: {
    proposed: number
    accepted: number
    deferred: number
    pendingFollowUp: number
    acceptanceRate: number | null
  }
  lab: {
    active: number
    overdue: number
    dueToday: number
    byStatus: Record<string, number>
    cases: Array<{
      id: string
      restorationName: string
      status: string
      expectedReturnAt: string | null
      vendor: { id: string; name: string } | null
      patient: { id: string; firstName: string; lastName: string }
      measurements: Array<{ toothNumber: number; restorationMaterial: string | null }>
    }>
  }
  recalls: {
    dueToday: number
    overdue: number
    upcoming: number
  }
  attention: Array<{
    id: string
    type: string
    title: string
    description: string
    count: number
    value?: number
    href: string
    severity: 'high' | 'medium' | 'low'
  }>
  revenue: {
    production: number
    collections: number
    outstanding: number
    discounts: number
  }
  todaysClinic: Array<{
    id: string
    scheduledAt: string
    durationMinutes: number | null
    status: string
    type: string | null
    patient: { id: string; firstName: string; lastName: string; uhid: string }
    doctor: { id: string; user: { firstName: string; lastName: string } } | null
  }>
}

export const dentalApi = {

  // Patient Profile
  getPatientProfile: async (patientId: string) => {
    const { data } = await apiClient.get(`/dental/patients/${patientId}/profile`)
    return unwrap(data)
  },
  createPatientProfile: async (patientId: string, payload: any) => {
    const { data } = await apiClient.post(`/dental/patients/${patientId}/profile`, payload)
    return unwrap(data)
  },
  updatePatientProfile: async (patientId: string, payload: any) => {
    const { data } = await apiClient.patch(`/dental/patients/${patientId}/profile`, payload)
    return unwrap(data)
  },

  // Medical History & Safety Alerts
  createMedicalHistory: async (patientId: string, payload: any) => {
    const { data } = await apiClient.post(`/dental/patients/${patientId}/medical-history`, payload)
    return unwrap(data)
  },
  createSafetyAlert: async (patientId: string, payload: any) => {
    const { data } = await apiClient.post(`/dental/patients/${patientId}/safety-alerts`, payload)
    return unwrap(data)
  },

  // Imaging
  listImagingRecords: async (patientId: string) => {
    const { data } = await apiClient.get(`/dental/patients/${patientId}/imaging`)
    return unwrap(data)
  },
  createImagingRecord: async (patientId: string, payload: any) => {
    const { data } = await apiClient.post(`/dental/patients/${patientId}/imaging`, payload)
    return unwrap(data)
  },
  uploadImagingRecord: async (patientId: string, formData: FormData) => {
    const { data } = await apiClient.post(`/dental/patients/${patientId}/imaging`, formData, {
      headers: { 'Content-Type': undefined },
    })
    return unwrap(data)
  },

  // Ledger
  listLedger: async (patientId: string) => {
    const { data } = await apiClient.get(`/dental/patients/${patientId}/ledger`)
    return unwrap(data)
  },

  // Chairs
  listChairs: async () => {
    const { data } = await apiClient.get('/dental/chairs')
    return unwrap(data)
  },
  createChair: async (payload: any) => {
    const { data } = await apiClient.post('/dental/chairs', payload)
    return unwrap(data)
  },
  updateChair: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/dental/chairs/${id}`, payload)
    return unwrap(data)
  },

  // Encounters
  listEncounters: async (params?: any) => {
    const { data } = await apiClient.get('/dental/encounters', { params })
    return unwrap(data)
  },
  getEncounter: async (id: string) => {
    const { data } = await apiClient.get(`/dental/encounters/${id}`)
    return unwrap(data)
  },
  createEncounter: async (payload: any) => {
    const { data } = await apiClient.post('/dental/encounters', payload)
    return unwrap(data)
  },
  updateEncounter: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/dental/encounters/${id}`, payload)
    return unwrap(data)
  },

  // Clinical Notes
  createClinicalNote: async (payload: any) => {
    const { data } = await apiClient.post('/dental/clinical-notes', payload)
    return unwrap(data)
  },
  updateClinicalNote: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/dental/clinical-notes/${id}`, payload)
    return unwrap(data)
  },
  signClinicalNote: async (id: string) => {
    const { data } = await apiClient.post(`/dental/clinical-notes/${id}/sign`)
    return unwrap(data)
  },

  // Treatment Plans
  listTreatmentPlans: async (params?: { patientId: string }) => {
    const { data } = await apiClient.get('/dental/treatment-plans', { params })
    return unwrap(data)
  },
  getTreatmentPlan: async (id: string) => {
    const { data } = await apiClient.get(`/dental/treatment-plans/${id}`)
    return unwrap(data)
  },
  createTreatmentPlan: async (payload: any) => {
    const { data } = await apiClient.post('/dental/treatment-plans', payload)
    return unwrap(data)
  },
  recordAcceptance: async (patientId: string, payload: any) => {
    const { data } = await apiClient.post('/dental/treatment-plans/acceptance', payload, {
      params: { patientId },
    })
    return unwrap(data)
  },

  // Odontogram
  getLatestOdontogram: async (patientId: string) => {
    const { data } = await apiClient.get(`/dental/odontogram/${patientId}`)
    return unwrap(data)
  },
  createOdontogram: async (payload: any) => {
    const { data } = await apiClient.post('/dental/odontogram', payload)
    return unwrap(data)
  },
  getToothHistory: async (patientId: string, toothNumber: string) => {
    const { data } = await apiClient.get(`/dental/tooth-history/${patientId}/${toothNumber}`)
    return unwrap(data)
  },

  // Procedures
  listProcedures: async (params?: any) => {
    const { data } = await apiClient.get('/dental/procedures', { params })
    return unwrap(data)
  },
  createProcedure: async (payload: any) => {
    const { data } = await apiClient.post('/dental/procedures', payload)
    return unwrap(data)
  },

  // Vendors
  listVendors: async () => {
    const { data } = await apiClient.get('/dental/vendors')
    return unwrap(data)
  },
  getVendor: async (id: string) => {
    const { data } = await apiClient.get(`/dental/vendors/${id}`)
    return unwrap(data)
  },
  createVendor: async (payload: any) => {
    const { data } = await apiClient.post('/dental/vendors', payload)
    return unwrap(data)
  },
  updateVendor: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/dental/vendors/${id}`, payload)
    return unwrap(data)
  },

  // Lab Cases
  listLabCases: async (params?: any) => {
    const { data } = await apiClient.get('/dental/lab-cases', { params })
    return unwrap(data)
  },
  getLabCase: async (id: string) => {
    const { data } = await apiClient.get(`/dental/lab-cases/${id}`)
    return unwrap(data)
  },
  createLabCase: async (payload: any) => {
    const { data } = await apiClient.post('/dental/lab-cases', payload)
    return unwrap(data)
  },
  updateLabCaseStatus: async (id: string, payload: any) => {
    const { data } = await apiClient.patch(`/dental/lab-cases/${id}/status`, payload)
    return unwrap(data)
  },

  // Recalls
  listRecalls: async (params?: any) => {
    const { data } = await apiClient.get('/dental/recalls', { params })
    return unwrap(data)
  },
  createRecall: async (payload: any) => {
    const { data } = await apiClient.post('/dental/recalls', payload)
    return unwrap(data)
  },
}

// eslint-disable-next-line import/order
import { CreateDentalStaffDto, Staff } from '@medicore/types'

export async function createDentalStaff(dto: CreateDentalStaffDto): Promise<Staff> {
  const res = await apiClient.post('/dental/staff', dto)
  return res.data?.data ?? res.data
}

