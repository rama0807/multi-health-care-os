import { ScheduleShiftSchema } from '@medicore/types'
import { Prisma, PrismaClient } from '@prisma/client'
import * as argon2 from 'argon2'

import {
  BLOOD_GROUPS,
  DOCTOR_SPECS,
  DRUGS,
  EXTRA_DEPARTMENTS,
  FIRST_NAMES_FEMALE,
  FIRST_NAMES_MALE,
  INSURANCE_PROVIDERS,
  LAB_CATALOG,
  LAST_NAMES,
  MUMBAI_LOCALITIES,
  RADIOLOGY_CATALOG,
  SERVICE_CATALOG,
  WARD_LAYOUT,
} from './reference-data'
import { NOW, YEAR, chance, daysAgo, daysFromNow, int, pick, pickMany, rnd } from './helpers'

export const DEMO_PASSWORD = 'Demo@12345'

export interface DemoDoctor {
  id: string
  userId: string
  name: string
  specialization: string
  departmentId: string | null
  departmentCode: string
  consultationFee: number
}

export interface DemoPatient {
  id: string
  uhid: string
  name: string
  gender: 'MALE' | 'FEMALE'
  dateOfBirth: Date
  heightCm: number
  baseWeightKg: number
}

export interface DemoBed {
  id: string
  bedNumber: string
  roomId: string
  wardId: string
  wardCode: string
  type: string
  chargesPerDay: number
}

export interface DemoInsurance {
  id: string
  patientId: string
  providerId: string
  providerName: string
  planId: string
  policyNumber: string
  memberId: string
  coveragePercent: number
}

export interface DemoContext {
  organizationId: string
  hospitalId: string
  departmentsByCode: Map<string, string>
  users: Record<string, string>
  doctors: DemoDoctor[]
  doctorsBySpeciality: Map<string, DemoDoctor[]>
  patients: DemoPatient[]
  labCatalog: Array<{ id: string; testCode: string }>
  radiologyCatalog: Array<{ id: string; code: string }>
  serviceCatalog: Map<string, { id: string; name: string; price: number; taxPercent: number; category: string }>
  drugs: Array<{ id: string; brandName: string | null; genericName: string; price: number; taxPercent: number }>
  beds: DemoBed[]
  patientInsurances: DemoInsurance[]
}

/**
 * Everything the clinical/IPD/inventory seeders build on: staff, patients,
 * the four configurable catalogs, the ward→room→bed inventory, and insurance
 * coverage. Assumes the base seed (`seed.ts`) has already run.
 */
export async function seedFoundation(
  prisma: PrismaClient,
  organizationId: string,
  hospitalId: string,
): Promise<DemoContext> {
  // ── Departments (base seed provides GENMED/CARDIO/EMRG/LAB) ─────────────
  for (const dept of EXTRA_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code_hospitalId: { code: dept.code, hospitalId } },
      update: {},
      create: { code: dept.code, name: dept.name, hospitalId, organizationId },
    })
  }
  const departments = await prisma.department.findMany({ where: { organizationId } })
  const departmentsByCode = new Map(departments.map((d) => [d.code, d.id]))

  // ── Staff users created by the base seed, looked up by email ────────────
  const staffEmails = [
    'admin@medicore.demo', 'doctor@medicore.demo', 'nurse@medicore.demo',
    'receptionist@medicore.demo', 'labtech@medicore.demo', 'radiologytech@medicore.demo',
    'pharmacist@medicore.demo', 'cashier@medicore.demo', 'hr@medicore.demo',
    'inventorymanager@medicore.demo',
  ]
  const staffUsers = await prisma.user.findMany({ where: { email: { in: staffEmails } } })
  const users: Record<string, string> = {}
  for (const u of staffUsers) users[u.email.split('@')[0]] = u.id

  // ── Doctors ─────────────────────────────────────────────────────────────
  const doctorRole = await prisma.role.findFirst({ where: { organizationId, systemRole: 'DOCTOR' } })
  const passwordHash = await argon2.hash(DEMO_PASSWORD)

  for (const spec of DOCTOR_SPECS) {
    const user = await prisma.user.upsert({
      where: { email: spec.email },
      update: {},
      create: {
        email: spec.email,
        passwordHash,
        firstName: spec.firstName,
        lastName: spec.lastName,
        phone: `98${int(20000000, 29999999)}`,
        status: 'ACTIVE',
        isEmailVerified: true,
        organizationId,
        userRoles: doctorRole ? { create: [{ roleId: doctorRole.id, hospitalId }] } : undefined,
      },
    })

    const joiningDate = new Date(NOW)
    joiningDate.setFullYear(joiningDate.getFullYear() - spec.joiningYearsAgo)

    await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        organizationId,
        hospitalId,
        departmentId: departmentsByCode.get(spec.departmentCode),
        registrationNumber: spec.registrationNumber,
        specialization: spec.specialization,
        subSpecialization: spec.subSpecialization,
        qualification: spec.qualification,
        experienceYears: spec.experienceYears,
        languagesSpoken: spec.languages,
        bio: spec.bio,
        consultationFee: spec.consultationFee,
        availabilityStatus: 'AVAILABLE',
        joiningDate,
      },
    })
  }

  const doctorRows = await prisma.doctor.findMany({
    where: { organizationId },
    include: { user: true, department: true },
  })
  const doctors: DemoDoctor[] = doctorRows.map((d) => ({
    id: d.id,
    userId: d.userId,
    name: `Dr. ${d.user.firstName} ${d.user.lastName}`,
    specialization: d.specialization,
    departmentId: d.departmentId,
    departmentCode: d.department?.code ?? 'GENMED',
    consultationFee: Number(d.consultationFee),
  }))

  const doctorsBySpeciality = new Map<string, DemoDoctor[]>()
  for (const doc of doctors) {
    const list = doctorsBySpeciality.get(doc.specialization) ?? []
    list.push(doc)
    doctorsBySpeciality.set(doc.specialization, list)
  }

  // ── Weekly schedules (Mon–Sat morning + evening OPD, Sunday off) ────────
  const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const
  // Parsed through the canonical schema rather than cast straight to
  // InputJsonValue: `shifts` is an untyped Json column, so a blind cast lets
  // the seed write a shape the application cannot read (this previously
  // seeded `start`/`end` instead of `startTime`/`endTime`, which made every
  // availability read throw). Validating here fails the seed loudly instead.
  const shifts = ScheduleShiftSchema.array().parse([
    {
      startTime: '09:00',
      endTime: '13:00',
      slotDurationMinutes: 15,
      breaks: [{ startTime: '11:00', endTime: '11:15' }],
    },
    { startTime: '17:00', endTime: '20:00', slotDurationMinutes: 15, breaks: [] },
  ]) as unknown as Prisma.InputJsonValue

  for (const doc of doctors) {
    const schedule = await prisma.doctorSchedule.create({
      data: { doctorId: doc.id, organizationId, effectiveFrom: new Date(YEAR, 0, 1), isActive: true },
    })
    await prisma.doctorScheduleDay.createMany({
      data: [
        ...WEEKDAYS.map((day) => ({ scheduleId: schedule.id, dayOfWeek: day, isWorkingDay: true, shifts })),
        {
          scheduleId: schedule.id,
          dayOfWeek: 'SUNDAY' as const,
          isWorkingDay: false,
          shifts: [] as unknown as Prisma.InputJsonValue,
        },
      ],
    })
  }

  // A few realistic leave records so the leave/availability screens have
  // approved, pending and historical rows to show.
  await prisma.doctorLeave.createMany({
    data: [
      {
        doctorId: doctors[1].id, organizationId, leaveType: 'CONFERENCE',
        startDate: daysFromNow(9), endDate: daysFromNow(11),
        reason: 'Attending the annual national cardiology update',
        status: 'APPROVED', appliedByUserId: doctors[1].userId,
        decidedByUserId: users.admin, decidedAt: daysAgo(3),
      },
      {
        doctorId: doctors[2].id, organizationId, leaveType: 'CASUAL',
        startDate: daysFromNow(4), endDate: daysFromNow(4),
        reason: 'Personal work', status: 'PENDING', appliedByUserId: doctors[2].userId,
      },
      {
        doctorId: doctors[3].id, organizationId, leaveType: 'SICK',
        startDate: daysAgo(12), endDate: daysAgo(10),
        reason: 'Viral fever', status: 'APPROVED', appliedByUserId: doctors[3].userId,
        decidedByUserId: users.admin, decidedAt: daysAgo(13),
      },
    ],
  })

  // ── Patients ────────────────────────────────────────────────────────────
  const PATIENT_COUNT = 48
  const patients: DemoPatient[] = []

  for (let i = 0; i < PATIENT_COUNT; i += 1) {
    const isFemale = chance(0.5)
    const firstName = isFemale ? pick(FIRST_NAMES_FEMALE) : pick(FIRST_NAMES_MALE)
    const lastName = pick(LAST_NAMES)
    const locality = pick(MUMBAI_LOCALITIES)

    // A realistic age mix: mostly adults, some children, some elderly.
    const ageBand = rnd()
    const age = ageBand < 0.15 ? int(1, 14) : ageBand < 0.75 ? int(19, 59) : int(60, 88)
    const dateOfBirth = new Date(NOW)
    dateOfBirth.setFullYear(dateOfBirth.getFullYear() - age)
    dateOfBirth.setMonth(int(0, 11), int(1, 28))
    dateOfBirth.setHours(0, 0, 0, 0)

    const heightCm = age < 15 ? int(80, 160) : isFemale ? int(148, 168) : int(158, 182)
    const baseWeightKg = age < 15 ? int(10, 50) : isFemale ? int(45, 82) : int(55, 95)

    const patient = await prisma.patient.create({
      data: {
        uhid: `MED-${YEAR}-${String(i + 1).padStart(6, '0')}`,
        firstName,
        lastName,
        email: chance(0.65) ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com` : null,
        phone: `98${String(76500000 + i * 137).padStart(8, '0')}`,
        dateOfBirth,
        gender: isFemale ? 'FEMALE' : 'MALE',
        bloodGroup: chance(0.8) ? pick(BLOOD_GROUPS) : null,
        address: `${int(1, 60)}, ${pick(['Sai', 'Ganga', 'Shanti', 'Krishna', 'Vasant', 'Anand'])} ${pick(['Apartments', 'Nivas', 'CHS', 'Residency', 'Towers'])}`,
        city: locality.area.includes('Navi Mumbai') ? 'Navi Mumbai' : locality.area.includes('Thane') ? 'Thane' : 'Mumbai',
        state: 'Maharashtra',
        country: 'IN',
        pincode: locality.pincode,
        emergencyContactName: `${pick(FIRST_NAMES_MALE)} ${lastName}`,
        emergencyContactPhone: `99${String(30000000 + i * 211).padStart(8, '0')}`,
        organizationId,
        // Registration spread over the last two years, so the patient list
        // isn't one uniform block of same-day registrations.
        createdAt: daysAgo(int(1, 700)),
      },
    })

    patients.push({
      id: patient.id,
      uhid: patient.uhid,
      name: `${firstName} ${lastName}`,
      gender: isFemale ? 'FEMALE' : 'MALE',
      dateOfBirth,
      heightCm,
      baseWeightKg,
    })
  }

  // ── Laboratory catalog ──────────────────────────────────────────────────
  const labCatalog: Array<{ id: string; testCode: string }> = []
  for (const test of LAB_CATALOG) {
    const row = await prisma.labTestCatalogItem.create({
      data: {
        organizationId,
        testCode: test.testCode,
        testName: test.testName,
        category: test.category,
        unit: test.unit,
        referenceRangeLow: test.low,
        referenceRangeHigh: test.high,
        referenceRangeText: test.text,
        criticalLow: test.criticalLow,
        criticalHigh: test.criticalHigh,
      },
    })
    labCatalog.push({ id: row.id, testCode: row.testCode })
  }

  // ── Radiology catalog ───────────────────────────────────────────────────
  const radiologyCatalog: Array<{ id: string; code: string }> = []
  for (const study of RADIOLOGY_CATALOG) {
    const row = await prisma.radiologyCatalogItem.create({
      data: {
        organizationId,
        code: study.code,
        name: study.name,
        category: study.category,
        modality: study.modality,
        bodyPart: study.bodyPart,
        contrastRequired: study.contrastRequired,
        price: study.price,
        estimatedDurationMinutes: study.durationMinutes,
      },
    })
    radiologyCatalog.push({ id: row.id, code: row.code })
  }

  // ── Billing service catalog ─────────────────────────────────────────────
  const serviceCatalog = new Map<string, { id: string; name: string; price: number; taxPercent: number; category: string }>()
  for (const service of SERVICE_CATALOG) {
    const row = await prisma.serviceCatalogItem.create({
      data: {
        organizationId,
        code: service.code,
        name: service.name,
        category: service.category,
        price: service.price,
        taxPercent: service.taxPercent,
      },
    })
    serviceCatalog.set(service.code, {
      id: row.id, name: row.name, price: service.price,
      taxPercent: service.taxPercent, category: service.category,
    })
  }

  // ── Pharmacy catalog — one row per batch (ADR-0014) ─────────────────────
  const drugs: DemoContext['drugs'] = []
  for (let i = 0; i < DRUGS.length; i += 1) {
    const spec = DRUGS[i]
    // Most batches have healthy shelf life; a few are near expiry and one or
    // two already expired, so the "expiring medicines" dashboard tile and
    // the expiry filter both have real rows to show.
    const expiryRoll = rnd()
    const expiryDate = expiryRoll < 0.08
      ? daysAgo(int(5, 40))
      : expiryRoll < 0.22
        ? daysFromNow(int(10, 75))
        : daysFromNow(int(200, 900))

    // Likewise, a handful of batches sit below their reorder level.
    const currentStock = rnd() < 0.18 ? int(5, 70) : int(180, 1400)
    const reservedStock = chance(0.25) ? int(1, Math.min(20, currentStock)) : 0

    const row = await prisma.drug.create({
      data: {
        organizationId,
        genericName: spec.genericName,
        brandName: spec.brandName,
        strength: spec.strength,
        dosageForm: spec.dosageForm,
        manufacturer: spec.manufacturer,
        batchNumber: `B${YEAR % 100}${String(1000 + i * 7).slice(-4)}`,
        expiryDate,
        price: spec.price,
        taxPercent: spec.taxPercent,
        currentStock,
        reservedStock,
        minStockLevel: 40,
        reorderLevel: 80,
        isActive: true,
      },
    })
    drugs.push({
      id: row.id, brandName: row.brandName, genericName: row.genericName,
      price: spec.price, taxPercent: spec.taxPercent,
    })
  }

  // ── Wards → Rooms → Beds ────────────────────────────────────────────────
  const beds: DemoBed[] = []
  for (const wardSpec of WARD_LAYOUT) {
    const ward = await prisma.ward.create({
      data: {
        organizationId,
        name: wardSpec.name,
        code: wardSpec.code,
        floor: wardSpec.floor,
        block: wardSpec.block,
        type: wardSpec.type as never,
        departmentId: departmentsByCode.get(wardSpec.departmentCode),
        status: 'ACTIVE',
      },
    })

    for (let r = 1; r <= wardSpec.rooms; r += 1) {
      const roomNumber = `${wardSpec.floor}${String(r).padStart(2, '0')}`
      const room = await prisma.room.create({
        data: {
          organizationId,
          wardId: ward.id,
          roomNumber,
          floor: wardSpec.floor,
          capacity: wardSpec.bedsPerRoom,
          chargesPerDay: wardSpec.chargesPerDay,
          status: 'ACTIVE',
        },
      })

      for (let b = 1; b <= wardSpec.bedsPerRoom; b += 1) {
        // A small number of beds are out of service — the bed grid should
        // not be uniformly available.
        const statusRoll = rnd()
        const status = statusRoll < 0.04 ? 'MAINTENANCE' : statusRoll < 0.09 ? 'CLEANING' : 'AVAILABLE'
        const bed = await prisma.bed.create({
          data: {
            organizationId,
            roomId: room.id,
            wardId: ward.id,
            bedNumber: `${wardSpec.code}-${roomNumber}-${b}`,
            type: wardSpec.bedType as never,
            status,
          },
        })
        if (status === 'AVAILABLE') {
          beds.push({
            id: bed.id, bedNumber: bed.bedNumber, roomId: room.id, wardId: ward.id,
            wardCode: wardSpec.code, type: wardSpec.bedType, chargesPerDay: wardSpec.chargesPerDay,
          })
        }
      }
    }
  }

  // ── Insurance providers, plans, and patient coverage ────────────────────
  const planRows: Array<{ id: string; providerId: string; providerName: string; coveragePercent: number }> = []
  for (const provider of INSURANCE_PROVIDERS) {
    const providerRow = await prisma.insuranceProvider.create({
      data: {
        organizationId,
        name: provider.name,
        code: provider.code,
        type: provider.type as never,
        contactPerson: provider.contactPerson,
        email: provider.email,
        phone: provider.phone,
        address: provider.address,
      },
    })
    for (const plan of provider.plans) {
      const planRow = await prisma.insurancePlan.create({
        data: {
          organizationId,
          providerId: providerRow.id,
          name: plan.name,
          code: plan.code,
          coveragePercent: plan.coveragePercent,
          coPayPercent: plan.coPayPercent,
          deductible: plan.deductible,
          annualLimit: plan.annualLimit,
          perVisitLimit: plan.perVisitLimit,
          networkType: plan.networkType as never,
        },
      })
      planRows.push({
        id: planRow.id, providerId: providerRow.id,
        providerName: provider.name, coveragePercent: plan.coveragePercent,
      })
    }
  }

  // Roughly 45% of patients carry insurance — the rest are cash patients.
  const insuredPatients = pickMany(patients, Math.round(patients.length * 0.45))
  const patientInsurances: DemoInsurance[] = []
  for (let i = 0; i < insuredPatients.length; i += 1) {
    const patient = insuredPatients[i]
    const plan = pick(planRows)
    const policyNumber = `POL-${plan.providerId.slice(-4).toUpperCase()}-${String(100000 + i * 37)}`
    const memberId = `MEM${String(500000 + i * 91)}`
    const row = await prisma.patientInsurance.create({
      data: {
        organizationId,
        patientId: patient.id,
        providerId: plan.providerId,
        planId: plan.id,
        type: 'PRIMARY',
        memberId,
        policyNumber,
        effectiveDate: daysAgo(int(120, 600)),
        expiryDate: daysFromNow(int(30, 400)),
        status: 'ACTIVE',
      },
    })
    patientInsurances.push({
      id: row.id, patientId: patient.id, providerId: plan.providerId,
      providerName: plan.providerName, planId: plan.id, policyNumber, memberId,
      coveragePercent: plan.coveragePercent,
    })
  }

  return {
    organizationId,
    hospitalId,
    departmentsByCode,
    users,
    doctors,
    doctorsBySpeciality,
    patients,
    labCatalog,
    radiologyCatalog,
    serviceCatalog,
    drugs,
    beds,
    patientInsurances,
  }
}
