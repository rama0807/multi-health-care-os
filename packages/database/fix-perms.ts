import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const role = await prisma.role.findFirst({ where: { systemRole: 'ORG_ADMIN' } })
  if (role) {
    const perm = await prisma.permission.findFirst({ where: { resource: 'doctors', action: 'read' } })
    if (perm) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id }
      })
      console.log('Added doctors.read to ORG_ADMIN')
    } else {
      console.log('doctors.read permission not found')
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
