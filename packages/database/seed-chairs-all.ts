import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const orgs = await prisma.organization.findMany()
  console.log('Orgs:', orgs.map(o => ({id: o.id, slug: o.slug, name: o.name})))
  
  for (const org of orgs) {
    const existing = await prisma.dentalChair.findMany({ where: { organizationId: org.id } })
    if (existing.length === 0) {
      console.log('Seeding chairs for org:', org.name)
      await prisma.dentalChair.createMany({
        data: [
          { name: 'Chair 1', organizationId: org.id, isActive: true },
          { name: 'Chair 2', organizationId: org.id, isActive: true },
          { name: 'Chair 3', organizationId: org.id, isActive: true },
        ]
      })
    } else {
      console.log('Chairs already exist for org:', org.name)
    }
  }
}

main().finally(() => prisma.$disconnect())
