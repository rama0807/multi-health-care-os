'use client'

import { OrganizationType } from '@medicore/types'
import {
  Accessibility,
  ArrowRight,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  KeyRound,
  Laptop2,
  Lock,
  Mail,
  Palette,
  Package,
  Scan,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import * as React from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAuth } from '@/lib/auth/auth-context'
import { humanizeRole, initials } from '@/lib/format'

export interface ProfileViewProps {
  basePath?: '/dashboard' | '/dental'
}

export function ProfileView({ basePath: explicitBasePath }: ProfileViewProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  const isDental = explicitBasePath
    ? explicitBasePath === '/dental'
    : pathname?.startsWith('/dental') || user?.organizationType === OrganizationType.DENTAL

  const basePath = explicitBasePath ?? (isDental ? '/dental' : '/dashboard')

  if (!user) {
    return (
      <PageLayout title="User Profile" loading>
        <div />
      </PageLayout>
    )
  }

  const basics = [
    Boolean(user.firstName && user.lastName),
    Boolean(user.email),
    Boolean(user.avatar),
  ]
  const completed = basics.filter(Boolean).length

  const scopeLabel = isDental
    ? 'All Operatories & Practice Areas'
    : user.hospitalIds.length === 0
      ? 'All Facilities & Departments'
      : `${user.hospitalIds.length} hospital facility${user.hospitalIds.length === 1 ? '' : 'ies'}`

  const quickLinks = [
    { href: `${basePath}/settings?section=security`, label: 'Change password', desc: 'Manage your credentials and authentication', icon: KeyRound },
    { href: `${basePath}/settings?section=sessions`, label: 'Active sessions', desc: 'View logged in devices and manage sessions', icon: Laptop2 },
    { href: `${basePath}/notifications/preferences`, label: 'Notification preferences', desc: 'Configure channels, quiet hours and alerts', icon: Bell },
    { href: `${basePath}/settings?section=appearance`, label: 'Appearance & theme', desc: 'Select dark/light mode and accent colors', icon: Palette },
    { href: `${basePath}/settings?section=accessibility`, label: 'Accessibility', desc: 'High contrast, reduce motion, font size', icon: Accessibility },
  ]

  // Group user's permissions into high-level functional domains
  const dentalCapabilities = [
    { label: 'Patient Management', perm: 'patients', icon: Users },
    { label: 'Appointments & Scheduling', perm: 'appointments', icon: Calendar },
    { label: 'Clinical Encounters', perm: 'encounters', icon: ClipboardList },
    { label: 'Odontogram & Charting', perm: 'dental', icon: Scan },
    { label: 'Treatment Plans', perm: 'treatment_plans', icon: FileText },
    { label: 'Prescriptions', perm: 'prescriptions', icon: Stethoscope },
    { label: 'Billing & Invoicing', perm: 'billing', icon: CreditCard },
    { label: 'Lab Cases', perm: 'lab', icon: Package },
  ]

  const hospitalCapabilities = [
    { label: 'Patient Records', perm: 'patients', icon: Users },
    { label: 'Appointments', perm: 'appointments', icon: Calendar },
    { label: 'Clinical Encounters', perm: 'encounters', icon: ClipboardList },
    { label: 'Prescriptions & Pharmacy', perm: 'prescriptions', icon: Stethoscope },
    { label: 'Laboratory & Radiology', perm: 'lab', icon: FileText },
    { label: 'Inpatient (IPD) & Nursing', perm: 'ipd', icon: Building2 },
    { label: 'Billing & Claims', perm: 'billing', icon: CreditCard },
  ]

  const capabilities = isDental ? dentalCapabilities : hospitalCapabilities

  return (
    <PageLayout
      breadcrumbs={[
        { label: isDental ? 'Grovyn Dental OS' : 'Hospital OS', href: basePath },
        { label: 'User Profile' },
      ]}
      title="User Profile"
      description={`Manage your identity, clinical credentials, and account settings across ${isDental ? 'Grovyn Dental OS' : 'Grovyn Hospital OS'}.`}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`${basePath}/notifications/preferences`}>
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              Notifications
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`${basePath}/settings`}>
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Account Settings
            </Link>
          </Button>
        </div>
      }
    >
      {/* ─── Hero Identity Card ────────────────────────────────────────────────── */}
      <Card className="border-border bg-gradient-to-br from-card via-card to-muted/20 overflow-hidden shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="size-20 border-2 border-primary/20 shadow-sm">
                {user.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                  {initials(user.firstName, user.lastName)}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {user.firstName} {user.lastName}
                  </h1>
                  {user.isPlatform && (
                    <Badge variant="accent" className="gap-1 font-medium">
                      <Sparkles className="size-3 text-amber-500" />
                      Platform Owner
                    </Badge>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="size-3" />
                    Active Account
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-3.5" />
                    {user.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5" />
                    {user.organizationName}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {isDental ? (
                    <Badge variant="outline" className="border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300 gap-1 text-xs">
                      <Sparkles className="size-3 text-teal-500" />
                      Grovyn Dental OS
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary gap-1 text-xs">
                      <Building2 className="size-3 text-primary" />
                      Grovyn Hospital OS
                    </Badge>
                  )}
                  {user.roles.map((role) => (
                    <Badge key={role} variant="secondary" className="font-normal text-xs">
                      {humanizeRole(role)}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:min-w-[200px]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-muted-foreground">Profile Status</span>
                <span className="font-semibold text-foreground">{completed}/3 verified</span>
              </div>
              <Progress value={(completed / 3) * 100} className="h-2" />
              <p className="text-2xs text-muted-foreground">
                Email and clinical profile confirmed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* ─── Practice & Organization Details ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                Organization &amp; Healthcare Assignment
              </CardTitle>
              <CardDescription className="text-xs">
                Current organization membership and authorized facility access
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Organization</p>
                <p className="font-semibold text-foreground">{user.organizationName}</p>
                <p className="text-xs text-muted-foreground">Slug: @{user.organizationSlug}</p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Healthcare System</p>
                <p className="font-semibold text-foreground">
                  {isDental ? 'Grovyn Dental OS' : 'Grovyn Hospital OS'}
                </p>
                <p className="text-xs text-muted-foreground">Multi-tenant Cloud Architecture</p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Authorized Scope</p>
                <p className="font-semibold text-foreground">{scopeLabel}</p>
                <p className="text-xs text-muted-foreground">Multi-operatory / department access</p>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Security Roles</p>
                <p className="font-semibold text-foreground">
                  {user.roles.map(humanizeRole).join(', ') || 'Standard Clinical Staff'}
                </p>
                <p className="text-xs text-muted-foreground">{user.permissions.length} active permissions</p>
              </div>
            </CardContent>
          </Card>

          {/* ─── Clinical Capabilities & Modules ───────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="size-4 text-primary" />
                    Authorized Clinical Capabilities
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Functional areas accessible based on your assigned healthcare roles
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">
                  {user.permissions.length} Permissions
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {capabilities.map((cap) => {
                  const Icon = cap.icon
                  return (
                    <div
                      key={cap.label}
                      className="flex items-center justify-between rounded-lg border border-border/80 bg-surface px-3 py-2.5 text-xs transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="size-3.5" />
                        </div>
                        <span className="font-medium text-foreground">{cap.label}</span>
                      </div>
                      <span className="flex items-center gap-1 text-2xs text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="size-3" />
                        Enabled
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* ─── Security & Authentication Status ──────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                Security &amp; Account Protection
              </CardTitle>
              <CardDescription className="text-xs">
                Credentials, session state, and encryption standards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground text-xs">Password &amp; Encryption</p>
                  <p className="text-xs text-muted-foreground">
                    Protected with state-of-the-art Argon2id cryptographic hashing
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`${basePath}/settings?section=security`}>Update</Link>
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="font-medium text-foreground text-xs">Device &amp; Session Management</p>
                  <p className="text-xs text-muted-foreground">
                    Active session securely signed with rotating HttpOnly tokens
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`${basePath}/settings?section=sessions`}>Manage</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 col) - Quick Settings Links */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="size-4 text-primary" />
                Account Quick Links
              </CardTitle>
              <CardDescription className="text-xs">
                Jump directly to specific preferences and configuration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 p-3 pt-0">
              {quickLinks.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg p-2.5 text-xs text-foreground transition-colors hover:bg-muted/50 group"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Icon className="size-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="font-medium leading-none text-foreground group-hover:text-primary transition-colors">
                          {item.label}
                        </p>
                        <p className="text-2xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                  </Link>
                )
              })}

              <div className="pt-3 border-t mt-2">
                <Button asChild className="w-full" size="sm">
                  <Link href={`${basePath}/settings`}>
                    Open Complete Settings Workspace
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  )
}
