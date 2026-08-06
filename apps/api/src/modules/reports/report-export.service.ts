import { ReportColumnDef, ReportExportFormat, ReportRunResult } from '@medicore/types'
import { BadRequestException, Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

import { generateReportPdf } from './report-pdf'
import { buildXlsx, XlsxColumn } from './xlsx.util'

export interface ExportedReport {
  buffer: Buffer
  fileName: string
  contentType: string
}

const CONTENT_TYPES: Record<ReportExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
}

/** Column types whose values Excel should treat as numbers. */
const NUMERIC_TYPES: ReadonlySet<ReportColumnDef['type']> = new Set(['number', 'currency', 'percent'])

/**
 * Report export (Milestone 17 Checkpoint 17.3).
 *
 * All three formats render the *same* `ReportRunResult` the on-screen report
 * was built from, so an exported file can never show different numbers from
 * the page it was exported from. Nothing here re-queries or re-aggregates.
 */
@Injectable()
export class ReportExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(
    organizationId: string,
    result: ReportRunResult,
    format: ReportExportFormat,
  ): Promise<ExportedReport> {
    const fileName = this.fileNameFor(result, format)

    switch (format) {
      case 'csv':
        return { buffer: Buffer.from(this.toCsv(result), 'utf8'), fileName, contentType: CONTENT_TYPES.csv }
      case 'xlsx':
        return {
          buffer: buildXlsx(result.definition.label, this.toXlsxColumns(result.definition.columns), result.rows),
          fileName,
          contentType: CONTENT_TYPES.xlsx,
        }
      case 'pdf': {
        const organization = await this.prisma.organization.findUniqueOrThrow({
          where: { id: organizationId },
          select: { name: true, address: true, phone: true, email: true },
        })
        return {
          buffer: await generateReportPdf({ organization, result }),
          fileName,
          contentType: CONTENT_TYPES.pdf,
        }
      }
      default:
        throw new BadRequestException(`Unsupported export format "${format as string}"`)
    }
  }

  private toXlsxColumns(columns: ReportColumnDef[]): XlsxColumn[] {
    return columns.map((column) => ({
      key: column.key,
      label: column.label,
      numeric: NUMERIC_TYPES.has(column.type),
    }))
  }

  private fileNameFor(result: ReportRunResult, format: ReportExportFormat): string {
    const slug = result.definition.key.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    return `${slug}-${result.period.from}-to-${result.period.to}.${format}`
  }

  /**
   * RFC 4180 CSV, matching the hand-rolled writer conventions already used by
   * Payroll Prep's export - quote every field, double any embedded quote, and
   * use CRLF line endings so Excel opens it without an import wizard.
   */
  toCsv(result: ReportRunResult): string {
    const escape = (value: unknown): string => {
      if (value === null || value === undefined) return '""'
      return `"${String(value).replace(/"/g, '""')}"`
    }

    const lines = [result.definition.columns.map((column) => escape(column.label)).join(',')]
    for (const row of result.rows) {
      lines.push(result.definition.columns.map((column) => escape(row[column.key])).join(','))
    }

    // A truncated export that looks complete is worse than no export - the
    // cap is stated in the file itself, not just in the UI that requested it.
    if (result.truncated) {
      lines.push('')
      lines.push(escape(`Truncated: showing ${result.rows.length} of ${result.totalRows} rows.`))
    }

    return lines.join('\r\n')
  }
}
