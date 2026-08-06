'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertTriangle,
  Calendar,
  CalendarPlus,
  FileText,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { SkeletonText } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { apiClient } from '@/lib/api/client'
import { getDoctorDashboardStats } from '@/lib/api/doctors'
import { getRecentDuplicateAlerts, getTodayRegistrationsCount, listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'

interface AuditLogEntry {
  id: string
  action: string
  resource: string
  createdAt: string
}

interface HealthStatus {
  status: string
  database: boolean
  redis: boolean
}

const QUICK_ACTIONS = [
  { label: 'Add Patient', href: '/dashboard/patients', icon: UserPlus, permission: 'patients.create' },
  {
    label: 'New Appointment',
    href: '/dashboard/appointments',
    icon: CalendarPlus,
    permission: 'appointments.create',
  },
  { label: 'Create Invoice', href: '/dashboard/billing', icon: FileText, permission: 'billing.create' },
]

function formatAction(action: string): string {
  return action.replace(/[._]/g, ' ')
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth()

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const activityQuery = useQuery({
    queryKey: ['audit-logs', 'recent'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: AuditLogEntry[] }>('/audit-logs', {
        params: { limit: 10 },
      })
      return data.data
    },
    enabled: hasPermission('audit.read'),
  })

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: HealthStatus }>('/health')
      return data.data
    },
    retry: false,
    refetchInterval: 60_000,
  })

  const canReadPatients = hasPermission('patients.read')

  const patientCountQuery = useQuery({
    queryKey: ['patients', 'list', 'dashboard-count'],
    queryFn: () => listPatients({ page: 1, limit: 1 }),
    enabled: canReadPatients,
  })

  const todayRegistrationsQuery = useQuery({
    queryKey: ['patients', 'stats', 'today'],
    queryFn: getTodayRegistrationsCount,
    enabled: canReadPatients,
  })

  const recentRegistrationsQuery = useQuery({
    queryKey: ['patients', 'list', 'dashboard-recent'],
    queryFn: () => listPatients({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: canReadPatients,
  })

  const duplicateAlertsQuery = useQuery({
    queryKey: ['patients', 'duplicates', 'recent'],
    queryFn: () => getRecentDuplicateAlerts(5),
    enabled: canReadPatients,
  })

  const canReadDoctors = hasPermission('doctors.read')

  const doctorStatsQuery = useQuery({
    queryKey: ['doctors', 'stats', 'dashboard'],
    queryFn: getDoctorDashboardStats,
    enabled: canReadDoctors,
  })

  const visibleActions = QUICK_ACTIONS.filter((action) => hasPermission(action.permission))

  return (
    <PageLayout
      title={user?.organizationName ?? 'MediCore'}
      description={`Welcome back, ${user?.firstName ?? ''}${user?.roles.length ? ` · ${user.roles.join(', ')}` : ''}`}
      actions={
        <PageHeaderMeta icon={Calendar}>{today}</PageHeaderMeta>
      }
    >
      {/* Quick actions */}
      {visibleActions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-xs transition-colors duration-fast hover:border-border-strong hover:bg-accent"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                <action.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium text-foreground">{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Patient & doctor stats */}
      {(canReadPatients || canReadDoctors) && (
        <StatCardGrid columns={4}>
          {canReadPatients && (
            <>
              <StatCard
                icon={Users}
                label="Total patients"
                value={patientCountQuery.data?.pagination.total}
                loading={patientCountQuery.isLoading}
                href="/dashboard/patients"
              />
              <StatCard
                icon={UserPlus}
                label="Today's registrations"
                value={todayRegistrationsQuery.data}
                loading={todayRegistrationsQuery.isLoading}
                href="/dashboard/patients"
              />
            </>
          )}
          {canReadDoctors && (
            <>
              <StatCard
                icon={Stethoscope}
                label="Total doctors"
                value={doctorStatsQuery.data?.totalDoctors}
                loading={doctorStatsQuery.isLoading}
                href="/dashboard/doctors"
              />
              <StatCard
                icon={Stethoscope}
                label="Active doctors"
                value={doctorStatsQuery.data?.activeDoctors}
                loading={doctorStatsQuery.isLoading}
                tone="success"
                href="/dashboard/doctors"
              />
            </>
          )}
        </StatCardGrid>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasPermission('audit.read') ? (
              <EmptyState
                compact
                title="No access to the audit log"
                description="Ask an administrator for audit.read to see recent activity here."
              />
            ) : activityQuery.isLoading ? (
              <SkeletonText lines={5} />
            ) : activityQuery.isError ? (
              <EmptyState compact variant="error" title="Couldn't load recent activity" />
            ) : activityQuery.data && activityQuery.data.length > 0 ? (
              <ul className="space-y-2">
                {activityQuery.data.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-foreground">{formatAction(entry.action)}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No activity yet" />
            )}
          </CardContent>
        </Card>

        {/* System status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              System status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API</span>
              <Badge variant={!healthQuery.isError ? 'success' : 'danger'} dot>
                {!healthQuery.isError ? 'Operational' : 'Down'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <Badge variant={healthQuery.data?.database ? 'success' : 'danger'} dot>
                {healthQuery.data?.database ? 'Operational' : 'Down'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cache</span>
              <Badge variant={healthQuery.data?.redis ? 'success' : 'danger'} dot>
                {healthQuery.data?.redis ? 'Operational' : 'Down'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Patient registrations & duplicate alerts */}
      {canReadPatients && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent registrations</CardTitle>
            </CardHeader>
            <CardContent>
              {recentRegistrationsQuery.isLoading ? (
                <SkeletonText lines={4} />
              ) : recentRegistrationsQuery.isError ? (
                <EmptyState compact variant="error" title="Couldn't load recent registrations" />
              ) : recentRegistrationsQuery.data && recentRegistrationsQuery.data.data.length > 0 ? (
                <ul className="space-y-2">
                  {recentRegistrationsQuery.data.data.map((patient) => (
                    <li key={patient.id} className="flex items-center justify-between text-sm">
                      <Link href={`/dashboard/patients/${patient.id}`} className="text-foreground hover:underline">
                        {patient.fullName}
                        <span className="ml-1.5 font-mono text-xs text-muted-foreground">{patient.uhid}</span>
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {new Date(patient.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compact
                  title="No patients yet"
                  action={{ label: 'Register patient', href: '/dashboard/patients' }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Duplicate alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {duplicateAlertsQuery.isLoading ? (
                <SkeletonText lines={4} />
              ) : duplicateAlertsQuery.isError ? (
                <EmptyState compact variant="error" title="Couldn't load duplicate alerts" />
              ) : duplicateAlertsQuery.data && duplicateAlertsQuery.data.length > 0 ? (
                <ul className="space-y-2">
                  {duplicateAlertsQuery.data.map((match) => (
                    <li key={match.patient.id} className="text-sm">
                      <Link
                        href={`/dashboard/patients/${match.patient.id}`}
                        className="text-foreground hover:underline"
                      >
                        {match.patient.fullName}
                      </Link>
                      <span className="text-muted-foreground"> · {match.patient.phone} · {match.confidence}% match</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact title="No likely duplicates detected recently" />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageLayout>
  )
}
