import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'dentist-demo' } })
  const appts = await prisma.appointment.findMany({
    where: { organizationId: org!.id },
    include: { patient: true }
  })
  
  for (const a of appts) {
    console.log(`Appointment ${a.id}: Patient ->`, a.patient)
  }
}

main().finally(() => prisma.$disconnect())
