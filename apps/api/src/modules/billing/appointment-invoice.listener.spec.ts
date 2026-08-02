import { AppointmentInvoiceListener } from './appointment-invoice.listener'

describe('AppointmentInvoiceListener', () => {
  let prisma: {
    invoice: Record<string, jest.Mock>
    appointment: Record<string, jest.Mock>
    doctor: Record<string, jest.Mock>
    encounter: Record<string, jest.Mock>
    organization: Record<string, jest.Mock>
  }
  let chargesService: { create: jest.Mock }
  let invoicesService: { create: jest.Mock }
  let listener: AppointmentInvoiceListener

  beforeEach(() => {
    prisma = {
      invoice: { findUnique: jest.fn() },
      appointment: { findUnique: jest.fn() },
      doctor: { findUnique: jest.fn() },
      encounter: { findUnique: jest.fn() },
      organization: { findUniqueOrThrow: jest.fn().mockResolvedValue({ settings: { gstRate: 18 } }) },
    }
    chargesService = { create: jest.fn().mockResolvedValue({ id: 'chg_1' }) }
    invoicesService = { create: jest.fn().mockResolvedValue({ id: 'inv_1' }) }
    listener = new AppointmentInvoiceListener(prisma as never, chargesService as never, invoicesService as never)
  })

  afterEach(() => jest.clearAllMocks())

  it('ignores status changes that are not COMPLETED', async () => {
    await listener.onAppointmentStatusChanged({
      appointmentId: 'apt_1',
      doctorId: 'doc_1',
      patientId: 'pat_1',
      organizationId: 'org_1',
      toStatus: 'ARRIVED',
    })
    expect(chargesService.create).not.toHaveBeenCalled()
  })

  it('creates a consultation charge and a draft invoice on completion', async () => {
    prisma.invoice.findUnique.mockResolvedValue(null)
    prisma.appointment.findUnique.mockResolvedValue({ id: 'apt_1', type: 'OPD' })
    prisma.doctor.findUnique.mockResolvedValue({
      id: 'doc_1',
      consultationFee: { toString: () => '800', valueOf: () => 800 },
      user: { firstName: 'Priya', lastName: 'Sharma' },
    })
    prisma.encounter.findUnique.mockResolvedValue(null)

    await listener.onAppointmentStatusChanged({
      appointmentId: 'apt_1',
      doctorId: 'doc_1',
      patientId: 'pat_1',
      organizationId: 'org_1',
      toStatus: 'COMPLETED',
    })

    expect(chargesService.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ unitPrice: 800, taxPercent: 18 }),
      undefined,
    )
    expect(invoicesService.create).toHaveBeenCalledWith(
      'org_1',
      expect.objectContaining({ chargeIds: ['chg_1'] }),
      undefined,
    )
  })

  it('skips if an invoice already exists for this appointment', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'existing' })

    await listener.onAppointmentStatusChanged({
      appointmentId: 'apt_1',
      doctorId: 'doc_1',
      patientId: 'pat_1',
      organizationId: 'org_1',
      toStatus: 'COMPLETED',
    })

    expect(chargesService.create).not.toHaveBeenCalled()
  })

  it('swallows errors so an invoicing failure never breaks the appointment flow', async () => {
    prisma.invoice.findUnique.mockRejectedValue(new Error('db down'))

    await expect(
      listener.onAppointmentStatusChanged({
        appointmentId: 'apt_1',
        doctorId: 'doc_1',
        patientId: 'pat_1',
        organizationId: 'org_1',
        toStatus: 'COMPLETED',
      }),
    ).resolves.toBeUndefined()
  })
})
