import { PrismaClient, SystemRole } from '@prisma/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

const DEMO_PASSWORD = 'Demo@12345'

// Per-resource action lists — deliberately not a blanket CRUD-for-everything
// matrix. Audit logs are append-only (no update/delete), reports are
// read/export only, etc. `own` scope is only meaningful where an individual
// staff member's own assignments are a real query dimension today
// (patients/medical_records/prescriptions) — everything else stays `all`
// until later milestones build ownership-aware modules.
const RESOURCE_ACTIONS: Record<string, string[]> = {
  patients: ['read', 'create', 'update', 'delete'],
  doctors: ['read', 'create', 'update', 'delete'],
  appointments: ['read', 'create', 'update', 'delete'],
  medical_records: ['read', 'create', 'update'],
  prescriptions: ['read', 'create', 'update'],
  laboratory: ['read', 'create', 'update'],
  radiology: ['read', 'create', 'update'],
  billing: ['read', 'create', 'update', 'manage'],
  insurance: ['read', 'create', 'update'],
  pharmacy: ['read', 'create', 'update'],
  inventory: ['read', 'create', 'update', 'manage'],
  staff: ['read', 'create', 'update', 'delete'],
  users: ['read', 'create', 'update', 'manage'],
  roles: ['read', 'create', 'update'],
  organizations: ['read', 'update'],
  hospitals: ['read', 'create', 'update', 'delete'],
  departments: ['read', 'create', 'update', 'delete'],
  reports: ['read', 'export'],
  audit: ['read'],
}

const OWN_SCOPE_PERMISSIONS: Array<{ resource: string; action: string }> = [
  { resource: 'patients', action: 'read' },
  { resource: 'doctors', action: 'read' },
  { resource: 'medical_records', action: 'read' },
  { resource: 'medical_records', action: 'create' },
  { resource: 'prescriptions', action: 'read' },
  { resource: 'prescriptions', action: 'create' },
]

function buildPermissionCatalog() {
  const permissions: Array<{ resource: string; action: string; scope: string }> = []

  for (const [resource, actions] of Object.entries(RESOURCE_ACTIONS)) {
    for (const action of actions) {
      permissions.push({ resource, action, scope: 'all' })
    }
  }
  for (const { resource, action } of OWN_SCOPE_PERMISSIONS) {
    permissions.push({ resource, action, scope: 'own' })
  }

  return permissions
}

const ORG_SETTINGS = {
  uhidPrefix: 'MED',
  uhidResetYearly: true,
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  currencySymbol: '₹',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12h' as const,
  gstRate: 18,
  defaultAppointmentDuration: 15,
  workingDays: [1, 2, 3, 4, 5, 6],
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
}

interface RoleSpec {
  slug: string
  name: string
  systemRole: SystemRole
  permissions: Array<{ resource: string; action: string; scope?: string }>
  user: { email: string; firstName: string; lastName: string }
}

const ROLE_SPECS: RoleSpec[] = [
  {
    slug: 'hospital-admin',
    name: 'Hospital Admin',
    systemRole: SystemRole.ORG_ADMIN,
    permissions: [], // filled in with every permission at seed time
    user: { email: 'admin@medicore.demo', firstName: 'Hospital', lastName: 'Admin' },
  },
  {
    slug: 'doctor',
    name: 'Doctor',
    systemRole: SystemRole.DOCTOR,
    permissions: [
      { resource: 'doctors', action: 'read', scope: 'own' },
      { resource: 'patients', action: 'read', scope: 'own' },
      { resource: 'medical_records', action: 'read', scope: 'own' },
      { resource: 'medical_records', action: 'create', scope: 'own' },
      { resource: 'prescriptions', action: 'read', scope: 'own' },
      { resource: 'prescriptions', action: 'create', scope: 'own' },
      { resource: 'appointments', action: 'read' },
      { resource: 'laboratory', action: 'read' },
      { resource: 'laboratory', action: 'create' },
      { resource: 'radiology', action: 'read' },
      { resource: 'radiology', action: 'create' },
    ],
    user: { email: 'doctor@medicore.demo', firstName: 'Priya', lastName: 'Sharma' },
  },
  {
    slug: 'nurse',
    name: 'Nurse',
    systemRole: SystemRole.NURSE,
    permissions: [
      { resource: 'patients', action: 'read' },
      { resource: 'appointments', action: 'read' },
      { resource: 'medical_records', action: 'read' },
      { resource: 'laboratory', action: 'read' },
    ],
    user: { email: 'nurse@medicore.demo', firstName: 'Anjali', lastName: 'Verma' },
  },
  {
    slug: 'receptionist',
    name: 'Receptionist',
    systemRole: SystemRole.RECEPTIONIST,
    permissions: [
      { resource: 'patients', action: 'read' },
      { resource: 'patients', action: 'create' },
      { resource: 'patients', action: 'update' },
      { resource: 'appointments', action: 'read' },
      { resource: 'appointments', action: 'create' },
      { resource: 'appointments', action: 'update' },
      { resource: 'billing', action: 'read' },
    ],
    user: { email: 'receptionist@medicore.demo', firstName: 'Neha', lastName: 'Kapoor' },
  },
  {
    slug: 'lab-technician',
    name: 'Lab Technician',
    systemRole: SystemRole.LAB_TECHNICIAN,
    permissions: [
      { resource: 'laboratory', action: 'read' },
      { resource: 'laboratory', action: 'create' },
      { resource: 'laboratory', action: 'update' },
      { resource: 'patients', action: 'read' },
    ],
    user: { email: 'labtech@medicore.demo', firstName: 'Rahul', lastName: 'Iyer' },
  },
  {
    slug: 'pharmacist',
    name: 'Pharmacist',
    systemRole: SystemRole.PHARMACIST,
    permissions: [
      { resource: 'pharmacy', action: 'read' },
      { resource: 'pharmacy', action: 'create' },
      { resource: 'pharmacy', action: 'update' },
      { resource: 'prescriptions', action: 'read' },
      { resource: 'inventory', action: 'read' },
    ],
    user: { email: 'pharmacist@medicore.demo', firstName: 'Karan', lastName: 'Mehta' },
  },
  {
    slug: 'cashier',
    name: 'Cashier',
    systemRole: SystemRole.CASHIER,
    permissions: [
      { resource: 'billing', action: 'read' },
      { resource: 'billing', action: 'create' },
      { resource: 'billing', action: 'update' },
      { resource: 'insurance', action: 'read' },
    ],
    user: { email: 'cashier@medicore.demo', firstName: 'Sunita', lastName: 'Rao' },
  },
  {
    slug: 'hr',
    name: 'HR',
    systemRole: SystemRole.HR,
    permissions: [
      { resource: 'doctors', action: 'read' },
      { resource: 'doctors', action: 'create' },
      { resource: 'doctors', action: 'update' },
      { resource: 'staff', action: 'read' },
      { resource: 'staff', action: 'create' },
      { resource: 'staff', action: 'update' },
      { resource: 'staff', action: 'delete' },
      { resource: 'users', action: 'read' },
      { resource: 'departments', action: 'read' },
    ],
    user: { email: 'hr@medicore.demo', firstName: 'Vikram', lastName: 'Nair' },
  },
]

async function main() {
  console.log('Seeding database...\n')

  // ── Permission catalog ─────────────────────────────────────────────────
  const catalog = buildPermissionCatalog()
  for (const perm of catalog) {
    await prisma.permission.upsert({
      where: { resource_action_scope: perm },
      update: {},
      create: { ...perm, description: `${perm.action} ${perm.resource} (${perm.scope})` },
    })
  }
  const allPermissions = await prisma.permission.findMany()
  console.log(`✓ ${allPermissions.length} permissions seeded`)

  // ── Platform organization + Super Admin ────────────────────────────────
  const platformOrg = await prisma.organization.upsert({
    where: { slug: 'medicore-platform' },
    update: {},
    create: {
      name: 'MediCore Platform',
      slug: 'medicore-platform',
      type: 'HOSPITAL',
      email: 'platform@medicore.app',
      phone: '9999999999',
      country: 'IN',
      settings: ORG_SETTINGS,
    },
  })

  const superAdminRole = await prisma.role.upsert({
    where: { name_organizationId: { name: 'Super Admin', organizationId: platformOrg.id } },
    update: {},
    create: {
      name: 'Super Admin',
      systemRole: SystemRole.SUPER_ADMIN,
      organizationId: platformOrg.id,
      description: 'Full cross-cutting platform access',
      rolePermissions: { create: allPermissions.map((p) => ({ permissionId: p.id })) },
    },
  })

  const superAdminPasswordHash = await argon2.hash(DEMO_PASSWORD)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@medicore.app' },
    update: {},
    create: {
      email: 'superadmin@medicore.app',
      passwordHash: superAdminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
      isEmailVerified: true,
      organizationId: platformOrg.id,
      userRoles: { create: [{ roleId: superAdminRole.id }] },
    },
  })
  console.log(`✓ Super Admin: ${superAdmin.email} / ${DEMO_PASSWORD}`)

  // ── Demo organization → hospital → departments ─────────────────────────
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'demo-hospital' },
    update: {},
    create: {
      name: 'MediCore Demo Hospital Group',
      slug: 'demo-hospital',
      type: 'HOSPITAL',
      email: 'admin@medicore.demo',
      phone: '9876543210',
      address: '123 Medical Lane',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'IN',
      pincode: '400001',
      settings: ORG_SETTINGS,
    },
  })
  console.log(`✓ Organization: ${demoOrg.slug}`)

  const demoHospital = await prisma.hospital.upsert({
    where: { code_organizationId: { code: 'MAIN', organizationId: demoOrg.id } },
    update: {},
    create: {
      organizationId: demoOrg.id,
      name: 'MediCore Main Hospital',
      code: 'MAIN',
      address: '123 Medical Lane',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'IN',
      pincode: '400001',
      phone: '9876543210',
      email: 'main@medicore.demo',
    },
  })
  console.log(`✓ Hospital: ${demoHospital.name}`)

  const departmentSpecs = [
    { code: 'GENMED', name: 'General Medicine' },
    { code: 'CARDIO', name: 'Cardiology' },
    { code: 'EMRG', name: 'Emergency' },
    { code: 'LAB', name: 'Laboratory' },
  ]
  for (const dept of departmentSpecs) {
    await prisma.department.upsert({
      where: { code_hospitalId: { code: dept.code, hospitalId: demoHospital.id } },
      update: {},
      create: {
        ...dept,
        hospitalId: demoHospital.id,
        organizationId: demoOrg.id,
      },
    })
  }
  console.log(`✓ ${departmentSpecs.length} departments seeded`)

  // ── Roles + sample users ────────────────────────────────────────────────
  const permissionByKey = new Map(allPermissions.map((p) => [`${p.resource}.${p.action}.${p.scope}`, p]))
  let doctorUser: { id: string } | undefined

  for (const spec of ROLE_SPECS) {
    const permissionIds =
      spec.slug === 'hospital-admin'
        ? allPermissions.map((p) => p.id)
        : spec.permissions
            .map((p) => permissionByKey.get(`${p.resource}.${p.action}.${p.scope ?? 'all'}`)?.id)
            .filter((id): id is string => Boolean(id))

    const role = await prisma.role.upsert({
      where: { name_organizationId: { name: spec.name, organizationId: demoOrg.id } },
      update: {},
      create: {
        name: spec.name,
        systemRole: spec.systemRole,
        organizationId: demoOrg.id,
        description: `${spec.name} role`,
        rolePermissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
    })

    const passwordHash = await argon2.hash(DEMO_PASSWORD)
    const user = await prisma.user.upsert({
      where: { email: spec.user.email },
      update: {},
      create: {
        email: spec.user.email,
        passwordHash,
        firstName: spec.user.firstName,
        lastName: spec.user.lastName,
        status: 'ACTIVE',
        isEmailVerified: true,
        organizationId: demoOrg.id,
        userRoles: {
          create: [
            {
              roleId: role.id,
              hospitalId: spec.slug === 'hospital-admin' ? demoHospital.id : undefined,
            },
          ],
        },
      },
    })
    console.log(`✓ ${spec.name}: ${user.email} / ${DEMO_PASSWORD}`)

    if (spec.slug === 'doctor') doctorUser = user
  }

  // ── Demo doctor professional profile ────────────────────────────────────
  if (doctorUser) {
    const cardiology = await prisma.department.findUnique({
      where: { code_hospitalId: { code: 'CARDIO', hospitalId: demoHospital.id } },
    })

    await prisma.doctor.upsert({
      where: { userId: doctorUser.id },
      update: {},
      create: {
        userId: doctorUser.id,
        organizationId: demoOrg.id,
        hospitalId: demoHospital.id,
        departmentId: cardiology?.id,
        registrationNumber: 'MCI-2010-001234',
        specialization: 'Cardiology',
        subSpecialization: 'Interventional Cardiology',
        qualification: 'MBBS, MD (Cardiology), DM',
        experienceYears: 14,
        languagesSpoken: ['English', 'Hindi', 'Marathi'],
        bio: 'Consultant cardiologist with a focus on interventional procedures and preventive cardiac care.',
        consultationFee: 800,
        availabilityStatus: 'AVAILABLE',
        joiningDate: new Date('2020-06-01'),
      },
    })
    console.log('✓ Demo doctor profile: Priya Sharma (Cardiology)')
  }

  console.log('\n✅ Seeding complete! No fake patients were created.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
