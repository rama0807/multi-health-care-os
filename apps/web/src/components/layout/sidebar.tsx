'use client'

import {
  Activity,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  FileText,
  FlaskConical,
  Home,
  Package,
  Pill,
  Scan,
  Settings,
  Stethoscope,
  Syringe,
  Users,
  UserCog,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

export interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  /** "resource.action" — omit to always show the item */
  permission?: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const navigation: NavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
      { label: 'Patients', href: '/dashboard/patients', icon: Users, permission: 'patients.read' },
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
      { label: 'Radiology', href: '/dashboard/radiology', icon: Scan, permission: 'radiology.read' },
      { label: 'Nursing', href: '/dashboard/nursing', icon: Syringe, permission: 'ipd.nursing.read' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard, permission: 'billing.read' },
      { label: 'Insurance', href: '/dashboard/insurance', icon: FileText, permission: 'insurance.claims.read' },
      { label: 'Pharmacy', href: '/dashboard/pharmacy', icon: Pill, permission: 'pharmacy.read' },
      { label: 'Inventory', href: '/dashboard/inventory', icon: Package, permission: 'inventory.read' },
      {
        label: 'IPD & Beds',
        href: '/dashboard/ipd',
        icon: Building2,
        permission: 'ipd.admissions.read',
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Staff', href: '/dashboard/staff', icon: UserCog, permission: 'staff.read' },
      { label: 'Reports', href: '/dashboard/reports', icon: Activity, permission: 'reports.read' },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, hasPermission } = useAuth()

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            M
          </div>
          <span className="font-semibold text-sm">MediCore</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {navigation.map((section, i) => {
          const visibleItems = section.items.filter(
            (item) => !item.permission || hasPermission(item.permission),
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={i} className="mb-4">
              {section.title && (
                <p className="mb-1 px-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  {section.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                          isActive
                            ? 'bg-accent font-medium text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Organization footer */}
      {user && (
        <div className="border-t p-3">
          <p className="truncate px-2 text-xs text-muted-foreground">{user.organizationSlug}</p>
        </div>
      )}
    </aside>
  )
}
