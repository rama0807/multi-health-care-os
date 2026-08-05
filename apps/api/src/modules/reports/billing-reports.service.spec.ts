import { BillingReportsService } from './billing-reports.service'

const decimal = (value: string) => ({ toString: () => value, valueOf: () => Number(value) })

describe('BillingReportsService', () => {
  let prisma: {
    invoice: Record<string, jest.Mock>
    payment: Record<string, jest.Mock>
    refund: Record<string, jest.Mock>
    invoiceItem: Record<string, jest.Mock>
  }
  let service: BillingReportsService

  beforeEach(() => {
    prisma = {
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      refund: { findMany: jest.fn().mockResolvedValue([]) },
      invoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
    }
    service = new BillingReportsService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  const range = { from: '2026-07-01', to: '2026-07-31' }

  it('reports zeroes rather than NaN when there is no billing activity', async () => {
    const report = await service.getReport('org_1', range)

    expect(report.revenue).toBe('0.00')
    expect(report.collections).toBe('0.00')
    expect(report.totalTax).toBe('0.00')
    expect(report.gstSummary).toEqual([])
    expect(report.outstandingAgeing).toHaveLength(4)
  })

  it('never counts a DRAFT invoice as revenue', async () => {
    await service.getReport('org_1', range)

    const statuses = prisma.invoice.findMany.mock.calls[0][0].where.status.in
    expect(statuses).not.toContain('DRAFT')
    expect(statuses).toContain('ISSUED')
  })

  it('keeps invoiced revenue and collected cash as separate figures', async () => {
    prisma.invoice.findMany.mockImplementation((args: { select: Record<string, unknown> }) =>
      // The comparison query selects only totalAmount; the main one selects more.
      args.select.type
        ? Promise.resolve([
            {
              createdAt: new Date(2026, 6, 5),
              type: 'OPD',
              totalAmount: decimal('1000'),
              discountAmount: decimal('0'),
              taxAmount: decimal('0'),
            },
          ])
        : Promise.resolve([]),
    )
    prisma.payment.findMany.mockResolvedValue([
      { amount: decimal('400'), paymentMode: 'CASH', paidAt: new Date(2026, 6, 5) },
    ])

    const report = await service.getReport('org_1', range)

    // An invoice raised this month but only part-paid must not make
    // collections equal revenue — that conflation is the classic error here.
    expect(report.revenue).toBe('1000.00')
    expect(report.collections).toBe('400.00')
    expect(report.collectionsByMode).toEqual([{ label: 'CASH', amount: '400.00' }])
  })

  it('backs the taxable value out of tax-inclusive line totals, per slab', async () => {
    prisma.invoiceItem.findMany.mockResolvedValue([
      { taxPercent: decimal('18'), totalPrice: decimal('118') },
      { taxPercent: decimal('18'), totalPrice: decimal('236') },
      { taxPercent: decimal('5'), totalPrice: decimal('105') },
      { taxPercent: decimal('0'), totalPrice: decimal('50') },
    ])

    const report = await service.getReport('org_1', range)

    expect(report.gstSummary).toEqual([
      { taxPercent: '0.00', taxableValue: '50.00', taxAmount: '0.00', lineCount: 1 },
      { taxPercent: '5.00', taxableValue: '100.00', taxAmount: '5.00', lineCount: 1 },
      { taxPercent: '18.00', taxableValue: '300.00', taxAmount: '54.00', lineCount: 2 },
    ])
    expect(report.totalTaxableValue).toBe('450.00')
    expect(report.totalTax).toBe('59.00')
  })

  it('ages an unpaid invoice from its due date when one is set', async () => {
    const now = new Date()
    const seventyDaysAgo = new Date(now.getTime() - 70 * 86_400_000)
    const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000)

    prisma.invoice.findMany.mockImplementation((args: { select: Record<string, unknown> }) =>
      args.select.balanceDue
        ? Promise.resolve([
            // Raised 70 days ago but only due 10 days ago — not 90 days overdue.
            { balanceDue: decimal('500'), createdAt: seventyDaysAgo, dueDate: tenDaysAgo },
          ])
        : Promise.resolve([]),
    )

    const report = await service.getReport('org_1', range)

    expect(report.outstanding).toBe('500.00')
    expect(report.outstandingAgeing[0]).toEqual({ label: '0-30 days', invoices: 1, amount: '500.00' })
    expect(report.outstandingAgeing[2]).toEqual({ label: '61-90 days', invoices: 0, amount: '0.00' })
  })

  it('measures outstanding as a live balance, not one scoped to the range', async () => {
    await service.getReport('org_1', range)

    const outstandingCall = prisma.invoice.findMany.mock.calls.find((call) => call[0].select?.balanceDue)
    expect(outstandingCall?.[0].where.createdAt).toBeUndefined()
  })
})
