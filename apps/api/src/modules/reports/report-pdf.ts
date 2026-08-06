import { ReportRunResult } from '@medicore/types'
import PDFDocument from 'pdfkit'

export interface ReportPdfData {
  organization: { name: string; address: string | null; phone: string; email: string }
  result: ReportRunResult
}

const PAGE_MARGIN = 40
const A4_PORTRAIT_WIDTH = 595.28
const A4_LANDSCAPE_WIDTH = 841.89
const ROW_HEIGHT = 16
const HEADER_FONT_SIZE = 8
const BODY_FONT_SIZE = 8

/** Beyond this many columns a portrait page overlaps text, so it goes landscape. */
const LANDSCAPE_COLUMN_THRESHOLD = 6

/**
 * A structured, system-generated report PDF (Milestone 17 Checkpoint 17.3),
 * following the same pdfkit idiom as the invoice/receipt/discharge
 * generators already in this repo - org header, titled body, paginated table.
 */
export async function generateReportPdf(data: ReportPdfData): Promise<Buffer> {
  const { organization, result } = data
  const landscape = result.definition.columns.length > LANDSCAPE_COLUMN_THRESHOLD
  const layout: 'portrait' | 'landscape' = landscape ? 'landscape' : 'portrait'
  const contentWidth = (landscape ? A4_LANDSCAPE_WIDTH : A4_PORTRAIT_WIDTH) - PAGE_MARGIN * 2
  const columnWidth = contentWidth / Math.max(1, result.definition.columns.length)

  /** Text columns read left-aligned; every measured column right-aligns so digits line up. */
  const alignOf = (type: string): 'left' | 'right' => (type === 'string' || type === 'date' ? 'left' : 'right')

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout, margin: PAGE_MARGIN })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(15).font('Helvetica-Bold').text(organization.name, { align: 'center' })
    doc.font('Helvetica').fontSize(8)
    if (organization.address) doc.text(organization.address, { align: 'center' })
    doc.text(`${organization.phone} · ${organization.email}`, { align: 'center' })
    doc.moveDown(0.8)

    doc.fontSize(13).font('Helvetica-Bold').text(result.definition.label)
    doc.font('Helvetica').fontSize(8).fillColor('#444444')
    doc.text(result.definition.description)
    doc.text(
      `Period: ${result.period.from} to ${result.period.to} · Grouped by ${result.period.groupBy} · ` +
        `${result.totalRows} row${result.totalRows === 1 ? '' : 's'}`,
    )
    doc.text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`)
    doc.fillColor('#000000')
    doc.moveDown(0.6)

    // ── Table ───────────────────────────────────────────────────────────────
    const drawHeaderRow = () => {
      const y = doc.y
      doc.font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE)
      result.definition.columns.forEach((column, index) => {
        doc.text(column.label, PAGE_MARGIN + index * columnWidth, y, {
          width: columnWidth - 4,
          align: alignOf(column.type),
          ellipsis: true,
        })
      })
      doc.y = y + ROW_HEIGHT
      doc
        .moveTo(PAGE_MARGIN, doc.y - 4)
        .lineTo(PAGE_MARGIN + contentWidth, doc.y - 4)
        .strokeColor('#cccccc')
        .stroke()
      doc.font('Helvetica').fontSize(BODY_FONT_SIZE)
    }

    drawHeaderRow()

    const bottomLimit = doc.page.height - PAGE_MARGIN - ROW_HEIGHT

    for (const row of result.rows) {
      if (doc.y > bottomLimit) {
        doc.addPage({ size: 'A4', layout, margin: PAGE_MARGIN })
        drawHeaderRow()
      }

      const y = doc.y
      result.definition.columns.forEach((column, index) => {
        const value = row[column.key]
        // A missing measurement prints as an em dash, never as 0 - the two
        // mean different things and a printed report cannot be interrogated.
        const text = value === null || value === undefined || value === '' ? '-' : String(value)
        doc.text(text, PAGE_MARGIN + index * columnWidth, y, {
          width: columnWidth - 4,
          align: alignOf(column.type),
          ellipsis: true,
        })
      })
      doc.y = y + ROW_HEIGHT
    }

    if (result.rows.length === 0) {
      doc.moveDown(0.5).fillColor('#666666').text('No data for the selected period.').fillColor('#000000')
    }

    // Truncation is disclosed in the document itself, not only in the UI that
    // requested it - a PDF outlives the screen it was exported from.
    if (result.truncated) {
      doc.moveDown(0.8)
      doc
        .fontSize(8)
        .fillColor('#a15c00')
        .text(`Truncated: showing the first ${result.rows.length} of ${result.totalRows} rows.`)
        .fillColor('#000000')
    }

    doc.end()
  })
}
