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
  'doctors.schedule': ['read', 'update'],
  'doctors.leave': ['read', 'approve', 'manage'],
  'doctors.documents': ['read', 'manage'],
  appointments: ['read', 'create', 'update', 'delete'],
  medical_records: ['read', 'create', 'update'],
  prescriptions: ['read', 'create', 'update'],
  laboratory: ['read', 'create', 'update'],
  radiology: ['read', 'create', 'update'],
  billing: ['read', 'create', 'update', 'manage'],
  // Split from a flat `insurance` resource into namespaced sub-resources
  // (Milestone 11 / ADR-0016) — mirrors `doctors.schedule`/`doctors.leave`/
  // `doctors.documents`'s precedent for a module with genuinely distinct
  // sub-workflows rather than one CRUD surface.
  'insurance.providers': ['read', 'create', 'update'],
  'insurance.plans': ['read', 'create', 'update'],
  'insurance.claims': ['read', 'create', 'update'],
  'insurance.preauth': ['read', 'create', 'update'],
  'insurance.settlement': ['read', 'manage'],
  pharmacy: ['read', 'create', 'update'],
  // General (non-drug) Inventory & Procurement (Milestone 13 / ADR-0020) —
  // replaces the flat `inventory` resource (never actually built on) with
  // namespaced sub-resources mirroring `insurance.*`/`ipd.*`'s precedent
  // for a module with genuinely distinct sub-workflows. `.procurement`
  // covers the Purchase Request -> PO -> GRN -> Vendor Invoice chain
  // (`approve` gates PR/PO approval, `manage` gates vendor invoice/return
  // handling); `.requests` is the internal ward/OT/ICU/lab/radiology
  // requisition workflow (`approve` gates approving a requisition).
  'inventory.items': ['read', 'create', 'update', 'delete'],
  'inventory.stores': ['read', 'create', 'update', 'delete'],
  'inventory.stock': ['read', 'create', 'update'],
  'inventory.procurement': ['read', 'create', 'update', 'approve', 'manage'],
  'inventory.vendors': ['read', 'create', 'update'],
  'inventory.requests': ['read', 'create', 'update', 'approve'],
  'inventory.assets': ['read', 'create', 'update'],
  'inventory.audit': ['read', 'create', 'update', 'manage'],
  // IPD & Bed Management (Milestone 12 / ADR-0018) — `ipd.wards`/`ipd.rooms`/
  // `ipd.beds` are the ward/room/bed inventory CRUD surface; `ipd.admissions`
  // is the admit/cancel workflow; `ipd.transfer` is the allocate/reserve/
  // vacate/transfer workflow, kept separate from `ipd.beds` since it's an
  // action on a bed rather than editing the bed record itself.
  'ipd.wards': ['read', 'create', 'update', 'delete'],
  'ipd.rooms': ['read', 'create', 'update', 'delete'],
  'ipd.beds': ['read', 'create', 'update', 'delete'],
  'ipd.admissions': ['read', 'create', 'update'],
  'ipd.transfer': ['read', 'create'],
  // Nursing, MAR & Discharge (Milestone 12 Checkpoint 12.2 / ADR-0019) — all
  // all-scope, mirroring `ipd.beds`/`ipd.transfer`'s precedent rather than
  // `ipd.admissions`' own-scope carve-out: these are ward-level operational
  // surfaces run by whoever's on shift, not doctor-specific. `ipd.nursing`
  // bundles notes/assessments/I-O charting (all nurse-authored charting).
  // `ipd.discharge` splits `create` (doctor approval), `update` (nursing
  // checklist + summary edits), and `manage` (finalize — mirrors
  // `billing.manage`'s requester/approver separation).
  'ipd.nursing': ['read', 'create'],
  'ipd.orders': ['read', 'create', 'update'],
  'ipd.tasks': ['read', 'create', 'update'],
  'ipd.mar': ['read', 'create', 'update'],
  'ipd.discharge': ['read', 'create', 'update', 'manage'],
  // Staff & Attendance (Milestone 14 / ADR-0022) — `staff`/`staff.documents`
  // mirror `doctors`/`doctors.documents`'s precedent for the non-doctor
  // employee directory (Nurse/Receptionist/Lab Technician/Radiology
  // Technician/Pharmacist/Cashier/HR/Inventory Manager — Doctors keep their
  // own dedicated module). `attendance`/`leave`/`shifts`/`shifts.roster` are
  // new namespaces: `leave` covers both leave requests and the holiday
  // calendar (`manage` gates holiday CRUD, same action that gates
  // apply/cancel on one's own leave — mirrors `doctors.leave`'s action set).
  // `attendance.manage` also gates the Payroll Prep summary/export, since
  // it's an administrative read over the same data, not a distinct workflow.
  staff: ['read', 'create', 'update', 'delete'],
  'staff.documents': ['read', 'manage'],
  attendance: ['read', 'create', 'update', 'manage'],
  leave: ['read', 'approve', 'manage'],
  shifts: ['read', 'create', 'update', 'delete'],
  'shifts.roster': ['read', 'create', 'update'],
  // AI Features (Milestone 15 Checkpoint 15.1 / ADR-0023) — `ai.generate` runs
  // a clinical generator, `ai.read` views conversation transcripts, and
  // `ai.manage` is the admin-shaped org-wide usage/token reporting surface
  // (mirrors `billing.manage`'s requester/reviewer separation). `ai.templates`
  // is separate because editing a prompt changes clinical output for the whole
  // organization — a strictly narrower audience than running a generator.
  ai: ['read', 'generate', 'manage'],
  'ai.templates': ['read', 'manage'],
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
  { resource: 'medical_records', action: 'update' },
  { resource: 'prescriptions', action: 'read' },
  { resource: 'prescriptions', action: 'create' },
  { resource: 'prescriptions', action: 'update' },
  { resource: 'laboratory', action: 'read' },
  { resource: 'laboratory', action: 'create' },
  { resource: 'laboratory', action: 'update' },
  // Own-scoped for the same reason as laboratory (ADR-0013): a doctor only
  // orders/views/updates radiology studies for patients they're treating.
  // Radiology Technician stays all-scope below — they process every study
  // in the queue regardless of which doctor ordered it.
  { resource: 'radiology', action: 'read' },
  { resource: 'radiology', action: 'create' },
  { resource: 'radiology', action: 'update' },
  { resource: 'doctors.schedule', action: 'read' },
  { resource: 'doctors.leave', action: 'read' },
  { resource: 'doctors.leave', action: 'manage' },
  { resource: 'doctors.documents', action: 'read' },
  { resource: 'doctors.documents', action: 'manage' },
  { resource: 'appointments', action: 'update' },
  // A doctor only admits/manages IPD stays for patients they're the
  // attending physician for — mirrors medical_records/prescriptions.
  { resource: 'ipd.admissions', action: 'read' },
  { resource: 'ipd.admissions', action: 'create' },
  { resource: 'ipd.admissions', action: 'update' },
  // Every non-doctor staff role clocks itself in/out, requests its own
  // corrections, applies for/cancels its own leave, and views its own
  // roster — mirrors the `ipd.admissions` own-scope carve-out above, just
  // for self-service HR actions rather than patient-care ones.
  { resource: 'attendance', action: 'read' },
  { resource: 'attendance', action: 'create' },
  { resource: 'attendance', action: 'update' },
  { resource: 'leave', action: 'read' },
  { resource: 'leave', action: 'manage' },
  { resource: 'shifts.roster', action: 'read' },
  // A doctor may only generate against, and read back, AI output for records
  // where they are the treating doctor — mirrors medical_records/prescriptions.
  { resource: 'ai', action: 'read' },
  { resource: 'ai', action: 'generate' },
]

/**
 * `role.upsert`'s `update: {}` branch intentionally leaves an existing
 * role's fields untouched, but that meant a role created before a given
 * permission existed would never receive it on subsequent seed runs —
 * every permission added after a role's first creation silently never
 * reached its `RolePermission` rows (see TECH_DEBT TD-0011). This tops a
 * role up to include every permission it should currently have, without
 * touching anything already there or removing extras a session may have
 * granted manually.
 */
async function syncRolePermissions(
  prisma: PrismaClient,
  roleId: string,
  desiredPermissionIds: string[],
): Promise<void> {
  const existing = await prisma.rolePermission.findMany({ where: { roleId }, select: { permissionId: true } })
  const existingIds = new Set(existing.map((rp) => rp.permissionId))
  const missing = desiredPermissionIds.filter((id) => !existingIds.has(id))
  if (missing.length) {
    await prisma.rolePermission.createMany({ data: missing.map((permissionId) => ({ roleId, permissionId })) })
  }
}

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
      { resource: 'doctors.schedule', action: 'read', scope: 'own' },
      { resource: 'doctors.leave', action: 'read', scope: 'own' },
      { resource: 'doctors.leave', action: 'manage', scope: 'own' },
      { resource: 'doctors.documents', action: 'read', scope: 'own' },
      { resource: 'doctors.documents', action: 'manage', scope: 'own' },
      { resource: 'patients', action: 'read', scope: 'own' },
      { resource: 'medical_records', action: 'read', scope: 'own' },
      { resource: 'medical_records', action: 'create', scope: 'own' },
      { resource: 'medical_records', action: 'update', scope: 'own' },
      { resource: 'prescriptions', action: 'read', scope: 'own' },
      { resource: 'prescriptions', action: 'create', scope: 'own' },
      { resource: 'prescriptions', action: 'update', scope: 'own' },
      { resource: 'appointments', action: 'read' },
      { resource: 'appointments', action: 'update', scope: 'own' },
      // Own-scoped, mirroring prescriptions/medical_records (ADR-0012): a
      // doctor only orders/views/updates lab tests for patients they're
      // treating. Lab Technician/Nurse stay all-scope below — they process
      // and view every order regardless of which doctor placed it.
      { resource: 'laboratory', action: 'read', scope: 'own' },
      { resource: 'laboratory', action: 'create', scope: 'own' },
      { resource: 'laboratory', action: 'update', scope: 'own' },
      // Own-scoped, mirroring laboratory (ADR-0013): a doctor only
      // orders/views/updates radiology studies for patients they're
      // treating. Radiology Technician stays all-scope below.
      { resource: 'radiology', action: 'read', scope: 'own' },
      { resource: 'radiology', action: 'create', scope: 'own' },
      { resource: 'radiology', action: 'update', scope: 'own' },
      // Ward/room/bed inventory is not patient- or doctor-specific, so it
      // stays all-scope even for a role that's otherwise own-scoped.
      { resource: 'ipd.wards', action: 'read' },
      { resource: 'ipd.rooms', action: 'read' },
      { resource: 'ipd.beds', action: 'read' },
      // A doctor places diet/fluid/activity/oxygen/isolation orders,
      // approves discharge, and finalizes it — but reads (not writes)
      // nurse-authored notes/MAR/tasks.
      { resource: 'ipd.nursing', action: 'read' },
      { resource: 'ipd.orders', action: 'read' },
      { resource: 'ipd.orders', action: 'create' },
      { resource: 'ipd.orders', action: 'update' },
      { resource: 'ipd.tasks', action: 'read' },
      { resource: 'ipd.mar', action: 'read' },
      { resource: 'ipd.discharge', action: 'read' },
      { resource: 'ipd.discharge', action: 'create' },
      { resource: 'ipd.discharge', action: 'manage' },
      // Own-scoped, mirroring medical_records/prescriptions (ADR-0023): a
      // doctor generates and reads AI drafts only for their own patients.
      // No `ai.manage` — org-wide usage/cost reporting is an admin surface.
      { resource: 'ai', action: 'read', scope: 'own' },
      { resource: 'ai', action: 'generate', scope: 'own' },
      { resource: 'ai.templates', action: 'read' },
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
      { resource: 'radiology', action: 'read' },
      // A nurse runs day-to-day ward operations: sees the bed grid, updates
      // bed status (e.g. Cleaning -> Available), and handles allocations/
      // transfers, but doesn't create/delete ward or room inventory records.
      { resource: 'ipd.wards', action: 'read' },
      { resource: 'ipd.rooms', action: 'read' },
      { resource: 'ipd.beds', action: 'read' },
      { resource: 'ipd.beds', action: 'update' },
      { resource: 'ipd.admissions', action: 'read' },
      { resource: 'ipd.transfer', action: 'read' },
      { resource: 'ipd.transfer', action: 'create' },
      // Nursing documentation, MAR administration, doctor-order visibility,
      // nursing-task management, and discharge-checklist/summary editing —
      // but not discharge approval or finalization (doctor-only).
      // All-scope like the rest of the nurse's ward surfaces (ipd.nursing's
      // precedent): summarising a lab report or an admission's course is
      // ward-level work, not doctor-specific.
      { resource: 'ai', action: 'read' },
      { resource: 'ai', action: 'generate' },
      { resource: 'ipd.nursing', action: 'read' },
      { resource: 'ipd.nursing', action: 'create' },
      { resource: 'ipd.orders', action: 'read' },
      { resource: 'ipd.tasks', action: 'read' },
      { resource: 'ipd.tasks', action: 'create' },
      { resource: 'ipd.tasks', action: 'update' },
      { resource: 'ipd.mar', action: 'read' },
      { resource: 'ipd.mar', action: 'create' },
      { resource: 'ipd.mar', action: 'update' },
      { resource: 'ipd.discharge', action: 'read' },
      { resource: 'ipd.discharge', action: 'update' },
      // A ward/ICU nurse raises stock requisitions against Central Store
      // and sees their own store's stock levels, but doesn't manage the
      // item master, procurement, or vendors.
      { resource: 'inventory.stock', action: 'read' },
      { resource: 'inventory.requests', action: 'read' },
      { resource: 'inventory.requests', action: 'create' },
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
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
      // Front desk opens the admission (ward/bed picked from what's
      // available) but doesn't manage ward/room/bed inventory itself.
      { resource: 'ipd.wards', action: 'read' },
      { resource: 'ipd.rooms', action: 'read' },
      { resource: 'ipd.beds', action: 'read' },
      { resource: 'ipd.admissions', action: 'read' },
      { resource: 'ipd.admissions', action: 'create' },
      // Read-only visibility into discharge status for exit/billing
      // formalities — front desk doesn't approve or finalize discharge.
      { resource: 'ipd.discharge', action: 'read' },
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
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
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
    ],
    user: { email: 'labtech@medicore.demo', firstName: 'Rahul', lastName: 'Iyer' },
  },
  {
    // `SystemRole.RADIOLOGY_TECHNICIAN` already existed in the enum from the
    // original scaffolding commit but had no ROLE_SPEC (same situation
    // `LAB_TECHNICIAN` was in before Milestone 7) — mirrors `lab-technician`
    // exactly, since a radiology technician needs to see/process every
    // study in the queue regardless of which doctor ordered it (ADR-0013).
    slug: 'radiology-technician',
    name: 'Radiology Technician',
    systemRole: SystemRole.RADIOLOGY_TECHNICIAN,
    permissions: [
      { resource: 'radiology', action: 'read' },
      { resource: 'radiology', action: 'create' },
      { resource: 'radiology', action: 'update' },
      { resource: 'patients', action: 'read' },
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
    ],
    user: { email: 'radiologytech@medicore.demo', firstName: 'Suresh', lastName: 'Patil' },
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
      // Completing a dispense transitions the source Prescription to
      // COMPLETED via PrescriptionsService.updateStatus — see ADR-0014.
      { resource: 'prescriptions', action: 'update' },
      { resource: 'inventory.stock', action: 'read' },
      { resource: 'inventory.requests', action: 'read' },
      { resource: 'inventory.requests', action: 'create' },
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
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
      { resource: 'insurance.providers', action: 'read' },
      { resource: 'insurance.plans', action: 'read' },
      { resource: 'insurance.claims', action: 'read' },
      { resource: 'insurance.claims', action: 'create' },
      { resource: 'insurance.claims', action: 'update' },
      { resource: 'insurance.preauth', action: 'read' },
      { resource: 'insurance.preauth', action: 'create' },
      { resource: 'insurance.preauth', action: 'update' },
      { resource: 'insurance.settlement', action: 'read' },
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
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
      { resource: 'doctors.schedule', action: 'read' },
      { resource: 'doctors.schedule', action: 'update' },
      { resource: 'doctors.leave', action: 'read' },
      { resource: 'doctors.leave', action: 'approve' },
      { resource: 'doctors.leave', action: 'manage' },
      { resource: 'doctors.documents', action: 'read' },
      { resource: 'doctors.documents', action: 'manage' },
      { resource: 'staff', action: 'read' },
      { resource: 'staff', action: 'create' },
      { resource: 'staff', action: 'update' },
      { resource: 'staff', action: 'delete' },
      { resource: 'staff.documents', action: 'read' },
      { resource: 'staff.documents', action: 'manage' },
      // HR runs Attendance/Leave/Shifts/Payroll Prep end to end for every
      // staff member, plus the same self-service actions on their own
      // record (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read' },
      { resource: 'attendance', action: 'create' },
      { resource: 'attendance', action: 'update' },
      { resource: 'attendance', action: 'manage' },
      { resource: 'leave', action: 'read' },
      { resource: 'leave', action: 'approve' },
      { resource: 'leave', action: 'manage' },
      { resource: 'shifts', action: 'read' },
      { resource: 'shifts', action: 'create' },
      { resource: 'shifts', action: 'update' },
      { resource: 'shifts', action: 'delete' },
      { resource: 'shifts.roster', action: 'read' },
      { resource: 'shifts.roster', action: 'create' },
      { resource: 'shifts.roster', action: 'update' },
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
      { resource: 'users', action: 'read' },
      { resource: 'departments', action: 'read' },
    ],
    user: { email: 'hr@medicore.demo', firstName: 'Vikram', lastName: 'Nair' },
  },
  {
    // `SystemRole.INVENTORY_MANAGER` already existed in the enum from the
    // original scaffolding commit but had no ROLE_SPEC — the same
    // situation `LAB_TECHNICIAN`/`RADIOLOGY_TECHNICIAN` were in before
    // their own milestones (ADR-0012/ADR-0013). All-scope across every
    // `inventory.*` sub-resource — a store/inventory manager runs the
    // whole general-inventory-and-procurement workflow end to end.
    slug: 'inventory-manager',
    name: 'Inventory Manager',
    systemRole: SystemRole.INVENTORY_MANAGER,
    permissions: [
      { resource: 'inventory.items', action: 'read' },
      { resource: 'inventory.items', action: 'create' },
      { resource: 'inventory.items', action: 'update' },
      { resource: 'inventory.items', action: 'delete' },
      { resource: 'inventory.stores', action: 'read' },
      { resource: 'inventory.stores', action: 'create' },
      { resource: 'inventory.stores', action: 'update' },
      { resource: 'inventory.stores', action: 'delete' },
      { resource: 'inventory.stock', action: 'read' },
      { resource: 'inventory.stock', action: 'create' },
      { resource: 'inventory.stock', action: 'update' },
      { resource: 'inventory.procurement', action: 'read' },
      { resource: 'inventory.procurement', action: 'create' },
      { resource: 'inventory.procurement', action: 'update' },
      { resource: 'inventory.procurement', action: 'approve' },
      { resource: 'inventory.procurement', action: 'manage' },
      { resource: 'inventory.vendors', action: 'read' },
      { resource: 'inventory.vendors', action: 'create' },
      { resource: 'inventory.vendors', action: 'update' },
      { resource: 'inventory.requests', action: 'read' },
      { resource: 'inventory.requests', action: 'create' },
      { resource: 'inventory.requests', action: 'update' },
      { resource: 'inventory.requests', action: 'approve' },
      { resource: 'inventory.assets', action: 'read' },
      { resource: 'inventory.assets', action: 'create' },
      { resource: 'inventory.assets', action: 'update' },
      { resource: 'inventory.audit', action: 'read' },
      { resource: 'inventory.audit', action: 'create' },
      { resource: 'inventory.audit', action: 'update' },
      { resource: 'inventory.audit', action: 'manage' },
      // Self-service: clock in/out, request corrections, apply/cancel own
      // leave, view own roster (Milestone 14 / ADR-0022).
      { resource: 'attendance', action: 'read', scope: 'own' },
      { resource: 'attendance', action: 'create', scope: 'own' },
      { resource: 'attendance', action: 'update', scope: 'own' },
      { resource: 'leave', action: 'read', scope: 'own' },
      { resource: 'leave', action: 'manage', scope: 'own' },
      { resource: 'shifts.roster', action: 'read', scope: 'own' },
    ],
    user: { email: 'inventorymanager@medicore.demo', firstName: 'Deepak', lastName: 'Joshi' },
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
  await syncRolePermissions(prisma, superAdminRole.id, allPermissions.map((p) => p.id))

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
    await syncRolePermissions(prisma, role.id, permissionIds)

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
