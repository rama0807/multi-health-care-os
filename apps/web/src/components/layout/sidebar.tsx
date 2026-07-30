'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Building2,
  Calendar,
  ChevronRight,
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
  Users,
  UserCog,
} from 'lucide-react'

import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navigation: NavSection[] = [
  {
    title: '',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: Home },
      { label: 'Patients', href: '/dashboard/patients', icon: Users },
      { label: 'Appointments', href: '/dashboard/appointments', icon: Calendar },
      { label: 'Doctors', href: '/dashboard/doctors', icon: Stethoscope },
    ],
  },
  {
    title: 'Clinical',
    items: [
      { label: 'Medical Records', href: '/dashboard/medical-records', icon: ClipboardList },
      { label: 'Laboratory', href: '/dashboard/laboratory', icon: FlaskConical },
      { label: 'Radiology', href: '/dashboard/radiology', icon: Scan },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
      { label: 'Insurance', href: '/dashboard/insurance', icon: FileText },
      { label: 'Pharmacy', href: '/dashboard/pharmacy', icon: Pill },
      { label: 'Inventory', href: '/dashboard/inventory', icon: Package },
      { label: 'Wards & Beds', href: '/dashboard/wards', icon: Building2 },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Staff', href: '/dashboard/staff', icon: UserCog },
      { label: 'Reports', href: '/dashboard/reports', icon: Activity },
      { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

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
        {navigation.map((section, i) => (
          <div key={i} className="mb-4">
            {section.title && (
              <p className="mb-1 px-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
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
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t p-3">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
            U
          </div>
          <span className="flex-1 truncate text-left">User</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  )
}
