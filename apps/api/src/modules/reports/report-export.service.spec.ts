import { ReportRunResult } from '@medicore/types'

import { ReportExportService } from './report-export.service'

const RESULT: ReportRunResult = {
  definition: {
    key: 'billing.revenue',
    label: 'Revenue & collections',
    module: 'Billing',
    description: 'Invoiced value and cash collected per bucket.',
    filters: ['from', 'to', 'groupBy'],
    columns: [
      { key: 'bucket', label: 'Period', type: 'date' },
      { key: 'invoiced', label: 'Invoiced', type: 'currency' },
      { key: 'note', label: 'Note', type: 'string' },
    ],
  },
  period: { from: '2026-07-01', to: '2026-07-31', groupBy: 'day', days: 31 },
  rows: [
    { bucket: '2026-07-01', invoiced: '1000.00', note: 'ok' },
    { bucket: '2026-07-02', invoiced: '0.00', note: null },
  ],
  totalRows: 2,
  truncated: false,
}

describe('ReportExportService', () => {
  let prisma: { organization: Record<string, jest.Mock> }
  let service: ReportExportService

  beforeEach(() => {
    prisma = {
      organization: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          name: 'MediCore Demo Hospital',
          address: '1 Test Road',
          phone: '+911234567890',
          email: 'hello@example.test',
        }),
      },
    }
    service = new ReportExportService(prisma as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('toCsv', () => {
    it('writes an RFC 4180 header row and CRLF line endings', () => {
      const csv = service.toCsv(RESULT)
      const lines = csv.split('\r\n')

      expect(lines[0]).toBe('"Period","Invoiced","Note"')
      expect(lines[1]).toBe('"2026-07-01","1000.00","ok"')
    })

    it('writes an empty quoted field for null rather than the string "null"', () => {
      const lines = service.toCsv(RESULT).split('\r\n')

      expect(lines[2]).toBe('"2026-07-02","0.00",""')
    })

    it('doubles embedded quotes so the field cannot break the row', () => {
      const csv = service.toCsv({
        ...RESULT,
        rows: [{ bucket: 'a', invoiced: '1', note: 'He said "hi", then left' }],
      })

      expect(csv).toContain('"He said ""hi"", then left"')
    })

    it('states the truncation inside the file, not only in the UI', () => {
      const csv = service.toCsv({ ...RESULT, totalRows: 9000, truncated: true })

      expect(csv).toContain('Truncated: showing 2 of 9000 rows.')
    })
  })

  describe('export', () => {
    it('names the file after the report key and the period it covers', async () => {
      const file = await service.export('org_1', RESULT, 'csv')

      expect(file.fileName).toBe('billing-revenue-2026-07-01-to-2026-07-31.csv')
      expect(file.contentType).toBe('text/csv; charset=utf-8')
    })

    it('produces a real xlsx package, not CSV with an xlsx extension', async () => {
      const file = await service.export('org_1', RESULT, 'xlsx')

      // The ZIP local file header every OOXML package starts with.
      expect(file.buffer.readUInt32LE(0)).toBe(0x04034b50)
      expect(file.contentType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    })

    it('produces a PDF carrying the organization header', async () => {
      const file = await service.export('org_1', RESULT, 'pdf')

      expect(file.buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-')
      expect(prisma.organization.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org_1' } }),
      )
    })
  })
})
