import PDFDocument from 'pdfkit'

export interface EncounterSummaryPdfData {
  encounterNumber: string
  type: string
  status: string
  createdAt: Date
  organization: { name: string; address: string | null; phone: string; email: string }
  doctor: { fullName: string; specialization: string }
  patient: { fullName: string; uhid: string }
  clinicalNotes: Array<{
    chiefComplaint: string | null
    historyOfPresentIllness: string | null
    pastMedicalHistory: string | null
    allergies: string | null
    currentMedications: string | null
    createdAt: Date
  }>
  diagnoses: Array<{ type: string; description: string; icdCode: string | null }>
  vitals: Array<{
    heightCm: number | null
    weightKg: number | null
    bloodPressureSystolic: number | null
    bloodPressureDiastolic: number | null
    pulse: number | null
    temperatureCelsius: number | null
    spo2: number | null
    recordedAt: Date
  }>
  procedures: Array<{ name: string; notes: string | null; performedAt: Date }>
}

/**
 * A claim-support document summarizing an encounter's clinical record -
 * built for insurance auto-attach (see ADR-0016), not exposed as a
 * standalone medical-records feature. Renders whatever sub-records exist;
 * an encounter with no clinical notes/diagnoses yet still produces a valid
 * (mostly empty) summary rather than failing.
 */
export async function generateEncounterSummaryPdf(data: EncounterSummaryPdfData): Promise<Buffer> {
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

    doc.fontSize(14).font('Helvetica-Bold').text('Encounter Summary')
    doc
      .font('Helvetica')
      .fontSize(9)
      .text(
        `${data.encounterNumber} · ${data.type} · ${data.status} · ${data.createdAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}`,
      )
    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').fontSize(10).text('Patient')
    doc.font('Helvetica').text(`${data.patient.fullName}  ·  ${data.patient.uhid}`)
    doc.font('Helvetica-Bold').text('Treating Doctor')
    doc.font('Helvetica').text(`${data.doctor.fullName}  ·  ${data.doctor.specialization}`)
    doc.moveDown(1)

    if (data.clinicalNotes.length) {
      doc.font('Helvetica-Bold').fontSize(11).text('Clinical Notes')
      for (const note of data.clinicalNotes) {
        doc.font('Helvetica').fontSize(9)
        if (note.chiefComplaint) doc.text(`Chief complaint: ${note.chiefComplaint}`)
        if (note.historyOfPresentIllness) doc.text(`History of present illness: ${note.historyOfPresentIllness}`)
        if (note.pastMedicalHistory) doc.text(`Past medical history: ${note.pastMedicalHistory}`)
        if (note.allergies) doc.text(`Allergies: ${note.allergies}`)
        if (note.currentMedications) doc.text(`Current medications: ${note.currentMedications}`)
        doc.moveDown(0.5)
      }
    }

    if (data.diagnoses.length) {
      doc.font('Helvetica-Bold').fontSize(11).text('Diagnoses')
      doc.font('Helvetica').fontSize(9)
      for (const d of data.diagnoses) {
        doc.text(`${d.type}: ${d.description}${d.icdCode ? ` (${d.icdCode})` : ''}`)
      }
      doc.moveDown(0.5)
    }

    if (data.vitals.length) {
      doc.font('Helvetica-Bold').fontSize(11).text('Vitals')
      doc.font('Helvetica').fontSize(9)
      for (const v of data.vitals) {
        doc.text(
          `${v.recordedAt.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} - ` +
            `BP ${v.bloodPressureSystolic ?? '-'}/${v.bloodPressureDiastolic ?? '-'}, Pulse ${v.pulse ?? '-'}, ` +
            `Temp ${v.temperatureCelsius ?? '-'}°C, SpO2 ${v.spo2 ?? '-'}%, ` +
            `Ht ${v.heightCm ?? '-'}cm, Wt ${v.weightKg ?? '-'}kg`,
        )
      }
      doc.moveDown(0.5)
    }

    if (data.procedures.length) {
      doc.font('Helvetica-Bold').fontSize(11).text('Procedures')
      doc.font('Helvetica').fontSize(9)
      for (const p of data.procedures) {
        doc.text(`${p.name} - ${p.performedAt.toLocaleDateString('en-IN', { dateStyle: 'medium' })}${p.notes ? `: ${p.notes}` : ''}`)
      }
    }

    doc.moveDown(2)
    doc.fontSize(9).font('Helvetica-Oblique').text('This is a system-generated encounter summary.', { align: 'center' })

    doc.end()
  })
}
