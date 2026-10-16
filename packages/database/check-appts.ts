import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'dentist-demo' } })
  const appts = await prisma.appointment.findMany({ where: { organizationId: org!.id } })
  console.log('Total appointments:', appts.length)
  for (const a of appts) {
    console.log(`- ${a.scheduledAt.toISOString()} for ${a.durationMinutes}m (Room: ${a.roomNumber})`)
  }
}

main().finally(() => prisma.$disconnect())
