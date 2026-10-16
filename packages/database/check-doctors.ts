import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const doctors = await prisma.doctor.findMany({ include: { user: true } })
  console.log(JSON.stringify(doctors, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
