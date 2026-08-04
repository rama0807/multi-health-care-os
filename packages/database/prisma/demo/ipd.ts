import { PrismaClient } from '@prisma/client'

import type { DemoContext } from './foundation'
import { COMPLAINTS, PRESCRIBING_PATTERNS } from './reference-data'
import {
  addHours,
  bradenRiskLevel,
  chance,
  computeChargeTotals,
  daysAgo,
  daysFromNow,
  fallRiskLevel,
  int,
  docNumber,
  pick,
  pickMany,
  rnd,
} from './helpers'

const ORG_PREFIX = 'MED'

const CHECKLIST_KEYS = [
  'VITALS_STABLE',
  'MEDICATION_RECONCILIATION_DONE',
  'PATIENT_EDUCATION_GIVEN',
  'BELONGINGS_RETURNED',
  'WOUND_CARE_INSTRUCTIONS_GIVEN',
  'EQUIPMENT_RETURNED',
  'FOLLOWUP_EXPLAINED',
  'TRANSPORT_ARRANGED',
] as const

/** Bed type → room-charge catalog code, so each stay bills its real tariff. */
const ROOM_CHARGE_CODE: Record<string, string> = {
  GENERAL: 'ROOM-GEN',
  SEMI_PRIVATE: 'ROOM-SEMI',
  PRIVATE: 'ROOM-PVT',
  ICU: 'ROOM-ICU',
}

/**
 * Seeds inpatient activity: current inpatients occupying real beds, plus a
 * set of completed stays that ran the full discharge workflow (approval →
 * nursing checklist → summary → finalise, with a per-stay room charge raised
 * through the Charge Engine).
 */
export async function seedIpd(prisma: PrismaClient, ctx: DemoContext): Promise<void> {
  const { organizationId, users, doctors, patients, beds, serviceCatalog } = ctx

  const insuranceByPatient = new Map(ctx.patientInsurances.map((i) => [i.patientId, i]))
  const admittingDoctors = doctors.filter((d) => d.specialization !== 'Radiodiagnosis')

  const CURRENT_COUNT = 14
  const DISCHARGED_COUNT = 10

  // Distinct patients and beds, so no two admissions collide on either.
  const admissionPatients = pickMany(patients, CURRENT_COUNT + DISCHARGED_COUNT)
  const usedBeds = pickMany(beds, CURRENT_COUNT + DISCHARGED_COUNT)

  for (let i = 0; i < admissionPatients.length; i += 1) {
    const patient = admissionPatients[i]
    const bed = usedBeds[i]
    if (!patient || !bed) continue

    const isCurrent = i < CURRENT_COUNT
    const doctor = pick(admittingDoctors)
    const relevant = COMPLAINTS.filter((c) => c.specialities.includes(doctor.specialization))
    const complaint = relevant.length > 0 ? pick(relevant) : pick(COMPLAINTS)

    const lengthOfStay = isCurrent ? int(1, 9) : int(2, 11)
    const admittedAt = isCurrent ? daysAgo(lengthOfStay) : daysAgo(lengthOfStay + int(1, 14))
    const dischargedAt = isCurrent ? null : addHours(admittedAt, lengthOfStay * 24)

    const coverage = insuranceByPatient.get(patient.id)
    const admissionType = coverage && chance(0.5)
      ? 'INSURANCE'
      : doctor.specialization === 'Emergency Medicine'
        ? 'EMERGENCY'
        : pick(['SCHEDULED', 'SCHEDULED', 'TRANSFER_FROM_OPD'])

    // Every admission gets its own IPD encounter, as `AdmissionsService` does.
    const encounter = await prisma.encounter.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        organizationId,
        type: 'IPD',
        status: isCurrent ? 'IN_PROGRESS' : 'COMPLETED',
        notes: `Inpatient admission — ${complaint.diagnosis}.`,
        encounterDate: admittedAt,
        createdAt: admittedAt,
      },
    })

    const admission = await prisma.admission.create({
      data: {
        admissionNumber: docNumber('ADM', ORG_PREFIX),
        patientId: patient.id,
        encounterId: encounter.id,
        attendingDoctorId: doctor.id,
        departmentId: doctor.departmentId,
        wardId: bed.wardId,
        roomId: bed.roomId,
        bedId: bed.id,
        patientInsuranceId: admissionType === 'INSURANCE' ? coverage?.id : null,
        organizationId,
        type: admissionType as never,
        status: isCurrent ? 'ADMITTED' : 'DISCHARGED',
        admissionReason: complaint.complaint,
        diagnosis: complaint.diagnosis,
        admittedAt,
        expectedDischargeAt: isCurrent ? daysFromNow(int(1, 4)) : addHours(admittedAt, lengthOfStay * 24),
        dischargedAt,
        dischargeNotes: dischargedAt ? 'Discharged in a stable condition with advice on medication and follow-up.' : null,
        dischargeCondition: dischargedAt ? pick(['Improved', 'Recovered', 'Stable']) : null,
        createdByUserId: users.receptionist ?? users.admin,
        createdAt: admittedAt,
      },
    })

    // Bed allocation history, and the bed's own status.
    await prisma.bedAllocation.create({
      data: {
        admissionId: admission.id,
        bedId: bed.id,
        organizationId,
        action: 'ALLOCATED',
        performedByUserId: users.nurse ?? users.admin,
        reason: 'Admission',
        occurredAt: admittedAt,
      },
    })

    if (isCurrent) {
      await prisma.bed.update({ where: { id: bed.id }, data: { status: 'OCCUPIED' } })
    } else {
      await prisma.bedAllocation.create({
        data: {
          admissionId: admission.id,
          bedId: bed.id,
          organizationId,
          action: 'VACATED',
          performedByUserId: users.nurse ?? users.admin,
          reason: 'Discharge',
          occurredAt: dischargedAt as Date,
        },
      })
    }

    // ── Nursing documentation across the stay ─────────────────────────────
    const shiftsToChart = Math.min(lengthOfStay * 2, 10)
    for (let s = 0; s < shiftsToChart; s += 1) {
      const chartedAt = addHours(admittedAt, s * 12 + 2)
      if (chartedAt > new Date()) break

      const escalated = chance(0.08)
      await prisma.nursingNote.create({
        data: {
          admissionId: admission.id,
          organizationId,
          type: s % 2 === 0 ? 'SHIFT_HANDOVER' : 'GENERAL',
          shift: (s % 2 === 0 ? 'MORNING' : 'NIGHT') as never,
          content: escalated
            ? 'Patient complained of increasing pain and appeared restless through the shift. Vitals rechecked, duty doctor informed.'
            : pick([
              'Patient comfortable through the shift. Vitals stable, intake and output adequate, medications given as charted.',
              'Ambulated with support to the washroom. Tolerating orally. No fresh complaints.',
              'Dressing checked and found dry and intact. Pain well controlled on the current analgesia.',
              'Slept well overnight. No episodes of vomiting or breathlessness reported.',
            ]),
          isEscalated: escalated,
          escalationReason: escalated ? 'Uncontrolled pain — physician review requested.' : null,
          createdByUserId: users.nurse ?? users.admin,
          createdAt: chartedAt,
        },
      })

      // Scores and their derived risk bands are computed the same way the
      // nursing assessment service computes them.
      const fallScore = int(5, 65)
      const bradenScore = int(9, 22)
      const gcsEye = int(3, 4)
      const gcsVerbal = int(4, 5)
      const gcsMotor = int(5, 6)
      await prisma.nursingAssessment.create({
        data: {
          admissionId: admission.id,
          organizationId,
          painScore: int(0, 7),
          fallRiskScore: fallScore,
          fallRiskLevel: fallRiskLevel(fallScore) as never,
          bradenScore,
          bradenRiskLevel: bradenRiskLevel(bradenScore) as never,
          gcsEye,
          gcsVerbal,
          gcsMotor,
          gcsTotal: gcsEye + gcsVerbal + gcsMotor,
          generalNotes: 'Routine shift assessment completed. Skin intact, no pressure areas noted.',
          assessedByUserId: users.nurse ?? users.admin,
          assessedAt: chartedAt,
        },
      })

      await prisma.intakeOutputRecord.create({
        data: {
          admissionId: admission.id,
          organizationId,
          recordedAt: chartedAt,
          oralIntakeMl: int(200, 900),
          ivFluidIntakeMl: int(0, 1000),
          otherIntakeMl: chance(0.2) ? int(50, 200) : 0,
          urineOutputMl: int(300, 1200),
          stoolOutputCount: int(0, 2),
          vomitusMl: chance(0.15) ? int(50, 250) : 0,
          drainOutputMl: chance(0.1) ? int(20, 150) : 0,
          otherOutputMl: 0,
          notes: 'Charted at end of shift.',
          recordedByUserId: users.nurse ?? users.admin,
        },
      })
    }

    // ── Doctor's IPD orders, and the nursing tasks they spawn ─────────────
    const orderSpecs: Array<{ category: string; instructions: string }> = [
      { category: 'DIET', instructions: pick(['Soft diet, low salt.', 'Diabetic diet, 1800 kcal per day.', 'Nil by mouth until further review.', 'Normal diet as tolerated.']) },
      { category: 'FLUID', instructions: 'IV fluids — Normal Saline 500 mL over 8 hours, review daily.' },
      { category: 'ACTIVITY', instructions: pick(['Complete bed rest.', 'Ambulate with support twice daily.', 'Bed rest with bathroom privileges.']) },
    ]
    if (bed.type === 'ICU' || chance(0.3)) {
      orderSpecs.push({ category: 'OXYGEN', instructions: 'Oxygen at 2 L/min via nasal prongs, maintain SpO2 above 94%.' })
    }
    if (chance(0.15)) {
      orderSpecs.push({ category: 'ISOLATION', instructions: 'Contact precautions until culture reports are available.' })
    }

    for (const spec of orderSpecs) {
      const order = await prisma.ipdOrder.create({
        data: {
          admissionId: admission.id,
          organizationId,
          category: spec.category as never,
          instructions: spec.instructions,
          status: isCurrent ? 'ACTIVE' : 'COMPLETED',
          orderedByUserId: doctor.userId,
          startedAt: admittedAt,
          discontinuedAt: isCurrent ? null : dischargedAt,
          createdAt: admittedAt,
        },
      })

      // Each order spawns a nursing task; many current ones are still pending
      // so the nursing queue and the "pending tasks" tile are populated.
      const taskPending = isCurrent && chance(0.55)
      const dueAt = addHours(new Date(), taskPending ? int(-4, 8) : -int(10, 60))
      const label = spec.category.charAt(0) + spec.category.slice(1).toLowerCase()
      await prisma.nursingTask.create({
        data: {
          admissionId: admission.id,
          organizationId,
          sourceOrderId: order.id,
          title: `${label} order — ${patient.name}`,
          description: spec.instructions,
          priority: (spec.category === 'OXYGEN' ? 'STAT' : chance(0.2) ? 'URGENT' : 'ROUTINE') as never,
          dueAt,
          status: (taskPending ? pick(['PENDING', 'PENDING', 'IN_PROGRESS']) : 'COMPLETED') as never,
          assignedToUserId: users.nurse,
          completedByUserId: taskPending ? null : users.nurse,
          completedAt: taskPending ? null : dueAt,
          completionNotes: taskPending ? null : 'Carried out as ordered.',
          createdByUserId: doctor.userId,
          createdAt: admittedAt,
        },
      })
    }

    // ── Inpatient prescription + MAR ──────────────────────────────────────
    const pattern = PRESCRIBING_PATTERNS[complaint.diagnosis] ?? PRESCRIBING_PATTERNS['Acute viral febrile illness']
    const prescription = await prisma.prescription.create({
      data: {
        prescriptionNumber: docNumber('RX', ORG_PREFIX),
        patientId: patient.id,
        doctorId: doctor.id,
        encounterId: encounter.id,
        organizationId,
        status: isCurrent ? 'ACTIVE' : 'COMPLETED',
        notes: 'Inpatient medication chart.',
        prescribedAt: admittedAt,
        createdAt: admittedAt,
        items: {
          create: pattern.map((item) => ({
            medicationName: item.brand,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            route: item.route,
            instructions: item.instructions,
            quantity: lengthOfStay * 2,
            createdAt: admittedAt,
          })),
        },
      },
      include: { items: true },
    })

    for (const item of prescription.items) {
      // One MAR row per scheduled dose across the stay, capped so a long
      // stay doesn't generate an unusable wall of rows.
      const dosesPerDay = item.frequency.startsWith('TDS') ? 3 : item.frequency.startsWith('BD') ? 2 : 1
      const isPrn = item.frequency.startsWith('SOS')
      const totalDoses = Math.min(isPrn ? 3 : dosesPerDay * lengthOfStay, 12)

      for (let d = 0; d < totalDoses; d += 1) {
        const scheduledFor = addHours(admittedAt, 8 + d * Math.floor(24 / dosesPerDay))
        const isFuture = scheduledFor > new Date()

        let marStatus: string
        if (isFuture) {
          marStatus = 'PENDING'
        } else {
          const roll = rnd()
          marStatus = roll < 0.85 ? 'ADMINISTERED' : roll < 0.9 ? 'REFUSED' : roll < 0.95 ? 'HELD' : 'MISSED'
        }
        const administered = marStatus === 'ADMINISTERED'
        const verified = administered && chance(0.6)

        await prisma.medicationAdministration.create({
          data: {
            admissionId: admission.id,
            prescriptionItemId: item.id,
            organizationId,
            type: (isPrn ? 'PRN' : 'SCHEDULED') as never,
            scheduledAt: scheduledFor,
            administeredAt: administered ? addHours(scheduledFor, rnd() * 0.5) : null,
            status: marStatus as never,
            doseGiven: administered ? item.dosage : null,
            route: item.route,
            notes: marStatus === 'REFUSED'
              ? 'Patient refused the dose — duty doctor informed.'
              : marStatus === 'HELD'
                ? 'Held on the doctor’s instruction, pending review.'
                : marStatus === 'MISSED'
                  ? 'Dose missed — patient was away for an investigation.'
                  : null,
            barcodeVerified: verified,
            scannedCode: verified ? `MED-${item.id.slice(-8).toUpperCase()}` : null,
            administeredByUserId: administered ? users.nurse : null,
            nurseSignature: administered ? 'Nurse on duty' : null,
            createdByUserId: doctor.userId,
            createdAt: admittedAt,
          },
        })
      }
    }

    // ── Discharge ─────────────────────────────────────────────────────────
    // Two current inpatients are left "pending discharge": approved by the
    // doctor, nursing checklist part-done, not yet finalised.
    const pendingDischarge = isCurrent && i >= CURRENT_COUNT - 2

    if (pendingDischarge || !isCurrent) {
      const approvedAt = isCurrent ? addHours(new Date(), -12) : addHours(dischargedAt as Date, -6)

      await prisma.admission.update({
        where: { id: admission.id },
        data: { dischargeApprovedAt: approvedAt, dischargeApprovedByUserId: doctor.userId },
      })

      for (const key of CHECKLIST_KEYS) {
        // A finalised discharge has every item complete (the service refuses
        // to finalise otherwise); a pending one is still part-way through.
        const completed = !isCurrent || chance(0.5)
        await prisma.dischargeChecklistItem.create({
          data: {
            admissionId: admission.id,
            organizationId,
            itemKey: key as never,
            completed,
            completedByUserId: completed ? users.nurse : null,
            completedAt: completed ? approvedAt : null,
            createdAt: approvedAt,
          },
        })
      }

      const followUpAt = isCurrent ? daysFromNow(int(5, 14)) : addHours(dischargedAt as Date, 24 * int(5, 14))
      const dischargeRx = await prisma.prescription.create({
        data: {
          prescriptionNumber: docNumber('RX', ORG_PREFIX),
          patientId: patient.id,
          doctorId: doctor.id,
          encounterId: encounter.id,
          organizationId,
          status: 'ACTIVE',
          notes: 'Discharge medication.',
          prescribedAt: approvedAt,
          createdAt: approvedAt,
          items: {
            create: pattern.slice(0, 2).map((item) => ({
              medicationName: item.brand,
              dosage: item.dosage,
              frequency: item.frequency,
              duration: '7 days',
              route: item.route,
              instructions: item.instructions,
              quantity: 14,
              createdAt: approvedAt,
            })),
          },
        },
      })

      await prisma.dischargeSummary.create({
        data: {
          admissionId: admission.id,
          organizationId,
          finalDiagnosis: complaint.diagnosis,
          courseInHospital: `Admitted with ${complaint.complaint.toLowerCase()}. Managed with intravenous fluids, antibiotics and supportive care. Symptoms settled progressively; the patient remained afebrile and haemodynamically stable over the last 24 hours.`,
          proceduresPerformed: chance(0.4)
            ? pick(['Intravenous cannulation and fluid therapy.', 'Wound debridement and dressing.', 'Urinary catheterisation.'])
            : 'Nil.',
          conditionAtDischarge: pick(['Stable and ambulatory.', 'Improved, tolerating orally.', 'Recovered.']),
          medicationReconciliation: 'Home medication reviewed against the inpatient chart. Discharge prescription issued and explained to the patient and attendant.',
          followUpInstructions: 'Review in the outpatient department with the discharge summary and all reports. Return sooner if fever recurs, pain worsens, or oral intake drops.',
          followUpAppointmentAt: followUpAt,
          followUpDoctorId: doctor.id,
          dischargePrescriptionId: dischargeRx.id,
          preparedByUserId: doctor.userId,
          createdAt: approvedAt,
        },
      })
    }

    // Finalised discharges raise a real per-stay room charge through the
    // Charge Engine, exactly as `completeDischarge` does.
    if (!isCurrent) {
      const service = serviceCatalog.get(ROOM_CHARGE_CODE[bed.type] ?? 'ROOM-GEN')
      if (service) {
        const totals = computeChargeTotals({ unitPrice: service.price, quantity: lengthOfStay, taxPercent: service.taxPercent })
        await prisma.charge.create({
          data: {
            organizationId,
            patientId: patient.id,
            encounterId: encounter.id,
            sourceModule: 'IPD',
            sourceId: admission.id,
            catalogItemId: service.id,
            description: `${service.name} — ${lengthOfStay} day(s), bed ${bed.bedNumber}`,
            quantity: lengthOfStay,
            unitPrice: service.price,
            taxPercent: service.taxPercent,
            taxAmount: totals.taxAmount,
            totalAmount: totals.totalAmount,
            status: 'PENDING',
            createdByUserId: doctor.userId,
            createdAt: dischargedAt as Date,
          },
        })
      }
    }
  }

  // ── A couple of intra-stay bed transfers (ICU step-down) ────────────────
  const currentAdmissions = await prisma.admission.findMany({
    where: { organizationId, status: 'ADMITTED' },
    take: 2,
    orderBy: { admittedAt: 'asc' },
  })
  const spareBeds = beds.filter((b) => !usedBeds.some((u) => u.id === b.id)).slice(0, currentAdmissions.length)

  for (let t = 0; t < currentAdmissions.length && t < spareBeds.length; t += 1) {
    const adm = currentAdmissions[t]
    const target = spareBeds[t]
    if (!adm.bedId) continue

    const transferredAt = addHours(adm.admittedAt, 36)
    await prisma.bedTransfer.create({
      data: {
        admissionId: adm.id,
        organizationId,
        fromBedId: adm.bedId,
        toBedId: target.id,
        fromRoomId: adm.roomId,
        toRoomId: target.roomId,
        fromWardId: adm.wardId,
        toWardId: target.wardId,
        reason: 'Step-down from intensive care to the ward following clinical improvement.',
        transferredByUserId: users.nurse ?? users.admin,
        transferredAt,
      },
    })
    await prisma.bedAllocation.createMany({
      data: [
        {
          admissionId: adm.id, bedId: adm.bedId, organizationId, action: 'VACATED',
          performedByUserId: users.nurse ?? users.admin, reason: 'Transferred out', occurredAt: transferredAt,
        },
        {
          admissionId: adm.id, bedId: target.id, organizationId, action: 'ALLOCATED',
          performedByUserId: users.nurse ?? users.admin, reason: 'Transferred in', occurredAt: transferredAt,
        },
      ],
    })
    await prisma.bed.update({ where: { id: adm.bedId }, data: { status: 'CLEANING' } })
    await prisma.bed.update({ where: { id: target.id }, data: { status: 'OCCUPIED' } })
    await prisma.admission.update({
      where: { id: adm.id },
      data: { bedId: target.id, roomId: target.roomId, wardId: target.wardId },
    })
  }

  // One reserved bed, so the bed grid exercises every status the UI renders.
  const reservable = beds.find(
    (b) => !usedBeds.some((u) => u.id === b.id) && !spareBeds.some((s) => s.id === b.id),
  )
  if (reservable) {
    await prisma.bed.update({ where: { id: reservable.id }, data: { status: 'RESERVED' } })
  }
}
