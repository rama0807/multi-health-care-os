import {
  Activity,
  Bell,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  Package,
  Pill,
  Scan,
  Settings,
  Sparkles,
  Stethoscope,
  Syringe,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import type { ElementType } from 'react'

/**
 * The single source of truth for application navigation.
 *
 * Extracted from `sidebar.tsx` so the sidebar, the command palette and the
 * quick-create menu all read the same list against the same permission check.
 * Previously the palette imported the sidebar component's module purely to get
 * at this array, which coupled "what pages exist" to "how the rail is drawn".
 *
 * Permission strings are checked with `useAuth().hasPermission`, which appends
 * `.all`/`.own` - so `patients.read` matches either scope.
 */

export interface NavItem {
  label: string
  href: string
  icon: ElementType
  /** "resource.action" - omit to always show the item. */
  permission?: string
  /** Nested destinations, rendered as a disclosure group in the sidebar. */
  children?: Array<Omit<NavItem, 'icon' | 'children'> & { icon?: ElementType }>
  /** Excludes the item from the command palette's Navigate list. */
  hiddenFromPalette?: boolean
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      {
        label: 'Patients',
        href: '/dashboard/patients',
        icon: Users,
        permission: 'patients.read',
        children: [
          { label: 'All patients', href: '/dashboard/patients', permission: 'patients.read' },
          {
            label: 'Register patient',
            href: '/dashboard/patients/new',
            permission: 'patients.create',
          },
        ],
      },
      {
        label: 'Appointments',
        href: '/dashboard/appointments',
        icon: Calendar,
        permission: 'appointments.read',
      },
      { label: 'Doctors', href: '/dashboard/doctors', icon: Stethoscope, permission: 'doctors.read' },
    ],
  },
  {
    title: 'Clinical',
    items: [
      {
        label: 'Medical Records',
        href: '/dashboard/medical-records',
        icon: ClipboardList,
        permission: 'medical_records.read',
      },
      {
        label: 'Laboratory',
        href: '/dashboard/laboratory',
        icon: FlaskConical,
        permission: 'laboratory.read',
      },
      {
        label: 'Radiology',
        href: '/dashboard/radiology',
        icon: Scan,
        permission: 'radiology.read',
        children: [
          { label: 'Overview', href: '/dashboard/radiology', permission: 'radiology.read' },
          { label: 'Orders', href: '/dashboard/radiology/orders', permission: 'radiology.read' },
          { label: 'Catalog', href: '/dashboard/radiology/catalog', permission: 'radiology.read' },
        ],
      },
      {
        label: 'Nursing',
        href: '/dashboard/nursing',
        icon: Syringe,
        permission: 'ipd.nursing.read',
        children: [
          { label: 'Overview', href: '/dashboard/nursing', permission: 'ipd.nursing.read' },
          { label: 'Tasks', href: '/dashboard/nursing/tasks', permission: 'ipd.tasks.read' },
          { label: 'Patients', href: '/dashboard/nursing/patients', permission: 'ipd.nursing.read' },
        ],
      },
      { label: 'AI Assistant', href: '/dashboard/ai', icon: Sparkles, permission: 'ai.read' },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Billing',
        href: '/dashboard/billing',
        icon: CreditCard,
        permission: 'billing.read',
        children: [
          { label: 'Overview', href: '/dashboard/billing', permission: 'billing.read' },
          { label: 'Invoices', href: '/dashboard/billing/invoices', permission: 'billing.read' },
          { label: 'Payments', href: '/dashboard/billing/payments', permission: 'billing.read' },
          { label: 'Refunds', href: '/dashboard/billing/refunds', permission: 'billing.read' },
        ],
      },
      {
        label: 'Insurance',
        href: '/dashboard/insurance',
        icon: FileText,
        permission: 'insurance.claims.read',
      },
      {
        label: 'Pharmacy',
        href: '/dashboard/pharmacy',
        icon: Pill,
        permission: 'pharmacy.read',
        children: [
          { label: 'Overview', href: '/dashboard/pharmacy', permission: 'pharmacy.read' },
          { label: 'Dispensing', href: '/dashboard/pharmacy/dispense', permission: 'pharmacy.read' },
          { label: 'Catalog', href: '/dashboard/pharmacy/catalog', permission: 'pharmacy.read' },
          { label: 'Stock', href: '/dashboard/pharmacy/stock', permission: 'pharmacy.read' },
        ],
      },
      {
        label: 'Inventory',
        href: '/dashboard/inventory',
        icon: Package,
        permission: 'inventory.items.read',
      },
      {
        label: 'IPD & Beds',
        href: '/dashboard/ipd',
        icon: Building2,
        permission: 'ipd.admissions.read',
        children: [
          { label: 'Overview', href: '/dashboard/ipd', permission: 'ipd.admissions.read' },
          { label: 'Admissions', href: '/dashboard/ipd/admissions', permission: 'ipd.admissions.read' },
          { label: 'Beds', href: '/dashboard/ipd/beds', permission: 'ipd.beds.read' },
          { label: 'Discharges', href: '/dashboard/ipd/discharges', permission: 'ipd.discharge.read' },
        ],
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      {
        label: 'Organization',
        href: '/dashboard/organization',
        icon: Landmark,
        permission: 'organizations.read',
      },
      {
        label: 'Staff',
        href: '/dashboard/staff',
        icon: UserCog,
        permission: 'staff.read',
        children: [
          { label: 'Overview', href: '/dashboard/staff', permission: 'staff.read' },
          { label: 'Directory', href: '/dashboard/staff/directory', permission: 'staff.read' },
          { label: 'Attendance', href: '/dashboard/staff/attendance', permission: 'attendance.read' },
          { label: 'Roster', href: '/dashboard/staff/roster', permission: 'shifts.roster.read' },
          { label: 'Leave', href: '/dashboard/staff/leave', permission: 'leave.read' },
        ],
      },
      { label: 'Reports', href: '/dashboard/reports', icon: Activity, permission: 'reports.read' },
      {
        label: 'Notifications',
        href: '/dashboard/notifications/admin',
        icon: Bell,
        // The admin console only. Every user reaches their *own* centre from
        // the bell in the header, which needs no permission at all.
        permission: 'notifications.read',
      },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
]

/**
 * Actions offered by the "New" button in the top bar and the sidebar.
 *
 * Every entry points at a route that already exists - a quick-create menu that
 * offers a flow the user cannot complete is worse than no menu, and this list
 * is permission-filtered by the same `hasPermission` check as navigation.
 */
export interface QuickAction {
  label: string
  href: string
  icon: ElementType
  permission?: string
  description?: string
}

export const quickActions: QuickAction[] = [
  {
    label: 'Register patient',
    href: '/dashboard/patients/new',
    icon: UserPlus,
    permission: 'patients.create',
    description: 'New patient record with UHID',
  },
  {
    label: 'Book appointment',
    href: '/dashboard/appointments',
    icon: Calendar,
    permission: 'appointments.create',
    description: 'Schedule against a doctor’s availability',
  },
  {
    label: 'New invoice',
    href: '/dashboard/billing/invoices',
    icon: CreditCard,
    permission: 'billing.create',
    description: 'Bill pending charges or add line items',
  },
  {
    label: 'Admit patient',
    href: '/dashboard/ipd/admissions',
    icon: Building2,
    permission: 'ipd.admissions.create',
    description: 'Start the IPD admission wizard',
  },
  {
    label: 'Add doctor',
    href: '/dashboard/doctors/new',
    icon: Stethoscope,
    permission: 'doctors.create',
    description: 'Onboard a doctor and their login',
  },
]

/** Flattens sections + children into one list for the command palette. */
export function flattenNavigation(
  isVisible: (permission?: string) => boolean,
): Array<{ label: string; href: string; icon: ElementType; section: string }> {
  const result: Array<{ label: string; href: string; icon: ElementType; section: string }> = []

  for (const section of navigation) {
    for (const item of section.items) {
      if (item.hiddenFromPalette || !isVisible(item.permission)) continue
      result.push({
        label: item.label,
        href: item.href,
        icon: item.icon,
        section: section.title || 'General',
      })

      for (const child of item.children ?? []) {
        // Skip a child that merely repeats its parent's destination.
        if (child.href === item.href || !isVisible(child.permission)) continue
        result.push({
          label: `${item.label} · ${child.label}`,
          href: child.href,
          icon: child.icon ?? item.icon,
          section: section.title || 'General',
        })
      }
    }
  }

  return result
}
