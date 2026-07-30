import { PrismaClient, SystemRole } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create permissions
  const permissions = [
    // Patients
    { resource: 'patients', action: 'read', scope: 'all' },
    { resource: 'patients', action: 'write', scope: 'all' },
    { resource: 'patients', action: 'delete', scope: 'all' },
    // Appointments
    { resource: 'appointments', action: 'read', scope: 'all' },
    { resource: 'appointments', action: 'write', scope: 'all' },
    { resource: 'appointments', action: 'delete', scope: 'all' },
    // Medical Records
    { resource: 'medical_records', action: 'read', scope: 'all' },
    { resource: 'medical_records', action: 'write', scope: 'all' },
    // Laboratory
    { resource: 'laboratory', action: 'read', scope: 'all' },
    { resource: 'laboratory', action: 'write', scope: 'all' },
    // Billing
    { resource: 'billing', action: 'read', scope: 'all' },
    { resource: 'billing', action: 'write', scope: 'all' },
    // Pharmacy
    { resource: 'pharmacy', action: 'read', scope: 'all' },
    { resource: 'pharmacy', action: 'write', scope: 'all' },
    // Staff
    { resource: 'staff', action: 'read', scope: 'all' },
    { resource: 'staff', action: 'write', scope: 'all' },
    // Reports
    { resource: 'reports', action: 'read', scope: 'all' },
    // Settings
    { resource: 'settings', action: 'read', scope: 'all' },
    { resource: 'settings', action: 'write', scope: 'all' },
    // Users
    { resource: 'users', action: 'read', scope: 'all' },
    { resource: 'users', action: 'write', scope: 'all' },
    { resource: 'users', action: 'delete', scope: 'all' },
  ]

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { resource_action_scope: perm },
      update: {},
      create: perm,
    })
  }

  console.log(`✓ ${permissions.length} permissions seeded`)

  // Create demo organization
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-hospital' },
    update: {},
    create: {
      name: 'Demo Hospital',
      slug: 'demo-hospital',
      type: 'HOSPITAL',
      email: 'admin@demohospital.com',
      phone: '9876543210',
      address: '123 Medical Lane',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'IN',
      pincode: '400001',
      settings: {
        uhidPrefix: 'DEMO',
        uhidResetYearly: true,
        timezone: 'Asia/Kolkata',
        currency: 'INR',
        currencySymbol: '₹',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '12h',
        gstRate: 18,
        defaultAppointmentDuration: 15,
        workingDays: [1, 2, 3, 4, 5, 6],
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
      },
    },
  })

  console.log(`✓ Demo organization created: ${demoOrg.slug}`)

  // Create admin role with all permissions
  const allPermissions = await prisma.permission.findMany()
  const adminRole = await prisma.role.upsert({
    where: { name_organizationId: { name: 'Admin', organizationId: demoOrg.id } },
    update: {},
    create: {
      name: 'Admin',
      systemRole: SystemRole.ORG_ADMIN,
      organizationId: demoOrg.id,
      description: 'Full system access',
      rolePermissions: {
        create: allPermissions.map((p) => ({ permissionId: p.id })),
      },
    },
  })

  // Create demo admin user
  const passwordHash = await bcrypt.hash('Admin@123', 12)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@demohospital.com' },
    update: {},
    create: {
      email: 'admin@demohospital.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      isEmailVerified: true,
      organizationId: demoOrg.id,
      userRoles: {
        create: [{ roleId: adminRole.id }],
      },
    },
  })

  console.log(`✓ Demo admin user created: ${adminUser.email}`)
  console.log('   Password: Admin@123')

  console.log('\n✅ Seeding complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
