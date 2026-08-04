/**
 * Demo-data seed — realistic operating data for the demo hospital.
 *
 * `prisma/seed.ts` (run via `pnpm db:seed`) deliberately creates only the
 * foundation an empty deployment needs: permissions, roles, the demo
 * organization, its hospital and departments, and one staff user per role.
 * It creates no patients or clinical activity.
 *
 * This script layers a full working dataset on top of that foundation so
 * every completed module has something real to show: patients, appointments
 * and encounters, prescriptions, lab and radiology orders, dispensing,
 * charges/invoices/payments, insurance pre-auths and claims, inpatient
 * admissions with nursing and MAR documentation, and the general inventory
 * and procurement chain.
 *
 * Run with:  pnpm db:seed && pnpm db:seed:demo
 *
 * It is safe to re-run: every row it creates is deleted first (scoped to the
 * demo organization), and randomness is deterministic, so the same dataset
 * comes back each time.
 */
import { PrismaClient } from '@prisma/client'

import { seedClinical } from './demo/clinical'
import { seedFoundation } from './demo/foundation'
import { resetCounters, resetRandom } from './demo/helpers'
import { seedInventory } from './demo/inventory'
import { seedIpd } from './demo/ipd'
import { resetDemoData } from './demo/reset'

const prisma = new PrismaClient()

const ORG_SLUG = 'demo-hospital'
const HOSPITAL_CODE = 'MAIN'

async function main(): Promise<void> {
  const startedAt = Date.now()
  resetRandom()
  resetCounters()

  console.log('Seeding demo data...\n')

  const organization = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (!organization) {
    throw new Error(`Organization "${ORG_SLUG}" not found. Run the base seed first: pnpm db:seed`)
  }

  const hospital = await prisma.hospital.findUnique({
    where: { code_organizationId: { code: HOSPITAL_CODE, organizationId: organization.id } },
  })
  if (!hospital) {
    throw new Error(`Hospital "${HOSPITAL_CODE}" not found for ${ORG_SLUG}. Run the base seed first: pnpm db:seed`)
  }

  console.log('→ Clearing any previously seeded demo data...')
  await resetDemoData(prisma, organization.id)

  console.log('→ Staff, patients, catalogs, wards and insurance...')
  const ctx = await seedFoundation(prisma, organization.id, hospital.id)

  console.log('→ Appointments, encounters, diagnostics, pharmacy, billing and claims...')
  const clinical = await seedClinical(prisma, ctx)

  console.log('→ Inpatient admissions, nursing, MAR and discharges...')
  await seedIpd(prisma, ctx)

  console.log('→ Inventory, procurement, assets and stock audits...')
  await seedInventory(prisma, ctx)

  // ── Summary ─────────────────────────────────────────────────────────────
  const org = { organizationId: organization.id }
  const [
    patients, appointments, encounters, prescriptions, labTests, radiologyOrders,
    dispenseOrders, invoices, payments, claims, admissions, currentInpatients,
    beds, inventoryItems, purchaseOrders, assets,
  ] = await Promise.all([
    prisma.patient.count({ where: org }),
    prisma.appointment.count({ where: org }),
    prisma.encounter.count({ where: org }),
    prisma.prescription.count({ where: org }),
    prisma.labTest.count({ where: org }),
    prisma.radiologyOrder.count({ where: org }),
    prisma.dispenseOrder.count({ where: org }),
    prisma.invoice.count({ where: org }),
    prisma.payment.count({ where: org }),
    prisma.insuranceClaim.count({ where: org }),
    prisma.admission.count({ where: org }),
    prisma.admission.count({ where: { ...org, status: 'ADMITTED' } }),
    prisma.bed.count({ where: org }),
    prisma.inventoryItem.count({ where: org }),
    prisma.purchaseOrder.count({ where: org }),
    prisma.asset.count({ where: org }),
  ])

  const rows: Array<[string, number]> = [
    ['Doctors', ctx.doctors.length],
    ['Patients', patients],
    ['Appointments', appointments],
    ['Encounters (OPD + IPD)', encounters],
    ['  of which completed OPD', clinical.completedEncounters.length],
    ['Prescriptions', prescriptions],
    ['Lab orders', labTests],
    ['Radiology orders', radiologyOrders],
    ['Dispense orders', dispenseOrders],
    ['Invoices', invoices],
    ['Payments', payments],
    ['Insurance claims', claims],
    ['Beds', beds],
    ['Admissions', admissions],
    ['  currently admitted', currentInpatients],
    ['Inventory items', inventoryItems],
    ['Purchase orders', purchaseOrders],
    ['Assets', assets],
  ]

  console.log('')
  for (const [label, value] of rows) {
    console.log(`  ${label.padEnd(26, '.')} ${value}`)
  }

  console.log(`\n✅ Demo data seeded in ${((Date.now() - startedAt) / 1000).toFixed(1)}s.`)
  console.log('   Sign in with any account from the base seed, e.g. admin@medicore.demo / Demo@12345')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
