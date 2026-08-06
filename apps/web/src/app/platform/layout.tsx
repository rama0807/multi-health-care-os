'use client'

import { Bell, Building2, Globe2, Loader2, ScrollText, Search, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

/**
 * The Platform Owner console (Checkpoint 16.2).
 *
 * Deliberately its own route group with its own chrome - it does **not** reuse
 * the dashboard `Sidebar`/`Header`, so no tenant navigation, tenant branding,
 * or clinical module link is ever reachable from here. A user whose
 * organization is not the platform tenant is bounced back to their own
 * dashboard; the API enforces the same rule independently via `PlatformGuard`,
 * so this redirect is a courtesy, not the security boundary.
 */
const NAV = [
  { label: 'Overview', href: '/platform', icon: Globe2 },
  { label: 'Organizations', href: '/platform/organizations', icon: Building2 },
  { label: 'Hospitals', href: '/platform/hospitals', icon: ShieldAlert },
  { label: 'Notifications', href: '/platform/notifications', icon: Bell },
  { label: 'Audit log', href: '/platform/audit', icon: ScrollText },
  { label: 'Search', href: '/platform/search', icon: Search },
]

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const isPlatformOwner = Boolean(user?.isPlatform)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!isPlatformOwner) {
      router.replace('/dashboard')
    }
  }, [isLoading, isAuthenticated, isPlatformOwner, router])

  if (isLoading || !isAuthenticated || !isPlatformOwner) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r bg-card">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-xs font-bold text-background">
            P
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">MediCore</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Platform</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const isActive =
                item.href === '/platform' ? pathname === '/platform' : pathname.startsWith(item.href)
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
        </nav>

        <div className="space-y-2 border-t p-3">
          <p className="truncate px-2 text-xs text-muted-foreground">{user?.email}</p>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/dashboard">Leave console</Link>
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center border-b bg-card px-6">
          <p className="text-sm font-medium text-foreground">Platform administration</p>
          <span className="ml-3 rounded bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive">
            Cross-tenant
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
