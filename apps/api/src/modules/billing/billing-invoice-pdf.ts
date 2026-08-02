import PDFDocument from 'pdfkit'

export interface InvoicePdfData {
  invoiceNumber: string
  status: string
  createdAt: Date
  dueDate: Date | null
  organization: { name: string; address: string | null; phone: string; email: string; taxId: string | null }
  patient: { fullName: string; uhid: string }
  items: Array<{
    itemName: string
    category: string
    quantity: number
    unitPrice: string
    discountPercent: string
    taxPercent: string
    totalPrice: string
  }>
  subtotal: string
  discountAmount: string
  taxAmount: string
  totalAmount: string
  paidAmount: string
  balanceDue: string
  currency: string
  notes: string | null
}

/**
 * A structured, system-generated invoice — itemized with per-line GST
 * breakdown, org branding (name/address/GSTIN), and a QR placeholder (no
 * real UPI/payment-gateway integration is configured in this repo — see
 * TECH_DEBT — so this is a disclosed visual placeholder, not a scannable
 * payment code, the same "disclosed placeholder" practice as the
 * DICOM/ICD-10 placeholders in earlier milestones).
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(18).font('Helvetica-Bold').text(data.organization.name, { align: 'center' })
    doc.font('Helvetica').fontSize(10)
    if (data.organization.address) doc.text(data.organization.address, { align: 'center' })
    doc.text(`${data.organization.phone} · ${data.organization.email}`, { align: 'center' })
    if (data.organization.taxId) doc.text(`GSTIN: ${data.organization.taxId}`, { align: 'center' })
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)

    doc.fontSize(14).font('Helvetica-Bold').text('Invoice', { continued: true })
    doc.font('Helvetica').fontSize(11).text(`   ${data.invoiceNumber}`)
    doc
      .fontSize(9)
      .text(
        `Status: ${data.status} · Issued: ${data.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}` +
          (data.dueDate ? ` · Due: ${data.dueDate.toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''),
      )
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(10).text('Billed to')
    doc.font('Helvetica').text(`${data.patient.fullName}  ·  ${data.patient.uhid}`)
    doc.moveDown(1)

    const colX = { name: 50, qty: 280, price: 330, disc: 390, tax: 440, total: 490 }
    doc.font('Helvetica-Bold').fontSize(9)
    doc.text('Item', colX.name, doc.y, { continued: false })
    doc.text('Qty', colX.qty, doc.y - 11)
    doc.text('Price', colX.price, doc.y - 11)
    doc.text('Disc%', colX.disc, doc.y - 11)
    doc.text('Tax%', colX.tax, doc.y - 11)
    doc.text('Total', colX.total, doc.y - 11)
    doc.moveDown(0.3)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.3)

    doc.font('Helvetica').fontSize(9)
    data.items.forEach((item) => {
      const y = doc.y
      doc.text(`${item.itemName} (${item.category})`, colX.name, y, { width: 220 })
      doc.text(String(item.quantity), colX.qty, y)
      doc.text(item.unitPrice, colX.price, y)
      doc.text(item.discountPercent, colX.disc, y)
      doc.text(item.taxPercent, colX.tax, y)
      doc.text(item.totalPrice, colX.total, y)
      doc.moveDown(0.5)
    })

    doc.moveDown(0.5)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)

    const totalsX = 400
    doc.font('Helvetica').fontSize(10)
    doc.text(`Subtotal: ${data.currency} ${data.subtotal}`, totalsX, doc.y, { align: 'right', width: 145 })
    doc.text(`Discount: -${data.currency} ${data.discountAmount}`, totalsX, doc.y, { align: 'right', width: 145 })
    doc.text(`Tax: ${data.currency} ${data.taxAmount}`, totalsX, doc.y, { align: 'right', width: 145 })
    doc.font('Helvetica-Bold').text(`Total: ${data.currency} ${data.totalAmount}`, totalsX, doc.y, { align: 'right', width: 145 })
    doc.font('Helvetica').text(`Paid: ${data.currency} ${data.paidAmount}`, totalsX, doc.y, { align: 'right', width: 145 })
    doc
      .font('Helvetica-Bold')
      .text(`Balance due: ${data.currency} ${data.balanceDue}`, totalsX, doc.y, { align: 'right', width: 145 })

    if (data.notes) {
      doc.moveDown(1)
      doc.font('Helvetica-Bold').fontSize(10).text('Notes')
      doc.font('Helvetica').text(data.notes)
    }

    // QR placeholder — see this function's doc comment.
    doc.rect(50, doc.y + 20, 70, 70).stroke()
    doc.fontSize(7).text('QR (integration\npending)', 50, doc.y + 48, { width: 70, align: 'center' })

    doc.moveDown(6)
    doc
      .fontSize(9)
      .font('Helvetica-Oblique')
      .text('This is a system-generated invoice.', { align: 'center' })

    doc.end()
  })
}
