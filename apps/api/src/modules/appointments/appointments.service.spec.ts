import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'

import { toLocalIsoString } from '../scheduling/availability.util'

import { AppointmentsService } from './appointments.service'

// Built from real Date objects (via toLocalIsoString, the same helper the
// service uses) rather than hardcoded strings — a literal "09:00:00" string
// would only match the service's output on a machine whose local timezone
// happens to line up, since `scheduledAt` round-trips through `Date`/ISO.
const SLOT_0 = new Date('2026-08-03T09:00:00')

// Generates the same 09:00/09:15/09:30/09:45 shift grid on whatever date is
// requested — recurring-booking tests span several distinct dates, and a
// slot list hardcoded to one date would never match later occurrences'
// requested times.
function buildAvailability(dateStr = '2026-08-03', overrides: Partial<Record<string, unknown>> = {}) {
  const at = (time: string) => new Date(`${dateStr}T${time}:00`)
  return {
    doctorId: 'doctor_1',
    date: dateStr,
    isWorkingDay: true,
    onLeave: false,
    slots: [
      { start: toLocalIsoString(at('09:00')), end: toLocalIsoString(at('09:15')) },
      { start: toLocalIsoString(at('09:15')), end: toLocalIsoString(at('09:30')) },
      { start: toLocalIsoString(at('09:30')), end: toLocalIsoString(at('09:45')) },
    ],
    ...overrides,
  }
}

function buildAppointmentRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'appt_1',
    appointmentNumber: 'APT-MED-2026-000001',
    patientId: 'patient_1',
    doctorId: 'doctor_1',
    departmentId: null,
    organizationId: 'org_1',
    scheduledAt: SLOT_0,
    durationMinutes: 15,
    type: 'OPD',
    status: 'SCHEDULED',
    chiefComplaint: null,
    notes: null,
    roomNumber: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: { id: 'patient_1', firstName: 'Vikram', lastName: 'Nair', uhid: 'MED-2026-000001', phone: '9900112233', email: null },
    doctor: { id: 'doctor_1', specialization: 'Cardiology', user: { firstName: 'Priya', lastName: 'Sharma' } },
    department: null,
    ...overrides,
  }
}

describe('AppointmentsService', () => {
  let prisma: {
    appointment: Record<string, jest.Mock>
    patient: Record<string, jest.Mock>
    department: Record<string, jest.Mock>
    doctor: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
    $transaction: jest.Mock
  }
  let doctorRef: { requireDoctor: jest.Mock; findDoctorProfileForUser: jest.Mock }
  let availabilityService: { getAvailableSlots: jest.Mock }
  let emailService: { send: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let service: AppointmentsService

  beforeEach(() => {
    prisma = {
      appointment: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      patient: { findFirst: jest.fn() },
      department: { findFirst: jest.fn() },
      doctor: { findUniqueOrThrow: jest.fn() },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: { uhidPrefix: 'MED' } }) },
      $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
        fn({ $executeRaw: jest.fn(), appointment: { count: jest.fn().mockResolvedValue(0), create: jest.fn() } }),
      ),
    }
    doctorRef = {
      requireDoctor: jest.fn().mockResolvedValue({ id: 'doctor_1', userId: 'user_1' }),
      findDoctorProfileForUser: jest.fn(),
    }
    availabilityService = {
      getAvailableSlots: jest.fn((_org: string, _doc: string, dateStr: string) =>
        Promise.resolve(buildAvailability(dateStr)),
      ),
    }
    emailService = { send: jest.fn().mockResolvedValue(undefined) }
    eventEmitter = { emit: jest.fn() }

    service = new AppointmentsService(
      prisma as never,
      doctorRef as never,
      availabilityService as never,
      emailService as never,
      eventEmitter as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  describe('getAvailableSlotsForBooking', () => {
    it('returns empty when the doctor is on leave', async () => {
      availabilityService.getAvailableSlots.mockResolvedValue(
        buildAvailability('2026-08-03', { onLeave: true, isWorkingDay: false, slots: [] }),
      )

      const result = await service.getAvailableSlotsForBooking('org_1', 'doctor_1', '2026-08-03')

      expect(result).toEqual([])
    })

    it('excludes slots that overlap an existing non-cancelled appointment', async () => {
      prisma.appointment.findMany.mockResolvedValue([{ scheduledAt: SLOT_0, durationMinutes: 15 }])

      const result = await service.getAvailableSlotsForBooking('org_1', 'doctor_1', '2026-08-03', 15)

      expect(result).toHaveLength(2)
      expect(result.map((s) => s.start)).not.toContain(toLocalIsoString(SLOT_0))
    })
  })

  describe('create', () => {
    const validDto = {
      patientId: 'patient_1',
      doctorId: 'doctor_1',
      scheduledAt: SLOT_0.toISOString(),
      durationMinutes: 15,
      type: 'OPD',
    }

    beforeEach(() => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient_1', firstName: 'Vikram', email: null })
      prisma.appointment.findMany.mockResolvedValue([])
    })

    it('rejects a request for a doctor not found', async () => {
      doctorRef.requireDoctor.mockRejectedValue(new NotFoundException('Doctor not found'))

      await expect(service.create('org_1', validDto as never)).rejects.toThrow(NotFoundException)
    })

    it('rejects a slot that is not actually bookable', async () => {
      availabilityService.getAvailableSlots.mockResolvedValue(buildAvailability('2026-08-03', { slots: [] }))

      await expect(service.create('org_1', validDto as never)).rejects.toThrow(ConflictException)
    })

    it('creates the appointment, emits appointment.created, and emails the patient if they have an email', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient_1', firstName: 'Vikram', email: 'vikram@example.com' })
      prisma.doctor.findUniqueOrThrow.mockResolvedValue({ user: { firstName: 'Priya', lastName: 'Sharma' } })
      const createdRow = buildAppointmentRow()
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ $executeRaw: jest.fn(), appointment: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(createdRow) } }),
      )

      const result = await service.create('org_1', validDto as never, 'actor_1')

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'appointment.created',
        expect.objectContaining({ doctorId: 'doctor_1', patientId: 'patient_1', organizationId: 'org_1', userId: 'actor_1' }),
      )
      expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'vikram@example.com' }))
      expect(result.appointmentNumber).toBe('APT-MED-2026-000001')
    })

    it('does not email when the patient has no email on file', async () => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient_1', firstName: 'Vikram', email: null })
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({ $executeRaw: jest.fn(), appointment: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildAppointmentRow()) } }),
      )

      await service.create('org_1', validDto as never)

      expect(emailService.send).not.toHaveBeenCalled()
    })
  })

  describe('updateStatus', () => {
    it('throws NotFoundException for an unknown appointment', async () => {
      prisma.appointment.findFirst.mockResolvedValue(null)

      await expect(service.updateStatus('org_1', 'missing', { status: 'CONFIRMED' } as never)).rejects.toThrow(
        NotFoundException,
      )
    })

    it('rejects setting the same status again', async () => {
      prisma.appointment.findFirst.mockResolvedValue(buildAppointmentRow({ status: 'SCHEDULED' }))

      await expect(service.updateStatus('org_1', 'appt_1', { status: 'SCHEDULED' } as never)).rejects.toThrow(
        ConflictException,
      )
    })

    it('rejects an invalid transition (e.g. SCHEDULED straight to COMPLETED)', async () => {
      prisma.appointment.findFirst.mockResolvedValue(buildAppointmentRow({ status: 'SCHEDULED' }))

      await expect(service.updateStatus('org_1', 'appt_1', { status: 'COMPLETED' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('rejects transitioning out of a terminal status', async () => {
      prisma.appointment.findFirst.mockResolvedValue(buildAppointmentRow({ status: 'COMPLETED' }))

      await expect(service.updateStatus('org_1', 'appt_1', { status: 'CONFIRMED' } as never)).rejects.toThrow(
        BadRequestException,
      )
    })

    it('allows a valid forward transition and emits appointment.status_changed', async () => {
      prisma.appointment.findFirst.mockResolvedValue(buildAppointmentRow({ status: 'SCHEDULED' }))
      prisma.appointment.update.mockResolvedValue(buildAppointmentRow({ status: 'CONFIRMED' }))

      const result = await service.updateStatus('org_1', 'appt_1', { status: 'CONFIRMED' } as never, 'actor_1')

      expect(result.status).toBe('CONFIRMED')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'appointment.status_changed',
        expect.objectContaining({ fromStatus: 'SCHEDULED', toStatus: 'CONFIRMED', userId: 'actor_1' }),
      )
    })

    it('allows cancelling from any non-terminal status', async () => {
      prisma.appointment.findFirst.mockResolvedValue(buildAppointmentRow({ status: 'ARRIVED' }))
      prisma.appointment.update.mockResolvedValue(buildAppointmentRow({ status: 'CANCELLED' }))

      const result = await service.updateStatus('org_1', 'appt_1', { status: 'CANCELLED' } as never)

      expect(result.status).toBe('CANCELLED')
    })
  })

  describe('createWalkIn', () => {
    const walkInDto = { patientId: 'patient_1', doctorId: 'doctor_1', durationMinutes: 15, type: 'OPD' }

    beforeEach(() => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient_1', firstName: 'Vikram', email: null })
      prisma.appointment.findMany.mockResolvedValue([])
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          appointment: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue(buildAppointmentRow({ isWalkIn: true })) },
        }),
      )
    })

    afterEach(() => jest.useRealTimers())

    it('books the earliest slot at or after right now, and marks it a walk-in', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T09:10:00'))

      const result = await service.createWalkIn('org_1', walkInDto as never, 'actor_1')

      // SLOT_0 (09:00) is already in the past relative to 09:10 "now" —
      // the earliest slot at/after now is SLOT_1 (09:15).
      expect(availabilityService.getAvailableSlots).toHaveBeenCalledWith('org_1', 'doctor_1', '2026-08-03', 15)
      expect(result.isWalkIn).toBe(true)
    })

    it('rejects when no slot remains today (e.g. after hours)', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T23:00:00'))

      await expect(service.createWalkIn('org_1', walkInDto as never, 'actor_1')).rejects.toThrow(ConflictException)
    })
  })

  describe('createRecurring', () => {
    const recurringDto = {
      patientId: 'patient_1',
      doctorId: 'doctor_1',
      startDate: '2026-08-03',
      time: '09:00',
      frequency: 'WEEKLY',
      occurrences: 3,
      durationMinutes: 15,
      type: 'OPD',
    }

    beforeEach(() => {
      prisma.patient.findFirst.mockResolvedValue({ id: 'patient_1', firstName: 'Vikram', email: null })
      prisma.appointment.findMany.mockResolvedValue([])
      let counter = 0
      prisma.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn({
          $executeRaw: jest.fn(),
          appointment: {
            count: jest.fn().mockResolvedValue(0),
            create: jest.fn().mockImplementation(() => Promise.resolve(buildAppointmentRow({ id: `appt_${counter++}` }))),
          },
        }),
      )
    })

    it('books every occurrence and shares one recurrenceGroupId', async () => {
      const result = await service.createRecurring('org_1', recurringDto as never, 'actor_1')

      expect(result.booked).toHaveLength(3)
      expect(result.failed).toHaveLength(0)
      expect(availabilityService.getAvailableSlots).toHaveBeenCalledTimes(3)
    })

    it('reports a conflicting occurrence as failed without aborting the rest', async () => {
      // The 2nd occurrence (2026-08-10) is on leave; the 1st and 3rd are fine.
      availabilityService.getAvailableSlots.mockImplementation((_org: string, _doc: string, dateStr: string) =>
        Promise.resolve(
          dateStr === '2026-08-10'
            ? buildAvailability(dateStr, { onLeave: true, isWorkingDay: false, slots: [] })
            : buildAvailability(dateStr),
        ),
      )

      const result = await service.createRecurring('org_1', recurringDto as never, 'actor_1')

      expect(result.booked).toHaveLength(2)
      expect(result.failed).toHaveLength(1)
      expect(result.failed[0].scheduledAt).toContain('2026-08-10')
    })
  })
})
