import { NotFoundException } from '@nestjs/common'

import { ClinicalContextService } from './clinical-context.service'

describe('ClinicalContextService', () => {
  const patient = {
    firstName: 'Ramesh',
    lastName: 'Gupta',
    uhid: 'MED-2026-000001',
    dateOfBirth: new Date('1980-03-01T00:00:00.000Z'),
    gender: 'MALE',
    bloodGroup: 'O_POSITIVE',
  }

  function build(includeIdentifiers = true) {
    const prisma = {
      encounter: { findFirst: jest.fn() },
      labTest: { findFirst: jest.fn() },
      radiologyOrder: { findFirst: jest.fn() },
      prescription: { findFirst: jest.fn() },
      admission: { findFirst: jest.fn() },
    }
    const config = { get: jest.fn(() => includeIdentifiers) }
    return { prisma, service: new ClinicalContextService(prisma as never, config as never) }
  }

  it('renders lab results with the laboratory module’s own abnormal flag, not a recomputed one', async () => {
    const { prisma, service } = build()
    prisma.labTest.findFirst.mockResolvedValue({
      id: 'lab_1',
      labOrderNumber: 'LAB-MED-2026-000001',
      status: 'COMPLETED',
      priority: 'ROUTINE',
      doctorId: 'doctor_1',
      patientId: 'patient_1',
      encounterId: 'enc_1',
      sampleCollectedAt: null,
      reportedAt: null,
      notes: null,
      patient,
      doctor: { user: { firstName: 'Priya', lastName: 'Sharma' } },
      items: [
        {
          testName: 'Potassium',
          result: '6.8',
          unit: 'mmol/L',
          referenceRange: null,
          referenceRangeLow: 3.5,
          referenceRangeHigh: 5.1,
          isAbnormal: true,
          abnormalType: 'CRITICAL_HIGH',
          interpretation: null,
        },
        {
          testName: 'Sodium',
          result: '140',
          unit: 'mmol/L',
          referenceRange: '135-145',
          referenceRangeLow: null,
          referenceRangeHigh: null,
          isAbnormal: false,
          abnormalType: null,
          interpretation: null,
        },
      ],
    })

    const context = await service.build('org_1', { feature: 'LAB_RESULT_SUMMARY', labTestId: 'lab_1' } as never)

    expect(context.text).toContain('Potassium: 6.8 mmol/L (ref 3.5–5.1) [CRITICAL_HIGH]')
    expect(context.text).toContain('Sodium: 140 mmol/L (ref 135-145) [within range]')
    expect(context.doctorId).toBe('doctor_1')
    expect(context.labTestId).toBe('lab_1')
  })

  it('includes the patient name and UHID by default, and computes age from date of birth', async () => {
    const { prisma, service } = build(true)
    prisma.prescription.findFirst.mockResolvedValue(basePrescription(patient))

    const context = await service.build('org_1', {
      feature: 'PRESCRIPTION_EXPLANATION',
      prescriptionId: 'rx_1',
    } as never)

    expect(context.text).toContain('Name: Ramesh Gupta')
    expect(context.text).toContain(`UHID: ${patient.uhid}`)
    expect(context.text).toMatch(/Age: \d+ years/)
    expect(context.title).toContain('Ramesh Gupta')
  })

  it('redacts direct identifiers but keeps age and sex when AI_INCLUDE_PATIENT_IDENTIFIERS is off', async () => {
    const { prisma, service } = build(false)
    prisma.prescription.findFirst.mockResolvedValue(basePrescription(patient))

    const context = await service.build('org_1', {
      feature: 'PRESCRIPTION_EXPLANATION',
      prescriptionId: 'rx_1',
    } as never)

    expect(context.text).not.toContain('Ramesh')
    expect(context.text).not.toContain(patient.uhid)
    expect(context.text).toContain('Name: [redacted]')
    expect(context.text).toContain('Sex: MALE')
    expect(context.title).toContain('[redacted]')
  })

  it('refuses to summarise a radiology order that has no released report', async () => {
    const { prisma, service } = build()
    prisma.radiologyOrder.findFirst.mockResolvedValue({
      id: 'rad_1',
      orderNumber: 'RAD-1',
      status: 'COMPLETED',
      modality: 'CT',
      bodyPart: 'Chest',
      doctorId: 'doctor_1',
      patientId: 'patient_1',
      encounterId: null,
      patient,
      doctor: { user: { firstName: 'Priya', lastName: 'Sharma' } },
      reports: [],
    })

    await expect(
      service.build('org_1', { feature: 'RADIOLOGY_REPORT_SUMMARY', radiologyOrderId: 'rad_1' } as never),
    ).rejects.toThrow(NotFoundException)
  })

  it('404s rather than silently generating from nothing when the record is missing', async () => {
    const { prisma, service } = build()
    prisma.encounter.findFirst.mockResolvedValue(null)

    await expect(service.build('org_1', { feature: 'SOAP_NOTE', encounterId: 'nope' } as never)).rejects.toThrow(
      NotFoundException,
    )
  })
})

function basePrescription(patient: unknown) {
  return {
    id: 'rx_1',
    prescriptionNumber: 'RX-1',
    status: 'ACTIVE',
    prescribedAt: new Date('2026-08-01T00:00:00.000Z'),
    notes: null,
    doctorId: 'doctor_1',
    patientId: 'patient_1',
    encounterId: 'enc_1',
    patient,
    doctor: { user: { firstName: 'Priya', lastName: 'Sharma' } },
    items: [
      {
        medicationName: 'Amoxicillin',
        genericName: null,
        strength: '500mg',
        form: 'Capsule',
        dosage: '1 capsule',
        frequency: 'TDS',
        duration: '5 days',
        route: 'ORAL',
        instructions: 'After food',
        quantity: 15,
      },
    ],
  }
}
