import PDFDocument from 'pdfkit'

export interface RadiologyReportPdfData {
  orderNumber: string
  modality: string
  bodyPart: string
  priority: string
  reportedAt: Date | null
  organization: { name: string; address: string | null; phone: string; email: string }
  doctor: { fullName: string; specialization: string }
  radiologist: { fullName: string; specialization: string } | null
  patient: { fullName: string; uhid: string; age: number; gender: string }
  clinicalIndication: string | null
  technique: string | null
  findings: string | null
  impression: string | null
  recommendations: string | null
}

/**
 * A structured, system-generated radiology report - built from the order's
 * own denormalized current-report fields (clinicalIndication/technique/
 * findings/impression/recommendations), independent of whether an external
 * report file was ever uploaded via `uploadReportFile`. Mirrors
 * `generateLabReportPdf`'s structure.
 */
export async function generateRadiologyReportPdf(data: RadiologyReportPdfData): Promise<Buffer> {
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

    doc.fontSize(12).font('Helvetica-Bold').text('Radiology Report', { continued: true })
    doc.font('Helvetica').text(`   ${data.orderNumber}`, { align: 'left' })
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

    doc.font('Helvetica-Bold').text('Study')
    doc.font('Helvetica').text(`${data.modality} - ${data.bodyPart}`)
    doc.moveDown(0.3)

    doc.font('Helvetica-Bold').text('Ordered by')
    doc.font('Helvetica').text(`Dr. ${data.doctor.fullName} - ${data.doctor.specialization}`)
    if (data.radiologist) {
      doc.moveDown(0.2)
      doc.font('Helvetica-Bold').text('Radiologist')
      doc.font('Helvetica').text(`Dr. ${data.radiologist.fullName} - ${data.radiologist.specialization}`)
    }
    doc.moveDown(1)

    const section = (title: string, body: string | null) => {
      if (!body) return
      doc.font('Helvetica-Bold').fontSize(11).text(title)
      doc.font('Helvetica').fontSize(10).text(body)
      doc.moveDown(0.6)
    }

    section('Clinical Indication', data.clinicalIndication)
    section('Technique', data.technique)
    section('Findings', data.findings)
    section('Impression', data.impression)
    section('Recommendations', data.recommendations)

    doc.moveDown(1.5)
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('This is a system-generated radiology report.', { align: 'center' })

    doc.end()
  })
}
