import { PrismaClient } from '@prisma/client'

import type { DemoContext } from './foundation'
import { COMPLAINTS, LAB_CATALOG, PRESCRIBING_PATTERNS, PROCEDURE_NAMES, RADIOLOGY_CATALOG } from './reference-data'
import {
  addMinutes,
  at,
  chance,
  computeBmi,
  computeChargeTotals,
  daysAgo,
  flagAbnormal,
  int,
  docNumber,
  money,
  pick,
  pickMany,
  rnd,
  round1,
} from './helpers'

const ORG_PREFIX = 'MED'

/** Encounters that later modules (IPD, insurance) can attach to. */
export interface ClinicalResult {
  completedEncounters: Array<{ id: string; patientId: string; doctorId: string; date: Date }>
  invoicedPatients: Set<string>
}

/**
 * Seeds the outpatient clinical spine: appointments across the last 30 days
 * and the next two weeks, the encounters completed ones produced, and
 * everything a real consultation generates downstream - notes, vitals,
 * diagnoses, prescriptions, lab and radiology orders, dispensing, charges,
 * invoices, payments, and insurance claims.
 */
export async function seedClinical(prisma: PrismaClient, ctx: DemoContext): Promise<ClinicalResult> {
  const { organizationId, users, doctors, patients, serviceCatalog } = ctx

  const labCatalogByCode = new Map(ctx.labCatalog.map((c) => [c.testCode, c.id]))
  const labSpecByCode = new Map(LAB_CATALOG.map((c) => [c.testCode, c]))
  const radCatalogByCode = new Map(ctx.radiologyCatalog.map((c) => [c.code, c.id]))
  const drugsByBrand = new Map(ctx.drugs.filter((d) => d.brandName).map((d) => [d.brandName as string, d]))
  const insuranceByPatient = new Map(ctx.patientInsurances.map((i) => [i.patientId, i]))

  const completedEncounters: ClinicalResult['completedEncounters'] = []
  const invoicedPatients = new Set<string>()

  // Slot times across the morning and evening OPD shifts.
  const SLOT_HOURS = [9, 9, 10, 10, 11, 12, 17, 17, 18, 19]

  for (let dayOffset = -30; dayOffset <= 14; dayOffset += 1) {
    const dayDate = at(dayOffset, 12)
    if (dayDate.getDay() === 0) continue // Sunday - OPD closed

    const isPast = dayOffset < 0
    const isToday = dayOffset === 0
    const perDay = isPast ? int(5, 9) : isToday ? 9 : int(2, 5)

    for (let n = 0; n < perDay; n += 1) {
      const doctor = pick(doctors)
      const patient = pick(patients)
      const hour = SLOT_HOURS[n % SLOT_HOURS.length]
      const scheduledAt = at(dayOffset, hour, pick([0, 15, 30, 45]))

      // Pick a complaint that fits this doctor's speciality where possible.
      const relevant = COMPLAINTS.filter((c) => c.specialities.includes(doctor.specialization))
      const complaint = relevant.length > 0 ? pick(relevant) : pick(COMPLAINTS)

      const isWalkIn = chance(0.15)
      let status: string
      let type: string

      if (isPast) {
        const roll = rnd()
        status = roll < 0.82 ? 'COMPLETED' : roll < 0.92 ? 'CANCELLED' : 'NO_SHOW'
      } else if (isToday) {
        // A believable "today" queue: some done, one in progress, some waiting.
        status = n < 3 ? 'COMPLETED' : n === 3 ? 'IN_CONSULTATION' : n < 6 ? 'ARRIVED' : n < 8 ? 'CONFIRMED' : 'SCHEDULED'
      } else {
        status = chance(0.6) ? 'CONFIRMED' : 'SCHEDULED'
      }

      if (doctor.specialization === 'Emergency Medicine') type = 'EMERGENCY'
      else if (chance(0.2)) type = 'FOLLOW_UP'
      else if (chance(0.08)) type = 'TELECONSULTATION'
      else type = 'OPD'

      const appointment = await prisma.appointment.create({
        data: {
          appointmentNumber: docNumber('APT', ORG_PREFIX),
          patientId: patient.id,
          doctorId: doctor.id,
          departmentId: doctor.departmentId,
          organizationId,
          scheduledAt,
          durationMinutes: 15,
          type: type as never,
          status: status as never,
          chiefComplaint: complaint.complaint,
          roomNumber: `OPD-${int(1, 12)}`,
          isWalkIn,
          createdAt: isPast || isToday ? addMinutes(scheduledAt, -int(60, 4320)) : daysAgo(int(1, 10)),
        },
      })

      if (status !== 'COMPLETED') continue

      // ── Encounter and its clinical content ─────────────────────────────
      const encounterType = type === 'EMERGENCY'
        ? 'EMERGENCY'
        : type === 'FOLLOW_UP'
          ? 'FOLLOW_UP'
          : type === 'TELECONSULTATION'
            ? 'TELECONSULTATION'
            : isWalkIn
              ? 'WALK_IN'
              : 'OPD'

      const encounter = await prisma.encounter.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          appointmentId: appointment.id,
          organizationId,
          type: encounterType as never,
          status: 'COMPLETED',
          encounterDate: scheduledAt,
          createdAt: scheduledAt,
        },
      })

      await prisma.clinicalNote.create({
        data: {
          encounterId: encounter.id,
          version: 1,
          chiefComplaint: complaint.complaint,
          historyOfPresentIllness: complaint.hpi,
          pastMedicalHistory: chance(0.4)
            ? pick([
              'Hypertension since 6 years, on regular treatment.',
              'Type 2 diabetes mellitus since 8 years.',
              'Bronchial asthma in childhood, currently asymptomatic.',
            ])
            : 'Nil significant.',
          familyHistory: chance(0.3) ? 'Father - hypertension. Mother - type 2 diabetes mellitus.' : 'Non-contributory.',
          surgicalHistory: chance(0.2) ? pick(['Appendicectomy in 2014.', 'Lower segment caesarean section in 2019.']) : 'Nil.',
          socialHistory: chance(0.3)
            ? pick(['Non-smoker, occasional alcohol.', 'Smoker - 10 pack years.', 'Teetotaller, vegetarian diet.'])
            : 'Non-smoker, non-alcoholic.',
          allergies: chance(0.15) ? pick(['Sulpha drugs - rash.', 'Penicillin - urticaria.', 'Dust and pollen.']) : 'No known drug allergy.',
          currentMedications: chance(0.35) ? 'On regular antihypertensives.' : 'Nil.',
          createdByUserId: doctor.userId,
          createdAt: scheduledAt,
        },
      })

      // Vitals - plausible for the patient's build, with a drift in weight
      // across visits so the trend chart has a real line to draw.
      const weightKg = round1(patient.baseWeightKg + (rnd() * 6 - 3))
      const isFebrile = /febrile|pneumonia|otitis|gastroenteritis/.test(complaint.diagnosis.toLowerCase())
      await prisma.vital.create({
        data: {
          encounterId: encounter.id,
          heightCm: patient.heightCm,
          weightKg,
          bmi: computeBmi(patient.heightCm, weightKg),
          bloodPressureSystolic: int(104, 158),
          bloodPressureDiastolic: int(64, 96),
          pulse: isFebrile ? int(92, 118) : int(64, 96),
          temperatureCelsius: isFebrile ? round1(37.8 + rnd() * 1.8) : round1(36.4 + rnd() * 0.8),
          respiratoryRate: isFebrile ? int(20, 28) : int(12, 18),
          spo2: isFebrile ? int(92, 98) : int(96, 100),
          recordedByUserId: users.nurse ?? doctor.userId,
          recordedAt: addMinutes(scheduledAt, -5),
        },
      })

      await prisma.diagnosis.create({
        data: {
          encounterId: encounter.id,
          type: 'PRIMARY',
          description: complaint.diagnosis,
          icdCode: complaint.icd,
          createdAt: scheduledAt,
        },
      })
      if (chance(0.3)) {
        const other = pick(COMPLAINTS.filter((c) => c.diagnosis !== complaint.diagnosis))
        await prisma.diagnosis.create({
          data: {
            encounterId: encounter.id,
            type: 'SECONDARY',
            description: other.diagnosis,
            icdCode: other.icd,
            createdAt: scheduledAt,
          },
        })
      }

      const didProcedure = chance(0.28)
      if (didProcedure) {
        await prisma.procedure.create({
          data: {
            encounterId: encounter.id,
            name: pick(PROCEDURE_NAMES),
            notes: 'Performed in the OPD procedure room. Patient tolerated it well.',
            performedAt: addMinutes(scheduledAt, 20),
            createdAt: scheduledAt,
          },
        })
      }

      // ── Prescription ───────────────────────────────────────────────────
      const pattern = PRESCRIBING_PATTERNS[complaint.diagnosis] ?? PRESCRIBING_PATTERNS['Acute viral febrile illness']
      const prescription = await prisma.prescription.create({
        data: {
          prescriptionNumber: docNumber('RX', ORG_PREFIX),
          patientId: patient.id,
          doctorId: doctor.id,
          encounterId: encounter.id,
          organizationId,
          status: 'ACTIVE',
          notes: 'Review after completing the course, or earlier if symptoms worsen.',
          prescribedAt: scheduledAt,
          createdAt: scheduledAt,
          items: {
            create: pattern.map((item) => ({
              medicationName: item.brand,
              genericName: drugsByBrand.get(item.brand)?.genericName,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: item.duration,
              route: item.route,
              instructions: item.instructions,
              quantity: item.frequency.startsWith('TDS') ? 15 : 10,
              createdAt: scheduledAt,
            })),
          },
        },
        include: { items: true },
      })

      // ── Charges (Charge Engine, ADR-0015) ──────────────────────────────
      const createdCharges: Array<{
        id: string; description: string; quantity: number; unitPrice: number
        taxPercent: number; totalAmount: number; category: string
      }> = []

      const consultCode = type === 'EMERGENCY'
        ? 'CONS-EMRG'
        : type === 'FOLLOW_UP'
          ? 'CONS-FOLLOW'
          : doctor.consultationFee >= 800
            ? 'CONS-SPEC'
            : 'CONS-GEN'

      const chargeSpecs: Array<{ catalogCode: string; source: string }> = [{ catalogCode: consultCode, source: 'CONSULTATION' }]
      if (didProcedure) chargeSpecs.push({ catalogCode: pick(['DRESS-SM', 'NEB', 'IV-INF', 'ECG', 'INJ-ADMIN']), source: 'PROCEDURE' })

      for (const spec of chargeSpecs) {
        const service = serviceCatalog.get(spec.catalogCode)
        if (!service) continue
        const totals = computeChargeTotals({ unitPrice: service.price, quantity: 1, taxPercent: service.taxPercent })
        const charge = await prisma.charge.create({
          data: {
            organizationId,
            patientId: patient.id,
            encounterId: encounter.id,
            appointmentId: appointment.id,
            sourceModule: spec.source as never,
            sourceId: encounter.id,
            catalogItemId: service.id,
            description: service.name,
            quantity: 1,
            unitPrice: service.price,
            taxPercent: service.taxPercent,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
            status: 'PENDING',
            createdByUserId: users.receptionist ?? doctor.userId,
            createdAt: scheduledAt,
          },
        })
        createdCharges.push({
          id: charge.id, description: service.name, quantity: 1, unitPrice: service.price,
          taxPercent: service.taxPercent, totalAmount: totals.totalAmount, category: service.category,
        })
      }

      // ── Laboratory ─────────────────────────────────────────────────────
      if (chance(0.45)) {
        const codes = pickMany(['HB', 'TLC', 'PLT', 'ESR', 'FBS', 'CREAT', 'UREA', 'SGPT', 'CRP', 'URINE', 'DENGUE', 'TSH'], int(2, 5))
        // Older orders are reported; the most recent ones are still in flight.
        const labStatus = dayOffset < -2 ? 'REPORTED' : pick(['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED'])
        const collected = labStatus !== 'ORDERED'
        const reported = labStatus === 'REPORTED'

        const labTest = await prisma.labTest.create({
          data: {
            labOrderNumber: docNumber('LAB', ORG_PREFIX),
            patientId: patient.id,
            doctorId: doctor.id,
            appointmentId: appointment.id,
            encounterId: encounter.id,
            organizationId,
            status: labStatus as never,
            priority: (type === 'EMERGENCY' ? pick(['URGENT', 'STAT']) : 'ROUTINE') as never,
            sampleCollectedBy: collected ? users.labtech : null,
            sampleCollectedAt: collected ? addMinutes(scheduledAt, 30) : null,
            reportedAt: reported ? addMinutes(scheduledAt, 240) : null,
            notes: 'Fasting sample where applicable.',
            createdAt: scheduledAt,
          },
        })

        let labTotal = 0
        for (const code of codes) {
          const spec = labSpecByCode.get(code)
          if (!spec) continue
          labTotal += spec.price

          let result: string | null = null
          let isAbnormal = false
          let abnormalType: string | null = null

          if (reported) {
            if (spec.low != null && spec.high != null) {
              // Most results land in range; some deliberately fall outside so
              // the abnormal-flagging UI has genuinely flagged rows.
              const span = spec.high - spec.low
              const value = chance(0.7)
                ? spec.low + rnd() * span
                : chance(0.5)
                  ? spec.high + rnd() * span * 0.6
                  : Math.max(0, spec.low - rnd() * span * 0.5)
              const rounded = span < 10 ? round1(value) : Math.round(value)
              result = String(rounded)
              const flag = flagAbnormal(rounded, spec.low, spec.high, spec.criticalLow, spec.criticalHigh)
              isAbnormal = flag.isAbnormal
              abnormalType = flag.abnormalType
            } else {
              result = code === 'URINE'
                ? pick(['Normal study', 'Occasional pus cells, otherwise normal', 'Trace albumin'])
                : pick(['Negative', 'Negative', 'Positive'])
              isAbnormal = result === 'Positive'
              abnormalType = isAbnormal ? 'HIGH' : null
            }
          }

          await prisma.labTestItem.create({
            data: {
              labTestId: labTest.id,
              catalogItemId: labCatalogByCode.get(code),
              testName: spec.testName,
              testCode: spec.testCode,
              category: spec.category,
              result,
              unit: spec.unit,
              referenceRange: spec.text ?? (spec.low != null ? `${spec.low} – ${spec.high}` : null),
              referenceRangeLow: spec.low,
              referenceRangeHigh: spec.high,
              criticalLow: spec.criticalLow,
              criticalHigh: spec.criticalHigh,
              isAbnormal,
              abnormalType: abnormalType as never,
              interpretation: isAbnormal ? 'Outside the reference range - correlate clinically.' : null,
              createdAt: scheduledAt,
            },
          })
        }

        const description = `Laboratory investigations (${codes.length} tests)`
        const labTotals = computeChargeTotals({ unitPrice: labTotal, quantity: 1 })
        const labCharge = await prisma.charge.create({
          data: {
            organizationId,
            patientId: patient.id,
            encounterId: encounter.id,
            appointmentId: appointment.id,
            sourceModule: 'LABORATORY',
            sourceId: labTest.id,
            description,
            quantity: 1,
            unitPrice: labTotal,
            totalAmount: labTotals.totalAmount,
            status: 'PENDING',
            createdByUserId: users.labtech ?? doctor.userId,
            createdAt: scheduledAt,
          },
        })
        createdCharges.push({
          id: labCharge.id, description, quantity: 1, unitPrice: labTotal,
          taxPercent: 0, totalAmount: labTotals.totalAmount, category: 'Laboratory',
        })
      }

      // ── Radiology ──────────────────────────────────────────────────────
      if (chance(0.25)) {
        const study = pick(RADIOLOGY_CATALOG)
        const radStatus = dayOffset < -3 ? 'REPORTED' : pick(['ORDERED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'])
        const reported = radStatus === 'REPORTED'
        const scheduled = radStatus !== 'ORDERED'
        const radiologist = ctx.doctorsBySpeciality.get('Radiodiagnosis')?.[0]

        const technique = `Standard ${study.name} protocol${study.contrastRequired ? ' with intravenous contrast' : ''}.`
        const findings = `${study.bodyPart} examined in standard projections. Visualised bones and soft tissues appear unremarkable. No acute abnormality detected.`
        const impression = chance(0.25)
          ? `Findings consistent with ${complaint.diagnosis.toLowerCase()}.`
          : 'No significant abnormality detected.'

        const order = await prisma.radiologyOrder.create({
          data: {
            orderNumber: docNumber('RAD', ORG_PREFIX),
            patientId: patient.id,
            doctorId: doctor.id,
            encounterId: encounter.id,
            catalogItemId: radCatalogByCode.get(study.code),
            organizationId,
            modality: study.modality,
            bodyPart: study.bodyPart,
            clinicalIndication: complaint.complaint,
            status: radStatus as never,
            priority: (type === 'EMERGENCY' ? 'URGENT' : 'ROUTINE') as never,
            scheduledAt: scheduled ? addMinutes(scheduledAt, 90) : null,
            room: scheduled ? `${study.category} Room ${int(1, 3)}` : null,
            machine: scheduled ? `${study.modality}-${int(1, 2)}` : null,
            technicianUserId: scheduled ? users.radiologytech : null,
            radiologistDoctorId: reported ? radiologist?.id : null,
            durationMinutes: study.durationMinutes,
            technique: reported ? technique : null,
            findings: reported ? findings : null,
            impression: reported ? impression : null,
            recommendations: reported ? 'Clinical correlation advised.' : null,
            reportedBy: reported ? radiologist?.userId : null,
            reportedAt: reported ? addMinutes(scheduledAt, 300) : null,
            verifiedByUserId: reported ? radiologist?.userId : null,
            verifiedAt: reported ? addMinutes(scheduledAt, 330) : null,
            releasedByUserId: reported ? radiologist?.userId : null,
            releasedAt: reported ? addMinutes(scheduledAt, 345) : null,
            createdAt: scheduledAt,
          },
        })

        if (reported) {
          await prisma.radiologyReport.create({
            data: {
              radiologyOrderId: order.id,
              version: 1,
              clinicalIndication: complaint.complaint,
              technique,
              findings,
              impression,
              recommendations: 'Clinical correlation advised.',
              createdByUserId: radiologist?.userId,
              createdAt: addMinutes(scheduledAt, 300),
            },
          })
        }

        const radTotals = computeChargeTotals({ unitPrice: study.price, quantity: 1 })
        const radCharge = await prisma.charge.create({
          data: {
            organizationId,
            patientId: patient.id,
            encounterId: encounter.id,
            appointmentId: appointment.id,
            sourceModule: 'RADIOLOGY',
            sourceId: order.id,
            description: study.name,
            quantity: 1,
            unitPrice: study.price,
            totalAmount: radTotals.totalAmount,
            status: 'PENDING',
            createdByUserId: users.radiologytech ?? doctor.userId,
            createdAt: scheduledAt,
          },
        })
        createdCharges.push({
          id: radCharge.id, description: study.name, quantity: 1, unitPrice: study.price,
          taxPercent: 0, totalAmount: radTotals.totalAmount, category: 'Radiology',
        })
      }

      // ── Pharmacy dispensing ────────────────────────────────────────────
      if (chance(0.6)) {
        const dispenseStatus = dayOffset < -1 ? 'DISPENSED' : pick(['PENDING', 'PREPARING', 'READY', 'DISPENSED'])
        const dispensed = dispenseStatus === 'DISPENSED'
        const dispenseOrder = await prisma.dispenseOrder.create({
          data: {
            dispenseNumber: docNumber('DSP', ORG_PREFIX),
            prescriptionId: prescription.id,
            patientId: patient.id,
            organizationId,
            status: dispenseStatus as never,
            preparedByUserId: dispenseStatus !== 'PENDING' ? users.pharmacist : null,
            dispensedByUserId: dispensed ? users.pharmacist : null,
            dispensedAt: dispensed ? addMinutes(scheduledAt, 45) : null,
            createdAt: addMinutes(scheduledAt, 15),
          },
        })

        let pharmacyTotal = 0
        for (const item of prescription.items) {
          const drug = drugsByBrand.get(item.medicationName)
          if (dispensed && drug) pharmacyTotal += drug.price * item.quantity
          await prisma.dispenseItem.create({
            data: {
              dispenseOrderId: dispenseOrder.id,
              prescriptionItemId: item.id,
              drugId: dispenseStatus === 'PENDING' ? null : drug?.id ?? null,
              medicationName: item.medicationName,
              quantityRequested: item.quantity,
              quantityDispensed: dispensed ? item.quantity : 0,
              createdAt: addMinutes(scheduledAt, 15),
            },
          })
        }

        if (dispensed) {
          // Completing a dispense marks the source prescription COMPLETED,
          // mirroring what `DispenseService` does.
          await prisma.prescription.update({ where: { id: prescription.id }, data: { status: 'COMPLETED' } })

          if (pharmacyTotal > 0) {
            const unitPrice = money(pharmacyTotal)
            const pharmTotals = computeChargeTotals({ unitPrice, quantity: 1, taxPercent: 12 })
            const pharmCharge = await prisma.charge.create({
              data: {
                organizationId,
                patientId: patient.id,
                encounterId: encounter.id,
                appointmentId: appointment.id,
                sourceModule: 'PHARMACY',
                sourceId: dispenseOrder.id,
                description: 'Pharmacy - medicines dispensed',
                quantity: 1,
                unitPrice,
                taxPercent: 12,
                taxAmount: pharmTotals.taxAmount,
                totalAmount: pharmTotals.totalAmount,
                status: 'PENDING',
                createdByUserId: users.pharmacist ?? doctor.userId,
                createdAt: addMinutes(scheduledAt, 45),
              },
            })
            createdCharges.push({
              id: pharmCharge.id, description: 'Pharmacy - medicines dispensed', quantity: 1,
              unitPrice, taxPercent: 12, totalAmount: pharmTotals.totalAmount, category: 'Pharmacy',
            })
          }
        }
      }

      // ── Invoice, payment, and (where insured) an insurance claim ────────
      // A minority of encounters stay un-invoiced so the "pending charges"
      // sweep on the billing screen has something real to pick up.
      if (createdCharges.length > 0 && chance(0.85)) {
        const subtotal = money(createdCharges.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0))
        const taxAmount = money(createdCharges.reduce((sum, c) => sum + (c.unitPrice * c.quantity * c.taxPercent) / 100, 0))

        // Occasional approved discount, and occasionally one still awaiting a
        // `billing.manage` holder's approval.
        const discountRoll = rnd()
        const hasDiscount = discountRoll < 0.18
        const discountPending = discountRoll >= 0.18 && discountRoll < 0.24
        const discountValue = hasDiscount || discountPending ? pick([5, 10, 15]) : null
        const discountAmount = hasDiscount ? money((subtotal * (discountValue as number)) / 100) : 0
        const totalAmount = money(subtotal - discountAmount + taxAmount)

        // Insurance is decided up front, because it changes what the patient
        // pays: on a settled claim the patient settles only their share in
        // cash and the insurer pays the rest, so the two payments add up to
        // the invoice instead of double-paying it.
        const coverage = insuranceByPatient.get(patient.id)
        const filesClaim = coverage != null && totalAmount > 2000 && chance(0.7)
        const claimStatus = filesClaim
          ? pick(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SETTLED', 'PARTIALLY_APPROVED', 'REJECTED'])
          : null
        const settled = claimStatus === 'SETTLED'
        const insuranceShare = coverage ? money((totalAmount * coverage.coveragePercent) / 100) : 0
        const patientShare = money(totalAmount - insuranceShare)

        // Payment behaviour: mostly settled, some partial, a few outstanding.
        const payRoll = rnd()
        const cashPaid = settled
          ? patientShare
          : payRoll < 0.72 ? totalAmount : payRoll < 0.88 ? money(totalAmount * 0.5) : 0
        const paidAmount = money(cashPaid + (settled ? insuranceShare : 0))
        const balanceDue = money(totalAmount - paidAmount)
        const invoiceStatus = paidAmount === 0 ? 'ISSUED' : balanceDue > 0 ? 'PARTIALLY_PAID' : 'PAID'

        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber: docNumber('INV', ORG_PREFIX),
            patientId: patient.id,
            appointmentId: appointment.id,
            encounterId: encounter.id,
            organizationId,
            status: invoiceStatus as never,
            type: type === 'EMERGENCY' ? 'MISCELLANEOUS' : 'OPD',
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount,
            paidAmount,
            balanceDue,
            currency: 'INR',
            dueDate: addMinutes(scheduledAt, 60 * 24 * 15),
            createdByUserId: users.cashier ?? users.receptionist,
            discountType: discountValue ? 'PERCENTAGE' : null,
            discountValue,
            discountReason: discountValue
              ? pick(['Senior citizen concession', 'Staff relative concession', 'Health camp package rate'])
              : null,
            discountApprovalStatus: hasDiscount ? 'APPROVED' : discountPending ? 'PENDING' : 'NONE',
            discountRequestedByUserId: discountValue ? users.receptionist : null,
            discountApprovedByUserId: hasDiscount ? users.admin : null,
            discountApprovedAt: hasDiscount ? addMinutes(scheduledAt, 50) : null,
            finalizedAt: addMinutes(scheduledAt, 55),
            createdAt: addMinutes(scheduledAt, 50),
            items: {
              create: createdCharges.map((c) => ({
                itemName: c.description,
                category: c.category,
                quantity: c.quantity,
                unitPrice: c.unitPrice,
                taxPercent: c.taxPercent,
                totalPrice: c.totalAmount,
                createdAt: addMinutes(scheduledAt, 50),
              })),
            },
          },
        })
        invoicedPatients.add(patient.id)

        await prisma.charge.updateMany({
          where: { id: { in: createdCharges.map((c) => c.id) } },
          data: { status: 'INVOICED', invoiceId: invoice.id },
        })

        if (cashPaid > 0) {
          const mode = pick(['CASH', 'CARD', 'UPI', 'UPI', 'NEFT'])
          await prisma.payment.create({
            data: {
              paymentNumber: docNumber('PMT', ORG_PREFIX),
              invoiceId: invoice.id,
              patientId: patient.id,
              organizationId,
              amount: cashPaid,
              paymentMode: mode as never,
              transactionId: mode === 'CASH' ? null : `TXN${int(100000000, 999999999)}`,
              referenceNumber: mode === 'UPI' ? `${patient.uhid.toLowerCase()}@upi` : null,
              status: 'COMPLETED',
              collectedBy: users.cashier,
              paidAt: addMinutes(scheduledAt, 60),
              createdAt: addMinutes(scheduledAt, 60),
            },
          })
        }

        // A few refunds, so that screen isn't empty.
        if (paidAmount > 0 && chance(0.05)) {
          const approved = chance(0.6)
          const refundedAt = daysAgo(int(1, 5))
          await prisma.refund.create({
            data: {
              refundNumber: docNumber('REF', ORG_PREFIX),
              organizationId,
              invoiceId: invoice.id,
              amount: money(paidAmount * 0.25),
              reason: pick(['Test cancelled after billing', 'Duplicate charge posted', 'Procedure not performed']),
              refundMode: 'CASH',
              status: approved ? 'COMPLETED' : 'PENDING',
              requestedByUserId: users.cashier ?? users.receptionist,
              approvedByUserId: approved ? users.admin : null,
              approvedAt: approved ? refundedAt : null,
              refundedAt: approved ? refundedAt : null,
              createdAt: addMinutes(scheduledAt, 120),
            },
          })
        }

        // ── Insurance pre-auth + claim for insured patients ───────────────
        if (coverage && filesClaim && claimStatus) {
          const preAuthApproved = chance(0.75)
          const requestedAmount = money(totalAmount * 0.9)
          const preAuth = await prisma.preAuthorization.create({
            data: {
              authNumber: docNumber('PA'),
              organizationId,
              patientId: patient.id,
              encounterId: encounter.id,
              patientInsuranceId: coverage.id,
              status: (preAuthApproved ? 'APPROVED' : pick(['SUBMITTED', 'UNDER_REVIEW', 'REJECTED'])) as never,
              clinicalNotes: complaint.hpi,
              doctorNotes: `Provisional diagnosis: ${complaint.diagnosis}. Cashless approval requested.`,
              requestedAmount,
              approvedAmount: preAuthApproved ? money((requestedAmount * coverage.coveragePercent) / 100) : null,
              submittedAt: addMinutes(scheduledAt, 30),
              decidedAt: preAuthApproved ? addMinutes(scheduledAt, 180) : null,
              decidedByUserId: preAuthApproved ? users.admin : null,
              createdByUserId: users.receptionist,
              createdAt: addMinutes(scheduledAt, 25),
            },
          })

          const claimedAmount = totalAmount
          const approvedAmount = claimStatus === 'APPROVED' || settled
            ? insuranceShare
            : claimStatus === 'PARTIALLY_APPROVED'
              ? money(insuranceShare * 0.7)
              : null
          const settledAt = daysAgo(int(1, 6))

          const claim = await prisma.insuranceClaim.create({
            data: {
              claimNumber: docNumber('CLM'),
              patientId: patient.id,
              invoiceId: invoice.id,
              encounterId: encounter.id,
              organizationId,
              providerId: coverage.providerId,
              planId: coverage.planId,
              patientInsuranceId: coverage.id,
              preAuthorizationId: preAuthApproved ? preAuth.id : null,
              insuranceProvider: coverage.providerName,
              policyNumber: coverage.policyNumber,
              membershipId: coverage.memberId,
              claimedAmount,
              approvedAmount,
              rejectedAmount: claimStatus === 'REJECTED'
                ? claimedAmount
                : claimStatus === 'PARTIALLY_APPROVED'
                  ? money(insuranceShare * 0.3)
                  : null,
              insuranceShare,
              patientShare,
              outstandingAmount: settled ? 0 : approvedAmount ?? claimedAmount,
              paymentStatus: (settled ? 'PAID' : 'PENDING') as never,
              status: claimStatus as never,
              rejectionReason: claimStatus === 'REJECTED'
                ? pick(['Policy waiting period not completed', 'Treatment excluded under the policy', 'Supporting documents insufficient'])
                : null,
              submittedAt: addMinutes(scheduledAt, 200),
              settledAt: settled ? settledAt : null,
              createdByUserId: users.admin,
              createdAt: addMinutes(scheduledAt, 190),
            },
          })

          await prisma.claimDocument.createMany({
            data: [
              {
                claimId: claim.id, organizationId, type: 'INVOICE',
                fileName: `${invoice.invoiceNumber}.pdf`,
                fileUrl: `/uploads/claims/${claim.id}/${invoice.invoiceNumber}.pdf`,
                autoAttached: true, createdAt: addMinutes(scheduledAt, 191),
              },
              {
                claimId: claim.id, organizationId, type: 'ENCOUNTER_SUMMARY',
                fileName: `encounter-summary-${encounter.id.slice(-6)}.pdf`,
                fileUrl: `/uploads/claims/${claim.id}/encounter-summary.pdf`,
                autoAttached: true, createdAt: addMinutes(scheduledAt, 192),
              },
            ],
          })

          // Settlement records a real INSURANCE payment against the invoice,
          // exactly as the settlement workflow does.
          if (settled) {
            await prisma.payment.create({
              data: {
                paymentNumber: docNumber('PMT', ORG_PREFIX),
                invoiceId: invoice.id,
                patientId: patient.id,
                organizationId,
                amount: insuranceShare,
                paymentMode: 'INSURANCE',
                referenceNumber: claim.claimNumber,
                status: 'COMPLETED',
                collectedBy: users.admin,
                paidAt: settledAt,
                createdAt: settledAt,
              },
            })
          }
        }
      }

      completedEncounters.push({ id: encounter.id, patientId: patient.id, doctorId: doctor.id, date: scheduledAt })
    }
  }

  return { completedEncounters, invoicedPatients }
}
