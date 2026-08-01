import { AuditService } from './audit.service'

describe('AuditService.listForDoctor', () => {
  let prisma: { auditLog: { findMany: jest.Mock } }
  let service: AuditService

  beforeEach(() => {
    prisma = { auditLog: { findMany: jest.fn() } }
    service = new AuditService(prisma as never)
  })

  it('queries for direct Doctor events and doctorId-tagged schedule/leave/document events', async () => {
    prisma.auditLog.findMany.mockResolvedValue([])

    await service.listForDoctor('org_1', 'doctor_1')

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          organizationId: 'org_1',
          OR: [
            { resource: 'Doctor', resourceId: 'doctor_1' },
            {
              resource: { in: ['DoctorSchedule', 'DoctorLeave', 'DoctorDocument', 'Appointment', 'Encounter', 'Prescription'] },
              after: { path: ['doctorId'], equals: 'doctor_1' },
            },
          ],
        },
      }),
    )
  })

  it('maps raw audit rows to timeline entries with a humanized title', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log_1',
        action: 'doctor.document_uploaded',
        resource: 'DoctorDocument',
        createdAt: new Date('2026-08-01'),
      },
    ])

    const result = await service.listForDoctor('org_1', 'doctor_1')

    expect(result).toEqual([
      {
        id: 'log_1',
        title: 'doctor document uploaded',
        action: 'doctor.document_uploaded',
        resource: 'DoctorDocument',
        occurredAt: new Date('2026-08-01'),
      },
    ])
  })

  it('caps the limit at 100', async () => {
    prisma.auditLog.findMany.mockResolvedValue([])

    await service.listForDoctor('org_1', 'doctor_1', 500)

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
  })
})
