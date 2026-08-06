import PDFDocument from 'pdfkit'

export interface ReceiptPdfData {
  paymentNumber: string
  invoiceNumber: string
  paidAt: Date
  amount: string
  paymentMode: string
  transactionId: string | null
  referenceNumber: string | null
  collectedBy: string | null
  currency: string
  organization: { name: string; address: string | null; phone: string; email: string; taxId: string | null }
  patient: { fullName: string; uhid: string }
}

/**
 * Printable payment receipt - hospital branding + a QR placeholder (see
 * `billing-invoice-pdf.ts`'s doc comment for why it's a disclosed visual
 * placeholder, not a real scannable payment code).
 */
export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(16).font('Helvetica-Bold').text(data.organization.name, { align: 'center' })
    doc.font('Helvetica').fontSize(9)
    if (data.organization.address) doc.text(data.organization.address, { align: 'center' })
    doc.text(`${data.organization.phone} · ${data.organization.email}`, { align: 'center' })
    if (data.organization.taxId) doc.text(`GSTIN: ${data.organization.taxId}`, { align: 'center' })
    doc.moveDown(1)
    doc.moveTo(40, doc.y).lineTo(370, doc.y).stroke()
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(13).text('Payment Receipt', { align: 'center' })
    doc.moveDown(0.5)

    doc.font('Helvetica').fontSize(10)
    const row = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(label, { continued: true })
      doc.font('Helvetica').text(`  ${value}`)
    }
    row('Receipt No.:', data.paymentNumber)
    row('Invoice No.:', data.invoiceNumber)
    row('Patient:', `${data.patient.fullName} (${data.patient.uhid})`)
    row('Date:', data.paidAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))
    row('Mode:', data.paymentMode.replace(/_/g, ' '))
    if (data.transactionId) row('Transaction ID:', data.transactionId)
    if (data.referenceNumber) row('Reference No.:', data.referenceNumber)
    if (data.collectedBy) row('Collected by:', data.collectedBy)
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(14).text(`Amount received: ${data.currency} ${data.amount}`)

    // QR placeholder - no real payment gateway is configured (see the
    // invoice PDF's doc comment for the same disclosed practice).
    doc.moveDown(1.5)
    doc.rect(40, doc.y, 60, 60).stroke()
    doc.fontSize(7).text('QR (integration\npending)', 40, doc.y + 22, { width: 60, align: 'center' })

    doc.moveDown(5)
    doc.fontSize(8).font('Helvetica-Oblique').text('This is a system-generated receipt.', { align: 'center' })

    doc.end()
  })
}
