'use client'

import { Accessibility, Bell, KeyRound, Laptop2, Palette } from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/lib/auth/auth-context'
import { humanizeRole, initials } from '@/lib/format'

const QUICK_LINKS = [
  { href: '/dashboard/settings?section=security', label: 'Change password', icon: KeyRound },
  { href: '/dashboard/settings?section=sessions', label: 'Active sessions', icon: Laptop2 },
  { href: '/dashboard/settings?section=appearance', label: 'Appearance', icon: Palette },
  { href: '/dashboard/settings?section=accessibility', label: 'Accessibility', icon: Accessibility },
  { href: '/dashboard/notifications/preferences', label: 'Notification preferences', icon: Bell },
] as const

/**
 * The header avatar menu's "Profile" destination - a quick, read-only glance
 * at who you are, distinct from the full `/dashboard/settings` workspace the
 * sidebar's own "Settings" item opens. Deliberately small: it repeats a few
 * facts `settings/_components/account-section.tsx` already shows (by design,
 * per the product decision to keep these as two separate destinations rather
 * than one page reached two ways), and every field on it is real - the same
 * `AuthenticatedUser` already held by `useAuth`, no extra fetch needed for a
 * page this size.
 */
export default function ProfilePage() {
  const { user } = useAuth()

  if (!user) {
    return (
      <PageLayout title="Profile" loading>
        <div />
      </PageLayout>
    )
  }

  const basics = [Boolean(user.firstName && user.lastName), Boolean(user.email), Boolean(user.avatar)]
  const completed = basics.filter(Boolean).length
  const hospitalScope =
    user.hospitalIds.length === 0 ? 'All hospitals' : `${user.hospitalIds.length} hospital${user.hospitalIds.length === 1 ? '' : 's'}`

  return (
    <PageLayout
      title="Profile"
      description="Who you are in MediCore. For password, sessions, appearance and everything else, open full account settings."
      actions={
        <Button asChild size="sm">
          <Link href="/dashboard/settings">Open full account settings</Link>
        </Button>
      }
      width="narrow"
    >
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-4">
          <Avatar className="size-16">
            {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
            <AvatarFallback className="bg-primary-subtle text-lg font-semibold text-primary-subtle-foreground">
              {initials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {user.firstName} {user.lastName}
              </h2>
              {user.isPlatform && <Badge variant="accent">Platform Owner</Badge>}
              {user.roles.map((role) => (
                <Badge key={role} variant="outline">
                  {humanizeRole(role)}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">Organization</p>
            <p className="text-sm text-foreground">{user.organizationName}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">Access scope</p>
            <p className="text-sm text-foreground">{hospitalScope}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">Permissions granted</p>
            <p className="text-sm text-foreground">{user.permissions.length}</p>
          </div>
          <div className="space-y-0.5 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">Profile completion</p>
            <div className="flex items-center gap-2">
              <Progress value={completed} max={3} size="sm" className="w-24" label="Profile completion" />
              <span className="text-sm text-foreground">{completed}/3 basics</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-1 pt-4">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-subtle-foreground">Quick links</p>
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2.5 rounded-md px-2 py-2 text-sm text-foreground transition-colors duration-fast hover:bg-surface-hover"
            >
              <link.icon className="size-4 text-muted-foreground" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
