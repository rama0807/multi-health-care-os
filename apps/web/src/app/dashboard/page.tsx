'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'

import { apiClient } from '@/lib/api/client'
import { getDoctorDashboardStats } from '@/lib/api/doctors'
import { getRecentDuplicateAlerts, getTodayRegistrationsCount, listPatients } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

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
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {user?.organizationName ?? 'MediCore'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.firstName}
            {user?.roles.length ? ` · ${user.roles.join(', ')}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          {today}
        </div>
      </div>

      {/* Quick actions */}
      {visibleActions.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <action.icon className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Patient stats */}
      {canReadPatients && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile
            icon={Users}
            label="Total Patients"
            value={patientCountQuery.data?.pagination.total}
            isLoading={patientCountQuery.isLoading}
          />
          <StatTile
            icon={UserPlus}
            label="Today's Registrations"
            value={todayRegistrationsQuery.data}
            isLoading={todayRegistrationsQuery.isLoading}
          />
        </div>
      )}

      {/* Doctor stats */}
      {canReadDoctors && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatTile
            icon={Stethoscope}
            label="Total Doctors"
            value={doctorStatsQuery.data?.totalDoctors}
            isLoading={doctorStatsQuery.isLoading}
          />
          <StatTile
            icon={Stethoscope}
            label="Active Doctors"
            value={doctorStatsQuery.data?.activeDoctors}
            isLoading={doctorStatsQuery.isLoading}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Recent activity */}
        <div className="rounded-lg border bg-card p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Recent Activity</h2>
          {!hasPermission('audit.read') ? (
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to view the audit log.
            </p>
          ) : activityQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activityQuery.isError ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t load recent activity.</p>
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
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          )}
        </div>

        {/* System status */}
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Activity className="h-3.5 w-3.5" />
            System Status
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">API</span>
              <StatusPill ok={!healthQuery.isError} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Database</span>
              <StatusPill ok={Boolean(healthQuery.data?.database)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cache</span>
              <StatusPill ok={Boolean(healthQuery.data?.redis)} />
            </div>
          </div>
        </div>
      </div>

      {/* Patient registrations & duplicate alerts */}
      {canReadPatients && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">Recent Registrations</h2>
            {recentRegistrationsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : recentRegistrationsQuery.isError ? (
              <p className="text-sm text-muted-foreground">Couldn&apos;t load recent registrations.</p>
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
              <p className="text-sm text-muted-foreground">No patients registered yet.</p>
            )}
          </div>

          <div className="rounded-lg border bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Duplicate Alerts
            </h2>
            {duplicateAlertsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : duplicateAlertsQuery.isError ? (
              <p className="text-sm text-muted-foreground">Couldn&apos;t load duplicate alerts.</p>
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
              <p className="text-sm text-muted-foreground">No likely duplicates detected recently.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: typeof Users
  label: string
  value: number | undefined
  isLoading: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">{isLoading ? '—' : (value ?? 0)}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        ok ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger',
      )}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {ok ? 'Operational' : 'Down'}
    </span>
  )
}
