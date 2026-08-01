import PDFDocument from 'pdfkit'

export interface PrescriptionPdfData {
  prescriptionNumber: string
  prescribedAt: Date
  organization: { name: string; address: string | null; phone: string; email: string }
  doctor: { fullName: string; specialization: string }
  patient: { fullName: string; uhid: string; age: number; gender: string }
  items: Array<{
    medicationName: string
    genericName: string | null
    strength: string | null
    dosage: string
    frequency: string
    duration: string
    route: string
    instructions: string | null
    quantity: number
  }>
  notes: string | null
}

export async function generatePrescriptionPdf(data: PrescriptionPdfData): Promise<Buffer> {
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
    doc
      .fontSize(10)
      .text(`${data.organization.phone} · ${data.organization.email}`, { align: 'center' })
    doc.moveDown(1)
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke()
    doc.moveDown(0.5)

    doc.fontSize(12).font('Helvetica-Bold').text('Prescription', { continued: true })
    doc.font('Helvetica').text(`   ${data.prescriptionNumber}`, { align: 'left' })
    doc
      .fontSize(10)
      .text(`Date: ${data.prescribedAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`)
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').text('Patient')
    doc
      .font('Helvetica')
      .text(`${data.patient.fullName}  ·  ${data.patient.uhid}  ·  ${data.patient.age}y  ·  ${data.patient.gender}`)
    doc.moveDown(0.3)

    doc.font('Helvetica-Bold').text('Prescribed by')
    doc.font('Helvetica').text(`Dr. ${data.doctor.fullName} — ${data.doctor.specialization}`)
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(12).text('Rx')
    doc.moveDown(0.3)

    data.items.forEach((item, index) => {
      const label = [item.medicationName, item.strength].filter(Boolean).join(' ')
      doc.font('Helvetica-Bold').fontSize(11).text(`${index + 1}. ${label}`)
      if (item.genericName) {
        doc.font('Helvetica-Oblique').fontSize(9).text(`   (${item.genericName})`)
      }
      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`   ${item.dosage} · ${item.frequency} · ${item.duration} · ${item.route} · Qty: ${item.quantity}`)
      if (item.instructions) {
        doc.fontSize(9).font('Helvetica-Oblique').text(`   ${item.instructions}`)
      }
      doc.moveDown(0.5)
    })

    if (data.notes) {
      doc.moveDown(0.5)
      doc.font('Helvetica-Bold').fontSize(10).text('Notes')
      doc.font('Helvetica').text(data.notes)
    }

    doc.moveDown(2)
    doc.fontSize(9).font('Helvetica-Oblique').text('This is a system-generated prescription.', { align: 'center' })

    doc.end()
  })
}
