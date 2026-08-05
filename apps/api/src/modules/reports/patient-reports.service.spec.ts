import { PatientReportsService } from './patient-reports.service'

describe('PatientReportsService', () => {
  let prisma: {
    patient: Record<string, jest.Mock>
    appointment: Record<string, jest.Mock>
    encounter: Record<string, jest.Mock>
    admission: Record<string, jest.Mock>
  }
  let service: PatientReportsService

  beforeEach(() => {
    prisma = {
      patient: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      encounter: { findMany: jest.fn().mockResolvedValue([]) },
      admission: { findMany: jest.fn().mockResolvedValue([]) },
    }
    service = new PatientReportsService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  const range = { from: '2026-07-01', to: '2026-07-31' }

  it('returns an empty report with every age band present', async () => {
    const report = await service.getReport('org_1', range)

    expect(report.registrations).toBe(0)
    expect(report.activePatients).toBe(0)
    expect(report.registrationTrend).toHaveLength(31)
    // Bands are always emitted so a chart keeps a stable x-axis across runs.
    expect(report.ageDistribution).toHaveLength(8)
    expect(report.ageDistribution.every((band) => band.count === 0)).toBe(true)
    expect(report.genderDistribution).toEqual([])
  })

  it('excludes soft-deleted patients from registrations', async () => {
    await service.getReport('org_1', range)

    const where = prisma.patient.findMany.mock.calls[0][0].where
    expect(where.deletedAt).toBeNull()
    expect(where.organizationId).toBe('org_1')
  })

  it('counts a patient seen through more than one module only once', async () => {
    // The same patient has an appointment, an encounter and an admission.
    prisma.appointment.findMany.mockResolvedValue([{ patientId: 'p1' }])
    prisma.encounter.findMany.mockResolvedValue([{ patientId: 'p1' }])
    prisma.admission.findMany.mockResolvedValue([{ patientId: 'p1' }])
    prisma.patient.findMany.mockImplementation((args: { where: { id?: unknown } }) =>
      args.where.id
        ? Promise.resolve([{ dateOfBirth: new Date(1990, 0, 1), gender: 'FEMALE' }])
        : Promise.resolve([]),
    )

    const report = await service.getReport('org_1', range)

    expect(report.activePatients).toBe(1)
  })

  it('splits new from returning by whether the patient registered inside the period', async () => {
    prisma.patient.findMany.mockImplementation((args: { where: { id?: unknown } }) => {
      // The cohort lookup passes an `id` filter; the registrations query does not.
      if (args.where.id) {
        return Promise.resolve([
          { dateOfBirth: new Date(1990, 0, 1), gender: 'FEMALE' },
          { dateOfBirth: new Date(1950, 0, 1), gender: 'MALE' },
        ])
      }
      return Promise.resolve([{ id: 'p_new', createdAt: new Date(2026, 6, 10) }])
    })
    prisma.encounter.findMany.mockResolvedValue([{ patientId: 'p_new' }, { patientId: 'p_old' }])

    const report = await service.getReport('org_1', range)

    expect(report.registrations).toBe(1)
    expect(report.activePatients).toBe(2)
    expect(report.newPatients).toBe(1)
    expect(report.returningPatients).toBe(1)
  })

  it('reports growth against the preceding window, and null when it was empty', async () => {
    prisma.patient.findMany.mockImplementation((args: { where: { id?: unknown } }) =>
      args.where.id ? Promise.resolve([]) : Promise.resolve([{ id: 'p1', createdAt: new Date(2026, 6, 10) }]),
    )

    const empty = await service.getReport('org_1', range)
    expect(empty.registrationsComparison).toEqual({ current: 1, previous: 0, changePercent: null })

    prisma.patient.count.mockResolvedValue(2)
    const grown = await service.getReport('org_1', range)
    expect(grown.registrationsComparison).toEqual({ current: 1, previous: 2, changePercent: -50 })
  })

  it('bands ages as at the end of the window so a historical report is reproducible', async () => {
    prisma.encounter.findMany.mockResolvedValue([{ patientId: 'p1' }])
    prisma.patient.findMany.mockImplementation((args: { where: { id?: unknown } }) =>
      args.where.id
        ? // Turns 31 on 2026-07-15, inside the window.
          Promise.resolve([{ dateOfBirth: new Date(1995, 6, 15), gender: 'MALE' }])
        : Promise.resolve([]),
    )

    const report = await service.getReport('org_1', range)

    const band = report.ageDistribution.find((b) => b.count > 0)
    expect(band?.label).toBe('31-45')
    expect(report.genderDistribution).toEqual([{ label: 'MALE', count: 1 }])
  })
})
