import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const dentalResources = [
    'dental_patients',
    'dental_encounters',
    'dental_odontogram',
    'dental_treatment_plans',
    'dental_vendors',
    'dental_lab_cases',
    'dental_recalls'
  ]

  const actions = ['create', 'read', 'update', 'delete']

  console.log('Seeding dental permissions...')

  for (const resource of dentalResources) {
    for (const action of actions) {
      await prisma.permission.upsert({
        where: {
          resource_action_scope: {
            resource,
            action,
            scope: 'all'
          }
        },
        update: {},
        create: {
          resource,
          action,
          scope: 'all',
          description: `Can ${action} ${resource}`
        }
      })
    }
  }

  console.log('Fetching ORG_ADMIN roles...')
  const orgAdminRoles = await prisma.role.findMany({
    where: { systemRole: 'ORG_ADMIN' }
  })

  const allDentalPermissions = await prisma.permission.findMany({
    where: { resource: { startsWith: 'dental_' } }
  })

  console.log(`Found ${orgAdminRoles.length} ORG_ADMIN roles and ${allDentalPermissions.length} dental permissions.`)

  for (const role of orgAdminRoles) {
    for (const perm of allDentalPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: perm.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: perm.id
        }
      })
    }
  }

  console.log('Done! All ORG_ADMIN users now have dental permissions.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
