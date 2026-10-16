import {
  Activity,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Scan,
  Settings,
  SlidersHorizontal,
  Stethoscope,
  Truck,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import type { ElementType } from 'react'

import type { NavSection, QuickAction } from './nav-config'

/**
 * Navigation configuration for the Grovyn Dental OS application shell.
 *
 * Uses the same `NavSection` / `NavItem` shape as the Hospital nav-config so
 * the same `<Sidebar>` and command-palette components can render it without
 * modification.
 *
 * Permission strings follow the `dental_<resource>.<action>` convention
 * established for Dental OS in the architecture proposal. The `hasPermission`
 * hook appends `.all`/`.own` automatically.
 *
 * Items without a `permission` field are always visible to any authenticated
 * dental user (e.g. the dashboard, settings).
 */

// Lucide doesn't yet have a Tooth icon in older versions — use Stethoscope as
// placeholder for clinical items and Scan for odontogram. We export this array
// so the command palette can read it without touching any Hospital code.

export const dentalNavigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dental',
        icon: LayoutDashboard,
      },
      {
        label: 'Patients',
        href: '/dental/patients',
        icon: Users,
        permission: 'patients.read',
        children: [
          { label: 'All Patients', href: '/dental/patients', permission: 'patients.read' },
        ],
      },
      {
        label: 'Appointments',
        href: '/dental/appointments',
        icon: Calendar,
        permission: 'appointments.read',
      },
      {
        label: 'Chair Queue',
        href: '/dental/queue',
        icon: Activity,
        permission: 'appointments.read',
      },
    ],
  },
  {
    title: 'Clinical',
    items: [
      {
        label: 'Encounters',
        href: '/dental/clinical',
        icon: ClipboardList,
        permission: 'dental_encounters.read',
      },
      {
        label: 'Odontogram',
        href: '/dental/odontogram',
        icon: Scan,
        permission: 'dental_odontogram.read',
      },
      {
        label: 'Treatment Plans',
        href: '/dental/treatment-plans',
        icon: FileText,
        permission: 'dental_treatment_plans.read',
      },
      {
        label: 'Prescriptions',
        href: '/dental/prescriptions',
        icon: Stethoscope,
        permission: 'prescriptions.read',
      },
    ],
  },
  {
    title: 'Operations',
    items: [
      {
        label: 'Billing',
        href: '/dental/billing',
        icon: CreditCard,
        permission: 'billing.read',
        children: [
          { label: 'Invoices', href: '/dental/billing/invoices', permission: 'billing.read' },
          { label: 'Payments', href: '/dental/billing/payments', permission: 'billing.read' },
          { label: 'Patient Ledger', href: '/dental/billing/ledger', permission: 'billing.read' },
        ],
      },
      {
        label: 'Lab Cases',
        href: '/dental/lab-cases',
        icon: Package,
        permission: 'dental_lab_cases.read',
      },
      {
        label: 'Vendors',
        href: '/dental/vendors',
        icon: Truck,
        permission: 'dental_vendors.read',
      },
      {
        label: 'Recalls',
        href: '/dental/recalls',
        icon: UserPlus,
        permission: 'dental_recalls.read',
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        label: 'Staff',
        href: '/dental/staff',
        icon: UserCog,
        permission: 'staff.read',
      },
      {
        label: 'Organization',
        href: '/dental/organization',
        icon: Settings,
        permission: 'organizations.read',
      },
      {
        label: 'Settings',
        href: '/dental/settings',
        icon: SlidersHorizontal,
        permission: 'organizations.update',
      },
    ],
  },
]

export const dentalQuickActions: QuickAction[] = [
  {
    label: 'Register patient',
    href: '/dental/patients/new',
    icon: UserPlus,
    permission: 'patients.create',
    description: 'New dental patient record with UHID',
  },
  {
    label: 'Book appointment',
    href: '/dental/appointments',
    icon: Calendar,
    permission: 'appointments.create',
    description: 'Schedule a chair or doctor visit',
  },
  {
    label: 'New treatment plan',
    href: '/dental/treatment-plans',
    icon: FileText,
    permission: 'dental_treatment_plans.create',
    description: 'Create restorative or surgical plan',
  },
  {
    label: 'New lab case',
    href: '/dental/lab-cases',
    icon: Package,
    permission: 'dental_lab_cases.create',
    description: 'Order crown, bridge, or denture from dental lab',
  },
  {
    label: 'New invoice',
    href: '/dental/billing/invoices',
    icon: CreditCard,
    permission: 'billing.create',
    description: 'Bill dental procedures or treatments',
  },
  {
    label: 'Add staff',
    href: '/dental/staff/directory',
    icon: UserCog,
    permission: 'staff.create',
    description: 'Onboard a dentist, assistant, or receptionist',
  },
]

/** Flattens dental sections + children into one list for the command palette. */
export function flattenDentalNavigation(
  isVisible: (permission?: string) => boolean,
): Array<{ label: string; href: string; icon: ElementType; section: string }> {
  const result: Array<{ label: string; href: string; icon: ElementType; section: string }> = []

  for (const section of dentalNavigation) {
    for (const item of section.items) {
      if (item.hiddenFromPalette || !isVisible(item.permission)) continue
      result.push({
        label: item.label,
        href: item.href,
        icon: item.icon,
        section: section.title || 'General',
      })

      for (const child of item.children ?? []) {
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
