import PDFDocument from 'pdfkit'

export interface DischargeSummaryPdfData {
  admissionNumber: string
  admittedAt: Date
  dischargedAt: Date
  organization: { name: string; address: string | null; phone: string; email: string }
  patient: { fullName: string; uhid: string }
  attendingDoctor: { fullName: string; specialization: string }
  ward: { name: string }
  admissionReason: string
  finalDiagnosis: string
  courseInHospital: string | null
  proceduresPerformed: string | null
  conditionAtDischarge: string | null
  medicationReconciliation: string | null
  followUpInstructions: string | null
  followUpAppointmentAt: Date | null
  followUpDoctor: { fullName: string; specialization: string } | null
  dischargePrescription: { prescriptionNumber: string } | null
}

/** Discharge summary — final diagnosis, hospital course, follow-up plan. Structured, system-generated, mirrors `generateEncounterSummaryPdf`. */
export async function generateDischargeSummaryPdf(data: DischargeSummaryPdfData): Promise<Buffer> {
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
    doc.moveDown(1)
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke()
    doc.moveDown(0.5)

    doc.fontSize(14).font('Helvetica-Bold').text('Discharge Summary')
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(
        `${data.admissionNumber} · Admitted ${data.admittedAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })} · ` +
          `Discharged ${data.dischargedAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
      )
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(10).text('Patient')
    doc.font('Helvetica').text(`${data.patient.fullName}  ·  ${data.patient.uhid}`)
    doc.font('Helvetica-Bold').text('Attending Doctor')
    doc.font('Helvetica').text(`${data.attendingDoctor.fullName}  ·  ${data.attendingDoctor.specialization}`)
    doc.font('Helvetica-Bold').text('Ward')
    doc.font('Helvetica').text(data.ward.name)
    doc.moveDown(1)

    doc.font('Helvetica-Bold').fontSize(11).text('Reason for Admission')
    doc.font('Helvetica').fontSize(9).text(data.admissionReason)
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(11).text('Final Diagnosis')
    doc.font('Helvetica').fontSize(9).text(data.finalDiagnosis)
    doc.moveDown(0.5)

    if (data.courseInHospital) {
      doc.font('Helvetica-Bold').fontSize(11).text('Course in Hospital')
      doc.font('Helvetica').fontSize(9).text(data.courseInHospital)
      doc.moveDown(0.5)
    }

    if (data.proceduresPerformed) {
      doc.font('Helvetica-Bold').fontSize(11).text('Procedures Performed')
      doc.font('Helvetica').fontSize(9).text(data.proceduresPerformed)
      doc.moveDown(0.5)
    }

    if (data.conditionAtDischarge) {
      doc.font('Helvetica-Bold').fontSize(11).text('Condition at Discharge')
      doc.font('Helvetica').fontSize(9).text(data.conditionAtDischarge)
      doc.moveDown(0.5)
    }

    if (data.medicationReconciliation) {
      doc.font('Helvetica-Bold').fontSize(11).text('Medication Reconciliation')
      doc.font('Helvetica').fontSize(9).text(data.medicationReconciliation)
      doc.moveDown(0.5)
    }

    if (data.dischargePrescription) {
      doc.font('Helvetica-Bold').fontSize(11).text('Discharge Prescription')
      doc.font('Helvetica').fontSize(9).text(data.dischargePrescription.prescriptionNumber)
      doc.moveDown(0.5)
    }

    if (data.followUpInstructions || data.followUpAppointmentAt || data.followUpDoctor) {
      doc.font('Helvetica-Bold').fontSize(11).text('Follow-up')
      doc.font('Helvetica').fontSize(9)
      if (data.followUpInstructions) doc.text(data.followUpInstructions)
      if (data.followUpAppointmentAt) {
        doc.text(`Appointment: ${data.followUpAppointmentAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`)
      }
      if (data.followUpDoctor) {
        doc.text(`With: ${data.followUpDoctor.fullName} · ${data.followUpDoctor.specialization}`)
      }
    }

    doc.moveDown(2)
    doc.fontSize(9).font('Helvetica-Oblique').text('This is a system-generated discharge summary.', { align: 'center' })

    doc.end()
  })
}
