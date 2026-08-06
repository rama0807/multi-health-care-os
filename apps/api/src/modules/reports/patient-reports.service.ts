import { PatientAgeBand, PatientReport, ReportFilterQuery } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import { ageInYears, comparison, countSeries, resolveRange, toPeriod, ResolvedRange } from './report-range.util'

/**
 * Age bands are a reporting convention, not a clinical classification -
 * the infant/paediatric split at the bottom matches how OPD load is usually
 * read, and the top band stays open-ended.
 */
const AGE_BANDS: Array<{ label: string; minAge: number; maxAge: number | null }> = [
  { label: '0-1', minAge: 0, maxAge: 2 },
  { label: '2-12', minAge: 2, maxAge: 13 },
  { label: '13-18', minAge: 13, maxAge: 19 },
  { label: '19-30', minAge: 19, maxAge: 31 },
  { label: '31-45', minAge: 31, maxAge: 46 },
  { label: '46-60', minAge: 46, maxAge: 61 },
  { label: '61-75', minAge: 61, maxAge: 76 },
  { label: '76+', minAge: 76, maxAge: null },
]

/**
 * Patient reporting (Milestone 17 Checkpoint 17.1) - a read-only aggregation
 * over `Patient` plus the three tables that evidence a patient was actually
 * seen (`Appointment`/`Encounter`/`Admission`). Honours `from`/`to`/`groupBy`
 * only: `Patient` carries no hospital, department or doctor column, so
 * silently accepting those filters would return an unfiltered number under a
 * filtered heading.
 */
@Injectable()
export class PatientReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(organizationId: string, query: ReportFilterQuery = {}): Promise<PatientReport> {
    const range = resolveRange(query)

    const [registered, previousRegistrations, seenPatientIds] = await Promise.all([
      this.prisma.patient.findMany({
        where: { organizationId, deletedAt: null, createdAt: { gte: range.from, lt: range.to } },
        select: { id: true, createdAt: true },
      }),
      this.prisma.patient.count({
        where: {
          organizationId,
          deletedAt: null,
          createdAt: { gte: range.previousFrom, lt: range.previousTo },
        },
      }),
      this.collectSeenPatientIds(organizationId, range),
    ])

    const registeredIds = new Set(registered.map((p) => p.id))
    // "New" vs "returning" is measured against the period itself: a patient
    // seen in the period who registered before it is a returning patient.
    let newPatients = 0
    for (const id of seenPatientIds) if (registeredIds.has(id)) newPatients++

    const cohortIds = new Set<string>([...registeredIds, ...seenPatientIds])
    const { ageDistribution, genderDistribution } = await this.describeCohort(organizationId, cohortIds, range)

    return {
      period: toPeriod(range),
      registrations: registered.length,
      registrationTrend: countSeries(registered, range, (p) => p.createdAt),
      activePatients: seenPatientIds.size,
      newPatients,
      returningPatients: seenPatientIds.size - newPatients,
      ageDistribution,
      genderDistribution,
      registrationsComparison: comparison(registered.length, previousRegistrations),
    }
  }

  /**
   * Distinct patients with clinical activity in the range. Deliberately three
   * separate cheap `select: { patientId: true }` queries rather than a join -
   * "seen" spans three unrelated tables and the union is done in memory,
   * matching how `PatientsService` builds its cross-module timeline.
   */
  private async collectSeenPatientIds(organizationId: string, range: ResolvedRange): Promise<Set<string>> {
    const window = { gte: range.from, lt: range.to }
    const [appointments, encounters, admissions] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { organizationId, scheduledAt: window },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
      this.prisma.encounter.findMany({
        where: { organizationId, encounterDate: window },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
      this.prisma.admission.findMany({
        where: { organizationId, admittedAt: window },
        select: { patientId: true },
        distinct: ['patientId'],
      }),
    ])

    return new Set([
      ...appointments.map((a) => a.patientId),
      ...encounters.map((e) => e.patientId),
      ...admissions.map((a) => a.patientId),
    ])
  }

  /**
   * Demographics are reported over the *period cohort* - everyone registered
   * in the period plus everyone seen in it - rather than the whole patient
   * panel, so a date filter actually changes the distribution it labels.
   */
  private async describeCohort(
    organizationId: string,
    cohortIds: Set<string>,
    range: ResolvedRange,
  ): Promise<Pick<PatientReport, 'ageDistribution' | 'genderDistribution'>> {
    const emptyBands: PatientAgeBand[] = AGE_BANDS.map((band) => ({ ...band, count: 0 }))
    if (cohortIds.size === 0) return { ageDistribution: emptyBands, genderDistribution: [] }

    const patients = await this.prisma.patient.findMany({
      where: { organizationId, deletedAt: null, id: { in: [...cohortIds] } },
      select: { dateOfBirth: true, gender: true },
    })

    // Ages are computed as at the end of the reporting window, not "now", so
    // re-running a historical report gives the same answer every time.
    const asOf = range.to
    const bands = AGE_BANDS.map((band) => ({ ...band, count: 0 }))
    const genders = new Map<string, number>()

    for (const patient of patients) {
      const age = ageInYears(patient.dateOfBirth, asOf)
      const band = bands.find((b) => age >= b.minAge && (b.maxAge === null || age < b.maxAge))
      if (band) band.count++
      genders.set(patient.gender, (genders.get(patient.gender) ?? 0) + 1)
    }

    return {
      ageDistribution: bands,
      genderDistribution: [...genders.entries()]
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
    }
  }
}
