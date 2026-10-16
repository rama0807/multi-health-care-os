import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organization.findFirst()
  if (!org) return console.log('No org')
  await prisma.dentalChair.createMany({
    data: [
      { name: 'Chair 1', organizationId: org.id, isActive: true },
      { name: 'Chair 2', organizationId: org.id, isActive: true },
      { name: 'Chair 3', organizationId: org.id, isActive: true },
    ]
  })
  console.log('Chairs seeded')
}

main().finally(() => prisma.$disconnect())
