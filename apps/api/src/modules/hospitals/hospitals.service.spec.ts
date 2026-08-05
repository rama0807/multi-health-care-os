import { SystemRole } from '@medicore/types'
import { ConflictException } from '@nestjs/common'

import { StaffOnboardingService } from '../../common/onboarding/staff-onboarding.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

import { HospitalsService } from './hospitals.service'

const HOSPITAL = { id: 'hosp_1', name: 'Main', code: 'MAIN', city: 'Mumbai', isActive: true }

function buildService(options: { existingHospital?: unknown; onboardResult?: unknown } = {}) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) }
  const onboardingService = {
    onboardUserInTransaction: jest.fn().mockResolvedValue(
      options.onboardResult ?? {
        user: { id: 'user_1', email: 'admin@example.com', firstName: 'A', lastName: 'B' },
        created: true,
        temporaryPassword: 'temp',
      },
    ),
    sendOnboardingEmail: jest.fn().mockResolvedValue(undefined),
  }

  const createdDepartments: unknown[] = []
  const tx = {
    hospital: { create: jest.fn().mockResolvedValue(HOSPITAL) },
    department: {
      create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `dept_${createdDepartments.length + 1}`, ...data }
        createdDepartments.push(row)
        return row
      }),
    },
  }

  const prisma = {
    hospital: {
      findUnique: jest.fn().mockResolvedValue(options.existingHospital ?? null),
      findFirst: jest.fn().mockResolvedValue(options.existingHospital ?? HOSPITAL),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        ...HOSPITAL,
        ...data,
      })),
    },
    $transaction: jest.fn((fn: (client: unknown) => unknown) => fn(tx)),
  }

  // Milestone 18: hospital creation now announces `hospital.created` so the
  // notification platform can react. The emitter is captured rather than
  // ignored, so a test can assert the event if it ever needs to.
  const eventEmitter = { emit: jest.fn() }

  const service = new HospitalsService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
    onboardingService as unknown as StaffOnboardingService,
    eventEmitter as never,
  )

  return { service, prisma, tx, auditService, onboardingService, eventEmitter }
}

describe('HospitalsService.onboard', () => {
  it('creates the hospital and its departments in one transaction', async () => {
    const { service, tx } = buildService()

    const result = await service.onboard('org_1', {
      name: 'Main',
      code: 'MAIN',
      departments: [
        { name: 'General Medicine', code: 'GENMED' },
        { name: 'Cardiology', code: 'CARDIO' },
      ],
    })

    expect(tx.hospital.create).toHaveBeenCalledTimes(1)
    expect(tx.department.create).toHaveBeenCalledTimes(2)
    expect(result.departments).toHaveLength(2)
    expect(result.admin).toBeNull()
  })

  it('rejects a duplicate hospital code before touching the database', async () => {
    const { service, prisma } = buildService({ existingHospital: HOSPITAL })

    await expect(service.onboard('org_1', { name: 'Main', code: 'MAIN' })).rejects.toThrow(
      ConflictException,
    )
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects duplicate department codes inside one request', async () => {
    const { service, prisma } = buildService()

    await expect(
      service.onboard('org_1', {
        name: 'Main',
        code: 'MAIN',
        departments: [
          { name: 'A', code: 'DUP' },
          { name: 'B', code: 'DUP' },
        ],
      }),
    ).rejects.toThrow(ConflictException)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('provisions the admin via the shared onboarding service, scoped to the new hospital', async () => {
    const { service, onboardingService } = buildService()

    const result = await service.onboard('org_1', {
      name: 'Main',
      code: 'MAIN',
      admin: {
        email: 'admin@example.com',
        firstName: 'A',
        lastName: 'B',
        systemRole: SystemRole.ORG_ADMIN,
      },
    })

    expect(onboardingService.onboardUserInTransaction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: 'org_1',
        hospitalId: 'hosp_1',
        email: 'admin@example.com',
        systemRole: SystemRole.ORG_ADMIN,
      }),
    )
    expect(result.admin).toEqual({
      userId: 'user_1',
      email: 'admin@example.com',
      created: true,
    })
  })

  it('sends the welcome email only after the transaction commits', async () => {
    const { service, prisma, onboardingService } = buildService()
    const callOrder: string[] = []

    prisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => {
      const value = await fn({
        hospital: { create: jest.fn().mockResolvedValue(HOSPITAL) },
        department: { create: jest.fn() },
      })
      callOrder.push('transaction')
      return value
    })
    onboardingService.sendOnboardingEmail.mockImplementation(() => {
      callOrder.push('email')
      return Promise.resolve()
    })

    await service.onboard('org_1', {
      name: 'Main',
      code: 'MAIN',
      admin: {
        email: 'admin@example.com',
        firstName: 'A',
        lastName: 'B',
        systemRole: SystemRole.ORG_ADMIN,
      },
    })

    expect(callOrder).toEqual(['transaction', 'email'])
  })
})

describe('HospitalsService activation', () => {
  it('activates an inactive hospital and audits it', async () => {
    const { service, auditService } = buildService({
      existingHospital: { ...HOSPITAL, isActive: false },
    })

    await service.activate('org_1', 'hosp_1', 'actor_1')

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'hospital.activated', resourceId: 'hosp_1' }),
    )
  })

  it('is a no-op when the hospital is already in the requested state', async () => {
    const { service, prisma, auditService } = buildService({ existingHospital: HOSPITAL })

    await service.activate('org_1', 'hosp_1', 'actor_1')

    expect(prisma.hospital.update).not.toHaveBeenCalled()
    expect(auditService.record).not.toHaveBeenCalled()
  })

  it('deactivates an active hospital and audits it', async () => {
    const { service, auditService } = buildService({ existingHospital: HOSPITAL })

    await service.deactivate('org_1', 'hosp_1', 'actor_1')

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'hospital.deactivated' }),
    )
  })
})
