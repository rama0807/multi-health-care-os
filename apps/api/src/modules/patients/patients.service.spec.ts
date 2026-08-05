import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { PatientsService } from './patients.service'

function buildPatient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'patient_1',
    uhid: 'MED-2026-000001',
    firstName: 'Asha',
    lastName: 'Rao',
    email: null,
    phone: '9876543210',
    dateOfBirth: new Date('1990-05-15'),
    gender: 'FEMALE',
    bloodGroup: null,
    address: null,
    city: null,
    state: null,
    country: 'IN',
    pincode: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    organizationId: 'org_1',
    metadata: {},
    isActive: true,
    deletedAt: null,
    headOfFamilyId: null,
    mergedIntoId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

const PATIENT_LINKED_MODEL_KEYS = [
  'patientDocument',
  'appointment',
  'encounter',
  'prescription',
  'labTest',
  'radiologyOrder',
  'admission',
  'invoice',
  'payment',
  'insuranceClaim',
  'patientInsurance',
  'preAuthorization',
  'charge',
  'dispenseOrder',
  'notification',
  'aiConversation',
] as const

function buildMergeTx() {
  const tx: Record<string, Record<string, jest.Mock>> = {
    patient: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn().mockResolvedValue(buildPatient({ id: 'patient_source', mergedIntoId: 'patient_target' })),
    },
  }
  for (const key of PATIENT_LINKED_MODEL_KEYS) {
    tx[key] = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }
  }
  return tx
}

describe('PatientsService', () => {
  let prisma: {
    patient: Record<string, jest.Mock>
    patientDocument: Record<string, jest.Mock>
    appointment: Record<string, jest.Mock>
    admission: Record<string, jest.Mock>
    labTest: Record<string, jest.Mock>
    radiologyOrder: Record<string, jest.Mock>
    prescription: Record<string, jest.Mock>
    invoice: Record<string, jest.Mock>
    insuranceClaim: Record<string, jest.Mock>
    encounter: Record<string, jest.Mock>
    auditLog: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let storageService: { upload: jest.Mock; delete: jest.Mock }
  let organizationsService: { getCurrent: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let configService: { get: jest.Mock }
  let service: PatientsService

  beforeEach(() => {
    const txPatient = { count: jest.fn().mockResolvedValue(0), create: jest.fn() }

    prisma = {
      patient: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      patientDocument: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
      appointment: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      admission: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      labTest: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      radiologyOrder: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      prescription: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      invoice: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      insuranceClaim: { count: jest.fn().mockResolvedValue(0) },
      encounter: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) =>
        cb({ $executeRaw: jest.fn().mockResolvedValue(undefined), patient: txPatient }),
      ),
    }
    // Exposed so individual tests can tweak the count seen inside the transaction.
    ;(prisma as unknown as { __txPatient: typeof txPatient }).__txPatient = txPatient

    storageService = {
      upload: jest.fn().mockResolvedValue('http://localhost:4000/uploads/patients/org_1/patient_1/file.pdf'),
      delete: jest.fn().mockResolvedValue(undefined),
    }
    organizationsService = {
      getCurrent: jest.fn().mockResolvedValue({ settings: { uhidPrefix: 'MED' } }),
    }
    eventEmitter = { emit: jest.fn() }
    configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === 'storage.provider') return 'local'
        if (key === 'storage.local.publicUrl') return 'http://localhost:4000/uploads'
        return fallback
      }),
    }

    service = new PatientsService(
      prisma as never,
      storageService as never,
      organizationsService as never,
      eventEmitter as never,
      configService as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  const createDto = {
    firstName: 'Asha',
    lastName: 'Rao',
    phone: '9876543210',
    dateOfBirth: '1990-05-15',
    gender: 'FEMALE',
  }

  describe('create', () => {
    it('generates a UHID scoped to the current year and creates the patient', async () => {
      prisma.patient.findUnique.mockResolvedValue(null)
      const txPatient = (prisma as unknown as { __txPatient: { create: jest.Mock } }).__txPatient
      txPatient.create.mockResolvedValue(buildPatient())

      const result = await service.create('org_1', createDto as never, 'user_1')

      const expectedYear = new Date().getFullYear()
      expect(txPatient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ uhid: `MED-${expectedYear}-000001`, organizationId: 'org_1' }),
        }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.registered',
        expect.objectContaining({ patientId: 'patient_1', organizationId: 'org_1', userId: 'user_1' }),
      )
      expect(result.fullName).toBe('Asha Rao')
    })

    it('rejects a duplicate phone number for an active patient', async () => {
      prisma.patient.findUnique.mockResolvedValue(buildPatient({ deletedAt: null }))

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(ConflictException)
      await expect(service.create('org_1', createDto as never)).rejects.toThrow(/already exists/)
    })

    it('points to restoration when the conflicting patient is soft-deleted', async () => {
      prisma.patient.findUnique.mockResolvedValue(buildPatient({ deletedAt: new Date() }))

      await expect(service.create('org_1', createDto as never)).rejects.toThrow(/restore/)
    })
  })

  describe('update', () => {
    it('rejects when the new phone number belongs to a different patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())
      prisma.patient.findUnique.mockResolvedValue(buildPatient({ id: 'other_patient' }))

      await expect(
        service.update('org_1', 'patient_1', { phone: '9123456780' } as never),
      ).rejects.toThrow(ConflictException)
    })

    it('updates and emits patient.updated', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())
      prisma.patient.update.mockResolvedValue(buildPatient({ city: 'Pune' }))

      const result = await service.update('org_1', 'patient_1', { city: 'Pune' } as never, 'user_1')

      expect(result.city).toBe('Pune')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.updated',
        expect.objectContaining({ patientId: 'patient_1', userId: 'user_1' }),
      )
    })
  })

  describe('softDelete / restore', () => {
    it('soft-deletes an active patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())
      prisma.patient.update.mockResolvedValue(buildPatient({ deletedAt: new Date(), isActive: false }))

      await service.softDelete('org_1', 'patient_1', 'user_1')

      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith('patient.deleted', expect.any(Object))
    })

    it('throws when restoring a patient that is not soft-deleted', async () => {
      prisma.patient.findFirst.mockResolvedValue(null)

      await expect(service.restore('org_1', 'patient_1')).rejects.toThrow(NotFoundException)
    })

    it('restores a soft-deleted patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient({ deletedAt: new Date(), isActive: false }))
      prisma.patient.update.mockResolvedValue(buildPatient({ deletedAt: null, isActive: true }))

      const result = await service.restore('org_1', 'patient_1', 'user_1')

      expect(result.isActive).toBe(true)
      expect(eventEmitter.emit).toHaveBeenCalledWith('patient.restored', expect.any(Object))
    })
  })

  describe('checkDuplicates', () => {
    it('returns no matches when nothing overlaps', async () => {
      prisma.patient.findMany.mockResolvedValue([])

      const matches = await service.checkDuplicates('org_1', { phone: '9000000000' } as never)

      expect(matches).toEqual([])
    })

    it('scores a phone-only match lower than a phone+dob+name match', async () => {
      const candidate = buildPatient()
      prisma.patient.findMany.mockResolvedValue([candidate])

      const phoneOnly = await service.checkDuplicates('org_1', { phone: candidate.phone } as never)
      const fullMatch = await service.checkDuplicates('org_1', {
        phone: candidate.phone,
        dateOfBirth: '1990-05-15',
        firstName: candidate.firstName,
        lastName: candidate.lastName,
      } as never)

      expect(phoneOnly[0].confidence).toBeGreaterThan(0)
      expect(fullMatch[0].confidence).toBeGreaterThan(phoneOnly[0].confidence)
      expect(fullMatch[0].matchedFields).toEqual(
        expect.arrayContaining(['phone', 'dateOfBirth', 'firstName', 'lastName']),
      )
    })

    it('returns no query at all when no identifying fields are provided', async () => {
      const matches = await service.checkDuplicates('org_1', {} as never)
      expect(matches).toEqual([])
      expect(prisma.patient.findMany).not.toHaveBeenCalled()
    })
  })

  describe('countRegisteredToday', () => {
    it('counts patients created since local midnight', async () => {
      prisma.patient.count.mockResolvedValue(3)

      const count = await service.countRegisteredToday('org_1')

      expect(count).toBe(3)
      expect(prisma.patient.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org_1' }),
        }),
      )
    })
  })

  describe('listRecentDuplicateAlerts', () => {
    it('deduplicates symmetric pairs and excludes self-matches', async () => {
      const a = buildPatient({ id: 'patient_a', phone: '9000000001' })
      const b = buildPatient({ id: 'patient_b', phone: '9000000001' })

      // The bounded scan over recent registrations...
      prisma.patient.findMany.mockResolvedValueOnce([a, b])
      // ...then checkDuplicates() re-queries per candidate (phone collision both ways).
      prisma.patient.findMany.mockResolvedValueOnce([b])
      prisma.patient.findMany.mockResolvedValueOnce([a])

      const alerts = await service.listRecentDuplicateAlerts('org_1')

      expect(alerts).toHaveLength(1)
      expect(alerts[0].confidence).toBeGreaterThanOrEqual(50)
    })

    it('returns no alerts when there are no recent registrations', async () => {
      prisma.patient.findMany.mockResolvedValue([])

      const alerts = await service.listRecentDuplicateAlerts('org_1')

      expect(alerts).toEqual([])
    })
  })

  describe('list', () => {
    it('paginates results', async () => {
      prisma.patient.findMany.mockResolvedValue([buildPatient()])
      prisma.patient.count.mockResolvedValue(1)

      const result = await service.list('org_1', { page: 1, limit: 20 })

      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('document uploads', () => {
    const file = { buffer: Buffer.from('test'), fileName: 'id.pdf', mimeType: 'application/pdf', size: 1024 }

    it('rejects unsupported mime types', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())

      await expect(
        service.uploadDocument('org_1', 'patient_1', 'AADHAAR' as never, {
          ...file,
          mimeType: 'application/zip',
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('rejects files over the size limit', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())

      await expect(
        service.uploadDocument('org_1', 'patient_1', 'AADHAAR' as never, {
          ...file,
          size: 20 * 1024 * 1024,
        }),
      ).rejects.toThrow(BadRequestException)
    })

    it('uploads via StorageService and persists the document record', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())
      prisma.patientDocument.create.mockResolvedValue({ id: 'doc_1' })

      const result = await service.uploadDocument('org_1', 'patient_1', 'AADHAAR' as never, file, 'user_1')

      expect(storageService.upload).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: 'application/pdf' }),
      )
      expect(result).toEqual({ id: 'doc_1' })
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.document_uploaded',
        expect.objectContaining({ documentId: 'doc_1' }),
      )
    })

    it('deletes the underlying storage object and the document record', async () => {
      prisma.patientDocument.findFirst.mockResolvedValue({
        id: 'doc_1',
        fileUrl: 'http://localhost:4000/uploads/patients/org_1/patient_1/file.pdf',
      })

      await service.deleteDocument('org_1', 'patient_1', 'doc_1')

      expect(storageService.delete).toHaveBeenCalledWith('patients/org_1/patient_1/file.pdf')
      expect(prisma.patientDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc_1' } })
    })
  })

  describe('getTimeline', () => {
    it('includes a registration entry and sorts all sources by date descending', async () => {
      const registeredAt = new Date('2026-01-01')
      prisma.patient.findFirst.mockResolvedValue(buildPatient({ createdAt: registeredAt }))
      prisma.appointment.findMany.mockResolvedValue([
        {
          id: 'appt_1',
          type: 'OPD',
          status: 'COMPLETED',
          chiefComplaint: 'Fever',
          scheduledAt: new Date('2026-03-01'),
          appointmentNumber: 'APT-1',
        },
      ])
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv_1',
          invoiceNumber: 'INV-1',
          status: 'PAID',
          totalAmount: { toString: () => '500.00' },
          createdAt: new Date('2026-02-01'),
        },
      ])

      const entries = await service.getTimeline('org_1', 'patient_1')

      expect(entries.map((e) => e.type)).toEqual(['APPOINTMENT', 'INVOICE', 'REGISTRATION'])
    })

    it('throws NotFoundException for an unknown patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(null)

      await expect(service.getTimeline('org_1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })

  describe('restore', () => {
    it('refuses to restore a merged patient', async () => {
      prisma.patient.findFirst.mockResolvedValue(
        buildPatient({ deletedAt: new Date(), isActive: false, mergedIntoId: 'patient_target' }),
      )

      await expect(service.restore('org_1', 'patient_1')).rejects.toThrow(BadRequestException)
    })
  })

  describe('family linkage', () => {
    it('rejects linking a patient to themselves', async () => {
      await expect(service.linkFamilyMember('org_1', 'patient_1', 'patient_1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('rejects linking to a head that is itself a dependent', async () => {
      prisma.patient.findFirst
        .mockResolvedValueOnce(buildPatient({ id: 'patient_1' }))
        .mockResolvedValueOnce(buildPatient({ id: 'patient_head', headOfFamilyId: 'someone_else' }))

      await expect(service.linkFamilyMember('org_1', 'patient_1', 'patient_head')).rejects.toThrow(
        /already a member of another family/,
      )
    })

    it('rejects linking a patient who is already head of a family', async () => {
      prisma.patient.findFirst
        .mockResolvedValueOnce(buildPatient({ id: 'patient_1' }))
        .mockResolvedValueOnce(buildPatient({ id: 'patient_head' }))
      prisma.patient.count.mockResolvedValue(2)

      await expect(service.linkFamilyMember('org_1', 'patient_1', 'patient_head')).rejects.toThrow(
        /already head of a family/,
      )
    })

    it('links a patient under a head of family and emits an event', async () => {
      prisma.patient.findFirst
        .mockResolvedValueOnce(buildPatient({ id: 'patient_1' }))
        .mockResolvedValueOnce(buildPatient({ id: 'patient_head' }))
      prisma.patient.count.mockResolvedValue(0)
      prisma.patient.update.mockResolvedValue(buildPatient({ id: 'patient_1', headOfFamilyId: 'patient_head' }))

      const result = await service.linkFamilyMember('org_1', 'patient_1', 'patient_head', 'user_1')

      expect(result.headOfFamilyId).toBe('patient_head')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.family_linked',
        expect.objectContaining({ patientId: 'patient_1', metadata: { headOfFamilyId: 'patient_head' } }),
      )
    })

    it('rejects unlinking a patient with no head of family set', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient())

      await expect(service.unlinkFamilyMember('org_1', 'patient_1')).rejects.toThrow(BadRequestException)
    })

    it('unlinks a patient and emits an event', async () => {
      prisma.patient.findFirst.mockResolvedValue(buildPatient({ headOfFamilyId: 'patient_head' }))
      prisma.patient.update.mockResolvedValue(buildPatient({ headOfFamilyId: null }))

      const result = await service.unlinkFamilyMember('org_1', 'patient_1', 'user_1')

      expect(result.headOfFamilyId).toBeNull()
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.family_unlinked',
        expect.objectContaining({ metadata: { previousHeadOfFamilyId: 'patient_head' } }),
      )
    })

    it('resolves the family group from a member', async () => {
      prisma.patient.findFirst
        .mockResolvedValueOnce(buildPatient({ id: 'patient_1', headOfFamilyId: 'patient_head' }))
        .mockResolvedValueOnce(buildPatient({ id: 'patient_head' }))
      prisma.patient.findMany.mockResolvedValue([buildPatient({ id: 'patient_1', headOfFamilyId: 'patient_head' })])

      const group = await service.listFamilyMembers('org_1', 'patient_1')

      expect(group.headOfFamily.id).toBe('patient_head')
      expect(group.members).toHaveLength(1)
    })

    it('resolves the family group from the head itself', async () => {
      prisma.patient.findFirst.mockResolvedValueOnce(buildPatient({ id: 'patient_head' }))
      prisma.patient.findMany.mockResolvedValue([])

      const group = await service.listFamilyMembers('org_1', 'patient_head')

      expect(group.headOfFamily.id).toBe('patient_head')
      expect(group.members).toEqual([])
    })
  })

  describe('mergePatients', () => {
    it('rejects merging a patient into themselves', async () => {
      await expect(service.mergePatients('org_1', 'patient_1', 'patient_1')).rejects.toThrow(
        BadRequestException,
      )
    })

    it('reassigns every linked model and soft-deletes the source patient', async () => {
      prisma.patient.findFirst
        .mockResolvedValueOnce(buildPatient({ id: 'patient_source' }))
        .mockResolvedValueOnce(buildPatient({ id: 'patient_target' }))

      const tx = buildMergeTx()
      prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(tx))

      const result = await service.mergePatients('org_1', 'patient_source', 'patient_target', 'user_1')

      expect(result.survivorPatientId).toBe('patient_target')
      expect(result.mergedPatientId).toBe('patient_source')
      expect(result.reassignedCounts.appointment).toBe(1)
      expect(result.reassignedCounts.familyMembers).toBe(0)
      expect(tx.appointment.updateMany).toHaveBeenCalledWith({
        where: { patientId: 'patient_source' },
        data: { patientId: 'patient_target' },
      })
      expect(tx.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient_source' },
          data: expect.objectContaining({ mergedIntoId: 'patient_target', isActive: false }),
        }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.merged',
        expect.objectContaining({ patientId: 'patient_source' }),
      )
    })
  })

  describe('importFromCsv', () => {
    it('rejects an empty file', async () => {
      await expect(service.importFromCsv('org_1', Buffer.from(''))).rejects.toThrow(BadRequestException)
    })

    it('rejects a header-only file with no data rows', async () => {
      await expect(
        service.importFromCsv('org_1', Buffer.from('firstName,lastName,phone,dateOfBirth,gender\n')),
      ).rejects.toThrow(/no data rows/)
    })

    it('creates valid rows and records validation/conflict failures per row', async () => {
      const csv = [
        'firstName,lastName,phone,dateOfBirth,gender',
        'Asha,Rao,9876543210,1990-05-15,FEMALE',
        'Bad,Row,123,not-a-date,FEMALE',
        'Vikram,Nair,9900112233,1988-11-20,MALE',
      ].join('\n')

      prisma.patient.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(buildPatient({ phone: '9900112233' }))
      const txPatient = (prisma as unknown as { __txPatient: { create: jest.Mock } }).__txPatient
      txPatient.create.mockResolvedValue(buildPatient({ id: 'patient_new', uhid: 'MED-2026-000002' }))

      const result = await service.importFromCsv('org_1', Buffer.from(csv), 'user_1')

      expect(result.total).toBe(3)
      expect(result.created).toBe(1)
      expect(result.failed).toBe(2)
      expect(result.results[0]).toEqual(
        expect.objectContaining({ row: 2, success: true, patientId: 'patient_new' }),
      )
      expect(result.results[1]).toEqual(expect.objectContaining({ row: 3, success: false }))
      expect(result.results[2]).toEqual(
        expect.objectContaining({ row: 4, success: false, error: expect.stringMatching(/already exists/) }),
      )
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'patient.import_completed',
        expect.objectContaining({ total: 3, created: 1, failed: 2 }),
      )
    })

    it('rejects a file over the row cap', async () => {
      const rows = Array.from({ length: 501 }, (_, i) => `First${i},Last,9876543${String(i).padStart(3, '0')},1990-05-15,FEMALE`)
      const csv = ['firstName,lastName,phone,dateOfBirth,gender', ...rows].join('\n')

      await expect(service.importFromCsv('org_1', Buffer.from(csv))).rejects.toThrow(/limited to 500 rows/)
    })
  })
})
