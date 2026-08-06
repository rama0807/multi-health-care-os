import { GenerateAiContentDto } from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { PrismaService } from '../../../prisma/prisma.service'

/**
 * What a context builder produces. `doctorId` is what own-scope RBAC is
 * checked against, so every builder must resolve the treating doctor for the
 * record it read - a feature with no resolvable doctor cannot be own-scoped.
 */
export interface ClinicalContext {
  /** The plaintext block interpolated into the prompt's `{{context}}`. */
  text: string
  title: string
  doctorId: string
  patientId: string
  encounterId?: string
  labTestId?: string
  radiologyOrderId?: string
  prescriptionId?: string
  admissionId?: string
}

/**
 * Assembles read-only prompt context from the existing EMR, Laboratory,
 * Radiology, Prescriptions and IPD modules. It never writes, and it never
 * reaches for data a given feature doesn't need - context assembly is itself
 * a PHI read, so it runs only after the feature flag and availability checks
 * have passed (ADR-0023).
 */
@Injectable()
export class ClinicalContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async build(organizationId: string, dto: GenerateAiContentDto): Promise<ClinicalContext> {
    switch (dto.feature) {
      case 'SOAP_NOTE':
      case 'CLINICAL_NOTE_SUMMARY':
      case 'REFERRAL_LETTER':
        return this.buildEncounterContext(organizationId, dto.encounterId)
      case 'LAB_RESULT_SUMMARY':
        return this.buildLabContext(organizationId, dto.labTestId)
      case 'RADIOLOGY_REPORT_SUMMARY':
        return this.buildRadiologyContext(organizationId, dto.radiologyOrderId)
      case 'PRESCRIPTION_EXPLANATION':
        return this.buildPrescriptionContext(organizationId, dto.prescriptionId)
      case 'DISCHARGE_SUMMARY':
        return this.buildAdmissionContext(organizationId, dto.admissionId)
    }
  }

  // ─── Encounter (SOAP note / clinical summary / referral letter) ──────────

  private async buildEncounterContext(organizationId: string, encounterId: string): Promise<ClinicalContext> {
    const encounter = await this.prisma.encounter.findFirst({
      where: { id: encounterId, organizationId },
      include: {
        patient: true,
        doctor: { include: { user: true } },
        // Notes are append-only and versioned; only the current version is
        // clinically current, so earlier versions are deliberately not sent.
        clinicalNotes: { orderBy: { version: 'desc' }, take: 1 },
        vitals: { orderBy: { recordedAt: 'desc' }, take: 5 },
        diagnoses: true,
        procedures: { orderBy: { performedAt: 'asc' } },
        prescriptions: { include: { items: true }, orderBy: { prescribedAt: 'desc' } },
        labTests: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 10 },
        radiologyOrders: {
          include: { reports: { orderBy: { version: 'desc' }, take: 1 } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })
    if (!encounter) throw new NotFoundException('Encounter not found')

    const note = encounter.clinicalNotes[0]
    const sections: string[] = [
      this.patientBlock(encounter.patient),
      section('ENCOUNTER', [
        field('Type', encounter.type),
        field('Status', encounter.status),
        field('Date', encounter.encounterDate.toISOString().slice(0, 10)),
        field('Treating doctor', `Dr. ${encounter.doctor.user.firstName} ${encounter.doctor.user.lastName}`),
        field('Specialization', encounter.doctor.specialization),
        field('Encounter notes', encounter.notes),
      ]),
      section('CLINICAL NOTE (current version)', [
        field('Chief complaint', note?.chiefComplaint),
        field('History of present illness', note?.historyOfPresentIllness),
        field('Past medical history', note?.pastMedicalHistory),
        field('Family history', note?.familyHistory),
        field('Surgical history', note?.surgicalHistory),
        field('Social history', note?.socialHistory),
        field('Allergies', note?.allergies),
        field('Current medications', note?.currentMedications),
      ]),
      section(
        'VITALS (most recent first)',
        encounter.vitals.map((vital) =>
          bullet(
            [
              `Recorded ${vital.recordedAt.toISOString().slice(0, 16).replace('T', ' ')}`,
              pair('BP', joinIfBoth(vital.bloodPressureSystolic, vital.bloodPressureDiastolic, '/', 'mmHg')),
              pair('Pulse', unit(vital.pulse, 'bpm')),
              pair('Temp', unit(vital.temperatureCelsius, '°C')),
              pair('Resp rate', unit(vital.respiratoryRate, '/min')),
              pair('SpO2', unit(vital.spo2, '%')),
              pair('Height', unit(vital.heightCm, 'cm')),
              pair('Weight', unit(vital.weightKg, 'kg')),
              pair('BMI', vital.bmi?.toFixed(1)),
            ]
              .filter(Boolean)
              .join(', '),
          ),
        ),
      ),
      section(
        'DIAGNOSES',
        encounter.diagnoses.map((diagnosis) =>
          bullet(`${diagnosis.type}: ${diagnosis.description}${diagnosis.icdCode ? ` (ICD ${diagnosis.icdCode})` : ''}`),
        ),
      ),
      section(
        'PROCEDURES',
        encounter.procedures.map((procedure) =>
          bullet(`${procedure.name}${procedure.notes ? ` - ${procedure.notes}` : ''}`),
        ),
      ),
      section(
        'PRESCRIPTIONS',
        encounter.prescriptions.flatMap((prescription) => [
          bullet(`${prescription.prescriptionNumber} (${prescription.status})`),
          ...prescription.items.map((item) => `  - ${describePrescriptionItem(item)}`),
        ]),
      ),
      section(
        'LABORATORY RESULTS',
        encounter.labTests.flatMap((test) => [
          bullet(`${test.labOrderNumber} (${test.status})`),
          ...test.items.map((item) => `  - ${describeLabItem(item)}`),
        ]),
      ),
      section(
        'IMAGING',
        encounter.radiologyOrders.flatMap((order) => {
          const report = order.reports[0]
          return [
            bullet(`${order.orderNumber} - ${order.modality} ${order.bodyPart} (${order.status})`),
            ...(report
              ? [
                  `  - Findings: ${clean(report.findings)}`,
                  `  - Impression: ${clean(report.impression)}`,
                  `  - Recommendations: ${clean(report.recommendations)}`,
                ]
              : ['  - No report released yet']),
          ]
        }),
      ),
    ]

    return {
      text: sections.filter(Boolean).join('\n\n'),
      title: `${encounter.type} encounter - ${this.patientLabel(encounter.patient)}`,
      doctorId: encounter.doctorId,
      patientId: encounter.patientId,
      encounterId: encounter.id,
    }
  }

  // ─── Laboratory ──────────────────────────────────────────────────────────

  private async buildLabContext(organizationId: string, labTestId: string): Promise<ClinicalContext> {
    const labTest = await this.prisma.labTest.findFirst({
      where: { id: labTestId, organizationId },
      include: { patient: true, doctor: { include: { user: true } }, items: true },
    })
    if (!labTest) throw new NotFoundException('Lab order not found')

    const text = [
      this.patientBlock(labTest.patient),
      section('LAB ORDER', [
        field('Order number', labTest.labOrderNumber),
        field('Status', labTest.status),
        field('Priority', labTest.priority),
        field('Ordering doctor', `Dr. ${labTest.doctor.user.firstName} ${labTest.doctor.user.lastName}`),
        field('Sample collected at', labTest.sampleCollectedAt?.toISOString().slice(0, 16).replace('T', ' ')),
        field('Reported at', labTest.reportedAt?.toISOString().slice(0, 16).replace('T', ' ')),
        field('Order notes', labTest.notes),
      ]),
      section(
        'RESULTS',
        labTest.items.map((item) => bullet(describeLabItem(item))),
      ),
    ]
      .filter(Boolean)
      .join('\n\n')

    return {
      text,
      title: `Lab report ${labTest.labOrderNumber} - ${this.patientLabel(labTest.patient)}`,
      doctorId: labTest.doctorId,
      patientId: labTest.patientId,
      labTestId: labTest.id,
      encounterId: labTest.encounterId ?? undefined,
    }
  }

  // ─── Radiology ───────────────────────────────────────────────────────────

  private async buildRadiologyContext(organizationId: string, radiologyOrderId: string): Promise<ClinicalContext> {
    const order = await this.prisma.radiologyOrder.findFirst({
      where: { id: radiologyOrderId, organizationId },
      include: { patient: true, doctor: { include: { user: true } }, reports: { orderBy: { version: 'desc' }, take: 1 } },
    })
    if (!order) throw new NotFoundException('Radiology order not found')

    const report = order.reports[0]
    if (!report) {
      throw new NotFoundException('This radiology order has no report to summarise yet')
    }

    const text = [
      this.patientBlock(order.patient),
      section('RADIOLOGY ORDER', [
        field('Order number', order.orderNumber),
        field('Status', order.status),
        field('Modality', order.modality),
        field('Body part', order.bodyPart),
        field('Ordering doctor', `Dr. ${order.doctor.user.firstName} ${order.doctor.user.lastName}`),
      ]),
      section(`REPORT (version ${report.version})`, [
        field('Clinical indication', report.clinicalIndication),
        field('Technique', report.technique),
        field('Findings', report.findings),
        field('Impression', report.impression),
        field('Recommendations', report.recommendations),
      ]),
    ]
      .filter(Boolean)
      .join('\n\n')

    return {
      text,
      title: `Imaging report ${order.orderNumber} - ${this.patientLabel(order.patient)}`,
      doctorId: order.doctorId,
      patientId: order.patientId,
      radiologyOrderId: order.id,
      encounterId: order.encounterId ?? undefined,
    }
  }

  // ─── Prescriptions ───────────────────────────────────────────────────────

  private async buildPrescriptionContext(organizationId: string, prescriptionId: string): Promise<ClinicalContext> {
    const prescription = await this.prisma.prescription.findFirst({
      where: { id: prescriptionId, organizationId },
      include: { patient: true, doctor: { include: { user: true } }, items: true },
    })
    if (!prescription) throw new NotFoundException('Prescription not found')

    const text = [
      this.patientBlock(prescription.patient),
      section('PRESCRIPTION', [
        field('Prescription number', prescription.prescriptionNumber),
        field('Status', prescription.status),
        field('Prescribed on', prescription.prescribedAt.toISOString().slice(0, 10)),
        field('Prescribing doctor', `Dr. ${prescription.doctor.user.firstName} ${prescription.doctor.user.lastName}`),
        field('Notes', prescription.notes),
      ]),
      section(
        'MEDICATIONS',
        prescription.items.map((item) => bullet(describePrescriptionItem(item))),
      ),
    ]
      .filter(Boolean)
      .join('\n\n')

    return {
      text,
      title: `Prescription ${prescription.prescriptionNumber} - ${this.patientLabel(prescription.patient)}`,
      doctorId: prescription.doctorId,
      patientId: prescription.patientId,
      prescriptionId: prescription.id,
      encounterId: prescription.encounterId ?? undefined,
    }
  }

  // ─── IPD admission (discharge summary) ───────────────────────────────────

  private async buildAdmissionContext(organizationId: string, admissionId: string): Promise<ClinicalContext> {
    const admission = await this.prisma.admission.findFirst({
      where: { id: admissionId, organizationId },
      include: {
        patient: true,
        attendingDoctor: { include: { user: true } },
        encounter: {
          include: {
            clinicalNotes: { orderBy: { version: 'desc' }, take: 1 },
            diagnoses: true,
            procedures: true,
            vitals: { orderBy: { recordedAt: 'desc' }, take: 3 },
            prescriptions: { include: { items: true } },
          },
        },
        nursingNotes: { orderBy: { createdAt: 'asc' }, take: 25 },
        ipdOrders: { orderBy: { createdAt: 'asc' }, take: 25 },
        dischargeSummary: true,
      },
    })
    if (!admission) throw new NotFoundException('Admission not found')

    const encounter = admission.encounter
    const note = encounter?.clinicalNotes[0]
    const summary = admission.dischargeSummary

    const text = [
      this.patientBlock(admission.patient),
      section('ADMISSION', [
        field('Admission number', admission.admissionNumber),
        field('Type', admission.type),
        field('Status', admission.status),
        field('Admitted at', admission.admittedAt.toISOString().slice(0, 16).replace('T', ' ')),
        field('Attending doctor', `Dr. ${admission.attendingDoctor.user.firstName} ${admission.attendingDoctor.user.lastName}`),
        field('Reason for admission', admission.admissionReason),
        field('Admitting diagnosis', admission.diagnosis),
      ]),
      section('CLINICAL NOTE (current version)', [
        field('Chief complaint', note?.chiefComplaint),
        field('History of present illness', note?.historyOfPresentIllness),
        field('Past medical history', note?.pastMedicalHistory),
        field('Allergies', note?.allergies),
      ]),
      section(
        'DIAGNOSES',
        (encounter?.diagnoses ?? []).map((diagnosis) => bullet(`${diagnosis.type}: ${diagnosis.description}`)),
      ),
      section(
        'PROCEDURES',
        (encounter?.procedures ?? []).map((procedure) =>
          bullet(`${procedure.name}${procedure.notes ? ` - ${procedure.notes}` : ''}`),
        ),
      ),
      section(
        'NURSING NOTES (chronological)',
        admission.nursingNotes.map((nursingNote) =>
          bullet(
            `${nursingNote.createdAt.toISOString().slice(0, 16).replace('T', ' ')} [${nursingNote.type}${
              nursingNote.isEscalated ? ', ESCALATED' : ''
            }] ${clean(nursingNote.content)}`,
          ),
        ),
      ),
      section(
        'INPATIENT ORDERS',
        admission.ipdOrders.map((order) =>
          bullet(`${order.category}: ${clean(order.instructions)}${order.status === 'ACTIVE' ? '' : ` (${order.status})`}`),
        ),
      ),
      section(
        'MEDICATIONS PRESCRIBED DURING STAY',
        (encounter?.prescriptions ?? []).flatMap((prescription) =>
          prescription.items.map((item) => bullet(describePrescriptionItem(item))),
        ),
      ),
      section('EXISTING DISCHARGE SUMMARY DRAFT', [
        field('Final diagnosis', summary?.finalDiagnosis),
        field('Course in hospital', summary?.courseInHospital),
        field('Procedures performed', summary?.proceduresPerformed),
        field('Condition at discharge', summary?.conditionAtDischarge),
        field('Medication reconciliation', summary?.medicationReconciliation),
        field('Follow-up instructions', summary?.followUpInstructions),
      ]),
    ]
      .filter(Boolean)
      .join('\n\n')

    return {
      text,
      title: `Discharge summary ${admission.admissionNumber} - ${this.patientLabel(admission.patient)}`,
      doctorId: admission.attendingDoctorId,
      patientId: admission.patientId,
      admissionId: admission.id,
      encounterId: admission.encounterId ?? undefined,
    }
  }

  // ─── Patient identity ────────────────────────────────────────────────────

  /**
   * Direct identifiers are omitted when `AI_INCLUDE_PATIENT_IDENTIFIERS=false`
   * - for deployments sending context to a provider without a signed BAA. Age
   * and sex stay either way, since they are clinically load-bearing (TD-0042).
   */
  private patientBlock(patient: {
    firstName: string
    lastName: string
    uhid: string
    dateOfBirth: Date
    gender: string
    bloodGroup: string | null
  }): string {
    const includeIdentifiers = this.config.get<boolean>('ai.includePatientIdentifiers') ?? true

    return section('PATIENT', [
      includeIdentifiers ? field('Name', `${patient.firstName} ${patient.lastName}`) : field('Name', '[redacted]'),
      includeIdentifiers ? field('UHID', patient.uhid) : null,
      field('Age', `${ageInYears(patient.dateOfBirth)} years`),
      field('Sex', patient.gender),
      field('Blood group', patient.bloodGroup),
    ])
  }

  private patientLabel(patient: { firstName: string; lastName: string; uhid: string }): string {
    const includeIdentifiers = this.config.get<boolean>('ai.includePatientIdentifiers') ?? true
    return includeIdentifiers ? `${patient.firstName} ${patient.lastName} (${patient.uhid})` : 'patient [redacted]'
  }
}

// ─── Formatting helpers ────────────────────────────────────────────────────

function section(heading: string, lines: Array<string | null>): string {
  const body = lines.filter((line): line is string => !!line)
  if (!body.length) return ''
  return `## ${heading}\n${body.join('\n')}`
}

function field(label: string, value: string | null | undefined): string | null {
  const cleaned = clean(value)
  return cleaned === 'Not documented' ? null : `${label}: ${cleaned}`
}

function bullet(text: string): string {
  return `- ${text}`
}

function pair(label: string, value: string | null | undefined): string {
  return value ? `${label} ${value}` : ''
}

function unit(value: number | null | undefined, suffix: string): string | null {
  return value === null || value === undefined ? null : `${value}${suffix}`
}

function joinIfBoth(a: number | null, b: number | null, separator: string, suffix: string): string | null {
  return a === null || b === null ? null : `${a}${separator}${b}${suffix}`
}

function clean(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : 'Not documented'
}

function describeLabItem(item: {
  testName: string
  result: string | null
  unit: string | null
  referenceRange: string | null
  referenceRangeLow: number | null
  referenceRangeHigh: number | null
  isAbnormal: boolean
  abnormalType: string | null
  interpretation: string | null
}): string {
  const range =
    item.referenceRange ??
    (item.referenceRangeLow !== null && item.referenceRangeHigh !== null
      ? `${item.referenceRangeLow}–${item.referenceRangeHigh}`
      : null)

  return [
    `${item.testName}: ${item.result ?? 'pending'}${item.unit ? ` ${item.unit}` : ''}`,
    range ? `(ref ${range})` : '',
    // The flag comes from the laboratory module's own rules - the prompt tells
    // the model to repeat it, never to recompute it.
    item.isAbnormal ? `[${item.abnormalType ?? 'ABNORMAL'}]` : '[within range]',
    item.interpretation ? `- ${item.interpretation}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function describePrescriptionItem(item: {
  medicationName: string
  genericName: string | null
  strength: string | null
  form: string | null
  dosage: string
  frequency: string
  duration: string
  route: string
  instructions: string | null
  quantity: number
}): string {
  return [
    `${item.medicationName}${item.genericName ? ` (${item.genericName})` : ''}`,
    item.strength ?? '',
    item.form ?? '',
    `- ${item.dosage}, ${item.frequency}, for ${item.duration}, ${item.route}`,
    `qty ${item.quantity}`,
    item.instructions ? `- ${item.instructions}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

function ageInYears(dateOfBirth: Date): number {
  const now = new Date()
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear()
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) age -= 1
  return Math.max(age, 0)
}
