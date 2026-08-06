import PDFDocument from 'pdfkit'

export interface LabReportPdfData {
  labOrderNumber: string
  reportedAt: Date | null
  priority: string
  organization: { name: string; address: string | null; phone: string; email: string }
  doctor: { fullName: string; specialization: string }
  patient: { fullName: string; uhid: string; age: number; gender: string }
  items: Array<{
    testName: string
    testCode: string
    category: string
    result: string | null
    unit: string | null
    referenceRange: string | null
    isAbnormal: boolean
    abnormalType: string | null
    interpretation: string | null
  }>
  notes: string | null
}

/**
 * A structured, system-generated lab report - distinct from an uploaded
 * external report file (`reportFileUrl`). Renders every item's result
 * against its reference range with abnormal flags called out, so it can be
 * produced at any time from the structured `LabTestItem` rows without
 * depending on whether an external file was ever uploaded.
 */
export async function generateLabReportPdf(data: LabReportPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).text(data.organization.name, { align: 'center' })
    if (data.organization.address) {
      doc.fontSize(10).font('Helvetica').text(data.organization.address, { align: 'center' })
    }
    doc.fontSize(10).text(`${data.organization.phone} · ${data.organization.email}`, { align: 'center' })
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)

    doc.fontSize(12).font('Helvetica-Bold').text('Laboratory Report', { continued: true })
    doc.font('Helvetica').text(`   ${data.labOrderNumber}`, { align: 'left' })
    doc
      .fontSize(10)
      .text(
        `Reported: ${data.reportedAt ? data.reportedAt.toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Pending'} · Priority: ${data.priority}`,
      )
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').text('Patient')
    doc
      .font('Helvetica')
      .text(`${data.patient.fullName}  ·  ${data.patient.uhid}  ·  ${data.patient.age}y  ·  ${data.patient.gender}`)
    doc.moveDown(0.3)

    doc.font('Helvetica-Bold').text('Ordered by')
    doc.font('Helvetica').text(`Dr. ${data.doctor.fullName} - ${data.doctor.specialization}`)
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(12).text('Results')
    doc.moveDown(0.3)

    data.items.forEach((item, index) => {
      const label = [item.testName, item.testCode ? `(${item.testCode})` : ''].filter(Boolean).join(' ')
      doc.font('Helvetica-Bold').fontSize(11).text(`${index + 1}. ${label}`)
      const resultLine = [
        item.result ?? 'Pending',
        item.unit,
        item.referenceRange ? `Ref: ${item.referenceRange}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      doc.font('Helvetica').fontSize(10).text(`   ${resultLine}`)
      if (item.isAbnormal) {
        doc
          .font('Helvetica-Bold')
          .fillColor('red')
          .fontSize(9)
          .text(`   ABNORMAL${item.abnormalType ? ` (${item.abnormalType.replace(/_/g, ' ')})` : ''}`)
        doc.fillColor('black')
      }
      if (item.interpretation) {
        doc.font('Helvetica-Oblique').fontSize(9).text(`   ${item.interpretation}`)
      }
      doc.moveDown(0.5)
    })

    if (data.notes) {
      doc.moveDown(0.5)
      doc.font('Helvetica-Bold').fontSize(10).text('Notes')
      doc.font('Helvetica').text(data.notes)
    }

    doc.moveDown(2)
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('This is a system-generated laboratory report.', { align: 'center' })

    doc.end()
  })
}
