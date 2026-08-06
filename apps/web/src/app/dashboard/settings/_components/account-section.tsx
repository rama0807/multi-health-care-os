'use client'

import type { AuthenticatedUser } from '@medicore/types'
import { Briefcase, Camera, Check, Clock3, Globe2, ScrollText, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'

import { humanizeRole, initials } from './format'
import { NotAvailableCard } from './not-available-card'

export interface AccountSectionProps {
  user?: AuthenticatedUser
  loading: boolean
}

/**
 * Every field here is one of two honest states: a real value read from
 * `GET /auth/me`, shown read-only, or a field MediCore doesn't collect for a
 * user yet, shown as a disclosed gap rather than an input that would silently
 * discard whatever is typed into it.
 *
 * There is no self-service "update my profile" endpoint - the only write path
 * is the admin-only `PATCH /users/:id` - so nothing on this page can actually
 * save a name, phone or avatar change today. Making the fields read-only
 * (instead of editable-but-broken) is the deliberate choice; see
 * `lib/api/account.ts` for the exact gap.
 */
export function AccountSection({ user, loading }: AccountSectionProps) {
  if (loading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  const basics = [
    { label: 'Name', complete: Boolean(user.firstName && user.lastName) },
    { label: 'Email', complete: Boolean(user.email) },
    { label: 'Avatar', complete: Boolean(user.avatar) },
  ]
  const completed = basics.filter((b) => b.complete).length
  const hospitalScope = user.hospitalIds.length === 0 ? 'All hospitals' : `${user.hospitalIds.length} hospital${user.hospitalIds.length === 1 ? '' : 's'}`

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Account"
        description="Your identity in MediCore. Editing these details isn't available yet - contact your organization admin for changes."
      />

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary-subtle text-lg font-semibold text-primary-subtle-foreground">
            {user.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(user.firstName, user.lastName)
            )}
          </div>
          <div className="space-y-1.5">
            <Button variant="outline" size="sm" disabled className="gap-1.5">
              <Camera className="size-3.5" aria-hidden="true" />
              Upload photo
            </Button>
            <p className="text-xs text-muted-foreground">
              Avatar upload isn&apos;t available yet - there is no endpoint to store one.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basic details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="acct-first-name">First name</Label>
              <Input id="acct-first-name" value={user.firstName} disabled readOnly />
            </div>
            <div className="space-y-1">
              <Label htmlFor="acct-last-name">Last name</Label>
              <Input id="acct-last-name" value={user.lastName} disabled readOnly />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="acct-email">Email</Label>
              <Input id="acct-email" value={user.email} disabled readOnly />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This is how your name appears across MediCore:{' '}
            <span className="font-medium text-foreground">
              {user.firstName} {user.lastName}
            </span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role &amp; access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {user.roles.map((role) => (
              <Badge key={role} variant="outline">
                {humanizeRole(role)}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Scope: <span className="font-medium text-foreground">{hospitalScope}</span> in{' '}
            <span className="font-medium text-foreground">{user.organizationName}</span>. Roles are assigned by an
            organization admin in{' '}
            <a href="/dashboard/organization?section=people" className="text-primary underline-offset-2 hover:underline">
              Organization → People
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {basics.map((basic) => (
            <div key={basic.label} className="flex items-center gap-2 text-sm">
              {basic.complete ? (
                <Check className="size-3.5 text-success" aria-hidden="true" />
              ) : (
                <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
              )}
              <span className={basic.complete ? 'text-foreground' : 'text-muted-foreground'}>{basic.label}</span>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">
            {completed}/{basics.length} basics complete. Extended fields (job title, bio, department) aren&apos;t
            collected yet, so they aren&apos;t counted here.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
            <span>
              Last login: <span className="font-medium">not available</span>
            </span>
            <span>
              Member since: <span className="font-medium">not available</span>
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <SectionHeader title="Extended profile" description="Not part of a user's record yet - shown honestly rather than faked." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <NotAvailableCard
            icon={Briefcase}
            title="Job title & department"
            description="A user has no job title or department field yet - only Doctor and Staff profiles carry a department."
          />
          <NotAvailableCard
            icon={Globe2}
            title="Language & profile visibility"
            description="No language preference or profile-visibility setting exists on a user record."
          />
          <NotAvailableCard
            icon={Clock3}
            title="Timezone, date & time format"
            description="Timezone is stored per-user, but no endpoint exposes or lets you change it yet."
          />
          <NotAvailableCard
            icon={ScrollText}
            title="Bio"
            description="There is nowhere to write or read a personal bio yet."
          />
        </div>
      </div>
    </div>
  )
}
