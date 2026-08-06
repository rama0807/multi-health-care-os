'use client'

import { AppointmentStatus, LabTestStatus } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  Bed,
  Building2,
  Calendar,
  ClipboardList,
  FlaskConical,
  IndianRupee,
  LogIn,
  Pill,
  Stethoscope,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import type { ElementType, ReactNode } from 'react'

import { quickActions } from '@/components/layout/nav-config'
import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeaderMeta } from '@/components/ui/page-header'
import { Progress } from '@/components/ui/progress'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { Timeline, TimelineItem, type TimelineTone } from '@/components/ui/timeline'
import { listAppointments } from '@/lib/api/appointments'
import { getBillingDashboardStats } from '@/lib/api/billing'
import { apiClient } from '@/lib/api/client'
import { getDoctorDashboardStats } from '@/lib/api/doctors'
import { getIpdDashboardStats, listAdmissions } from '@/lib/api/ipd'
import { listLabOrders } from '@/lib/api/laboratory'
import { getRecentDuplicateAlerts, getTodayRegistrationsCount, listPatients } from '@/lib/api/patients'
import { getPharmacyDashboardStats } from '@/lib/api/pharmacy'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

interface HealthStatus {
  status: string
  database: boolean
  redis: boolean
}

interface ClinicalEvent {
  id: string
  kind: 'registration' | 'admission' | 'lab-report'
  title: string
  description: string
  timestamp: string
  icon: ElementType
  tone: TimelineTone
  href: string
}

function todayIso(): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function money(value: string | number | undefined): string {
  if (value === undefined) return '-'
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

/** A live operational queue - one module's actionable backlog, at a glance. */
function QueueCard({
  icon: Icon,
  title,
  href,
  loading,
  metrics,
}: {
  icon: ElementType
  title: string
  href: string
  loading?: boolean
  metrics: Array<{ label: string; value: number | undefined; tone?: 'default' | 'warning' | 'danger' }>
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-lg border bg-surface p-4 shadow-xs transition-[border-color,box-shadow] duration-fast hover:border-border-strong hover:shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="flex items-end gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex-1">
            {loading ? (
              <Skeleton className="h-7 w-10" />
            ) : (
              <p
                className={cn(
                  'text-2xl font-semibold tabular-nums tracking-tight text-foreground',
                  metric.tone === 'warning' && (metric.value ?? 0) > 0 && 'text-warning-subtle-foreground',
                  metric.tone === 'danger' && (metric.value ?? 0) > 0 && 'text-danger-subtle-foreground',
                )}
              >
                {metric.value ?? '-'}
              </p>
            )}
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">{metric.label}</p>
          </div>
        ))}
      </div>
    </Link>
  )
}

function OverviewMetric({
  label,
  value,
  loading,
  progress,
  progressTone = 'default',
}: {
  label: string
  value: ReactNode
  loading?: boolean
  progress?: number
  progressTone?: 'default' | 'warning' | 'danger'
}) {
  return (
    <div className="space-y-1.5 border-b border-border/70 py-3 first:pt-0 sm:border-b-0 sm:border-r sm:py-0 sm:pl-4 [&:nth-child(-n+1)]:sm:pl-0 last:border-none">
      <p className="text-2xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="h-6 w-14" />
      ) : (
        <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      )}
      {progress !== undefined && !loading && (
        <Progress value={progress} tone={progressTone} size="sm" label={label} />
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth()
  const today = todayIso()

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
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
  const canReadDoctors = hasPermission('doctors.read')
  const canReadIpd = hasPermission('ipd.admissions.read')
  const canReadBilling = hasPermission('billing.read')
  const canReadAppointments = hasPermission('appointments.read')
  const canReadLab = hasPermission('laboratory.read')
  const canReadPharmacy = hasPermission('pharmacy.read')
  const canReadNursingTasks = hasPermission('ipd.tasks.read')

  // ── Hospital Overview + headline KPIs ─────────────────────────────────────

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

  const duplicateAlertsQuery = useQuery({
    queryKey: ['patients', 'duplicates', 'recent'],
    queryFn: () => getRecentDuplicateAlerts(5),
    enabled: canReadPatients,
  })

  const doctorStatsQuery = useQuery({
    queryKey: ['doctors', 'stats', 'dashboard'],
    queryFn: getDoctorDashboardStats,
    enabled: canReadDoctors,
  })

  const ipdStatsQuery = useQuery({
    queryKey: ['ipd', 'dashboard-stats'],
    queryFn: getIpdDashboardStats,
    enabled: canReadIpd,
  })

  const billingStatsQuery = useQuery({
    queryKey: ['billing', 'dashboard-stats'],
    queryFn: getBillingDashboardStats,
    enabled: canReadBilling,
  })

  // ── Live queues ────────────────────────────────────────────────────────────

  const waitingQuery = useQuery({
    queryKey: ['appointments', 'list', { date: today, status: AppointmentStatus.ARRIVED, count: true }],
    queryFn: () => listAppointments({ date: today, status: AppointmentStatus.ARRIVED, limit: 1 }),
    enabled: canReadAppointments,
  })

  const inConsultationQuery = useQuery({
    queryKey: ['appointments', 'list', { date: today, status: AppointmentStatus.IN_CONSULTATION, count: true }],
    queryFn: () => listAppointments({ date: today, status: AppointmentStatus.IN_CONSULTATION, limit: 1 }),
    enabled: canReadAppointments,
  })

  const labAwaitingQuery = useQuery({
    queryKey: ['laboratory', 'orders', { status: LabTestStatus.ORDERED, count: true }],
    queryFn: () => listLabOrders({ status: LabTestStatus.ORDERED, limit: 1 }),
    enabled: canReadLab,
  })

  const labProcessingQuery = useQuery({
    queryKey: ['laboratory', 'orders', { status: LabTestStatus.IN_PROGRESS, count: true }],
    queryFn: () => listLabOrders({ status: LabTestStatus.IN_PROGRESS, limit: 1 }),
    enabled: canReadLab,
  })

  const pharmacyStatsQuery = useQuery({
    queryKey: ['pharmacy', 'dashboard-stats'],
    queryFn: getPharmacyDashboardStats,
    enabled: canReadPharmacy,
  })

  // ── Clinical activity feed ─────────────────────────────────────────────────

  const recentRegistrationsQuery = useQuery({
    queryKey: ['patients', 'list', 'dashboard-recent'],
    queryFn: () => listPatients({ page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: canReadPatients,
  })

  const recentAdmissionsQuery = useQuery({
    queryKey: ['ipd', 'admissions', 'dashboard-recent'],
    queryFn: () => listAdmissions({ limit: 5 }),
    enabled: canReadIpd,
  })

  const recentLabReportsQuery = useQuery({
    queryKey: ['laboratory', 'orders', 'dashboard-recent-reported'],
    queryFn: () => listLabOrders({ status: LabTestStatus.REPORTED, limit: 5 }),
    enabled: canReadLab,
  })

  const clinicalFeedLoading =
    (canReadPatients && recentRegistrationsQuery.isLoading) ||
    (canReadIpd && recentAdmissionsQuery.isLoading) ||
    (canReadLab && recentLabReportsQuery.isLoading)

  const clinicalEvents: ClinicalEvent[] = [
    ...(recentRegistrationsQuery.data?.data ?? []).map((patient) => ({
      id: `registration-${patient.id}`,
      kind: 'registration' as const,
      title: `${patient.fullName} registered`,
      description: `UHID ${patient.uhid}`,
      timestamp: new Date(patient.createdAt).toISOString(),
      icon: UserPlus,
      tone: 'info' as TimelineTone,
      href: `/dashboard/patients/${patient.id}`,
    })),
    ...(recentAdmissionsQuery.data?.data ?? []).map((admission) => ({
      id: `admission-${admission.id}`,
      kind: 'admission' as const,
      title: `${admission.patient.fullName} admitted`,
      description: `${admission.ward.name}${admission.bed ? ` · Bed ${admission.bed.bedNumber}` : ''} · ${admission.attendingDoctor.fullName}`,
      timestamp: new Date(admission.admittedAt).toISOString(),
      icon: LogIn,
      tone: 'success' as TimelineTone,
      href: `/dashboard/ipd/admissions`,
    })),
    ...(recentLabReportsQuery.data?.data ?? []).map((order) => ({
      id: `lab-${order.id}`,
      kind: 'lab-report' as const,
      title: `Lab report ready · ${order.patient.fullName}`,
      description: `Order ${order.labOrderNumber} · ${order.doctor.fullName}`,
      timestamp: new Date(order.reportedAt ?? order.createdAt).toISOString(),
      icon: FlaskConical,
      tone: 'default' as TimelineTone,
      href: `/dashboard/laboratory`,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  const visibleActions = quickActions.filter((action) => !action.permission || hasPermission(action.permission))

  const bedOccupancyTone =
    (ipdStatsQuery.data?.occupancyPercent ?? 0) >= 90
      ? 'danger'
      : (ipdStatsQuery.data?.occupancyPercent ?? 0) >= 75
        ? 'warning'
        : 'default'

  const revenueTrend = (() => {
    const trend = billingStatsQuery.data?.collectionTrend
    if (!trend || trend.length < 2) return undefined
    const latest = Number(trend[trend.length - 1].amount)
    const previous = Number(trend[trend.length - 2].amount)
    if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) return undefined
    const changePercent = ((latest - previous) / previous) * 100
    return {
      value: `${Math.abs(changePercent).toFixed(0)}%`,
      direction: changePercent > 0 ? ('up' as const) : changePercent < 0 ? ('down' as const) : ('flat' as const),
      intent: changePercent >= 0 ? ('positive' as const) : ('negative' as const),
      label: 'vs. yesterday',
    }
  })()

  const noOverviewAccess = !canReadPatients && !canReadDoctors && !canReadIpd && !canReadBilling

  return (
    <PageLayout
      title={user?.organizationName ?? 'MediCore'}
      description={`Welcome back, ${user?.firstName ?? ''}${user?.roles.length ? ` · ${user.roles.join(', ')}` : ''}`}
      actions={
        <>
          <PageHeaderMeta icon={Calendar}>{todayLabel}</PageHeaderMeta>
          <Badge variant={!healthQuery.isError ? 'success' : 'danger'} dot>
            {!healthQuery.isError ? 'All systems operational' : 'System issue detected'}
          </Badge>
        </>
      }
    >
      {/* Headline KPIs - the numbers that matter across every shift */}
      {!noOverviewAccess && (
        <StatCardGrid columns={4}>
          {canReadPatients && (
            <StatCard
              icon={Users}
              label="Total patients"
              value={patientCountQuery.data?.pagination.total}
              hint={`${todayRegistrationsQuery.data ?? 0} registered today`}
              loading={patientCountQuery.isLoading}
              href="/dashboard/patients"
            />
          )}
          {canReadIpd && (
            <StatCard
              icon={Bed}
              label="Bed occupancy"
              value={
                ipdStatsQuery.data ? `${Math.round(ipdStatsQuery.data.occupancyPercent)}%` : undefined
              }
              hint={
                ipdStatsQuery.data
                  ? `${ipdStatsQuery.data.occupiedBeds} of ${ipdStatsQuery.data.totalBeds} beds occupied`
                  : undefined
              }
              tone={bedOccupancyTone}
              loading={ipdStatsQuery.isLoading}
              href="/dashboard/ipd/beds"
            />
          )}
          {canReadBilling && (
            <StatCard
              icon={IndianRupee}
              label="Today's revenue"
              value={billingStatsQuery.data ? money(billingStatsQuery.data.todaysRevenue) : undefined}
              trend={revenueTrend}
              hint={revenueTrend ? undefined : billingStatsQuery.data ? `${billingStatsQuery.data.pendingInvoices} pending invoices` : undefined}
              loading={billingStatsQuery.isLoading}
              href="/dashboard/billing"
            />
          )}
          {canReadDoctors && (
            <StatCard
              icon={Stethoscope}
              label="Doctors available"
              value={doctorStatsQuery.data?.availableToday}
              hint={doctorStatsQuery.data ? `of ${doctorStatsQuery.data.activeDoctors} active doctors` : undefined}
              tone="success"
              loading={doctorStatsQuery.isLoading}
              href="/dashboard/doctors"
            />
          )}
        </StatCardGrid>
      )}

      {/* Hospital Overview - the operational detail behind the headline numbers */}
      {(canReadIpd || canReadDoctors) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Hospital overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3 lg:grid-cols-6">
              {canReadIpd && (
                <>
                  <OverviewMetric
                    label="Available beds"
                    value={ipdStatsQuery.data?.availableBeds ?? '-'}
                    loading={ipdStatsQuery.isLoading}
                  />
                  <OverviewMetric
                    label="ICU occupancy"
                    value={ipdStatsQuery.data ? `${Math.round(ipdStatsQuery.data.icuOccupancyPercent)}%` : '-'}
                    loading={ipdStatsQuery.isLoading}
                    progress={ipdStatsQuery.data?.icuOccupancyPercent}
                    progressTone={
                      (ipdStatsQuery.data?.icuOccupancyPercent ?? 0) >= 90
                        ? 'danger'
                        : (ipdStatsQuery.data?.icuOccupancyPercent ?? 0) >= 75
                          ? 'warning'
                          : 'default'
                    }
                  />
                  <OverviewMetric
                    label="Admissions today"
                    value={ipdStatsQuery.data?.admissionsToday ?? '-'}
                    loading={ipdStatsQuery.isLoading}
                  />
                  <OverviewMetric
                    label="Discharges today"
                    value={ipdStatsQuery.data?.dischargesToday ?? '-'}
                    loading={ipdStatsQuery.isLoading}
                  />
                  <OverviewMetric
                    label="Pending discharge"
                    value={ipdStatsQuery.data?.pendingDischarge ?? '-'}
                    loading={ipdStatsQuery.isLoading}
                  />
                </>
              )}
              {canReadDoctors && (
                <OverviewMetric
                  label="Doctors on leave"
                  value={doctorStatsQuery.data?.onLeaveToday ?? '-'}
                  loading={doctorStatsQuery.isLoading}
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live queues - what's waiting on staff right now */}
      {(canReadAppointments || canReadLab || canReadPharmacy || canReadIpd) && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Live queues</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canReadAppointments && (
              <QueueCard
                icon={Users}
                title="Patient queue"
                href="/dashboard/appointments"
                loading={waitingQuery.isLoading || inConsultationQuery.isLoading}
                metrics={[
                  { label: 'Waiting', value: waitingQuery.data?.pagination.total, tone: 'warning' },
                  { label: 'In consultation', value: inConsultationQuery.data?.pagination.total },
                ]}
              />
            )}
            {canReadLab && (
              <QueueCard
                icon={FlaskConical}
                title="Laboratory queue"
                href="/dashboard/laboratory"
                loading={labAwaitingQuery.isLoading || labProcessingQuery.isLoading}
                metrics={[
                  { label: 'Awaiting sample', value: labAwaitingQuery.data?.pagination.total, tone: 'warning' },
                  { label: 'Processing', value: labProcessingQuery.data?.pagination.total },
                ]}
              />
            )}
            {canReadPharmacy && (
              <QueueCard
                icon={Pill}
                title="Pharmacy queue"
                href="/dashboard/pharmacy/dispense"
                loading={pharmacyStatsQuery.isLoading}
                metrics={[
                  { label: 'Pending', value: pharmacyStatsQuery.data?.pending, tone: 'warning' },
                  { label: 'Ready', value: pharmacyStatsQuery.data?.ready },
                ]}
              />
            )}
            {canReadIpd && canReadNursingTasks && (
              <QueueCard
                icon={ClipboardList}
                title="Nursing tasks"
                href="/dashboard/nursing/tasks"
                loading={ipdStatsQuery.isLoading}
                metrics={[
                  { label: 'Pending', value: ipdStatsQuery.data?.pendingNursingTasks, tone: 'warning' },
                  { label: 'Transfers today', value: ipdStatsQuery.data?.transfersToday },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      {visibleActions.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Quick actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-start gap-3 rounded-lg border bg-surface p-3.5 shadow-xs transition-[border-color,box-shadow] duration-fast hover:border-border-strong hover:shadow-sm"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-subtle text-primary-subtle-foreground">
                  <action.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{action.label}</p>
                  {action.description && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.description}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Revenue trend + clinical activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Clinical activity</CardTitle>
          </CardHeader>
          <CardContent>
            {!canReadPatients && !canReadIpd && !canReadLab ? (
              <EmptyState compact title="No access to clinical activity" />
            ) : clinicalFeedLoading ? (
              <SkeletonText lines={6} />
            ) : clinicalEvents.length > 0 ? (
              <Timeline>
                {clinicalEvents.map((event, index) => (
                  <TimelineItem
                    key={event.id}
                    title={
                      <Link href={event.href} className="hover:underline">
                        {event.title}
                      </Link>
                    }
                    description={event.description}
                    icon={event.icon}
                    tone={event.tone}
                    timestamp={event.timestamp}
                    timestampLabel={formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                    last={index === clinicalEvents.length - 1}
                  />
                ))}
              </Timeline>
            ) : (
              <EmptyState compact title="No clinical activity yet today" />
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
            {!canReadPatients ? (
              <EmptyState compact title="No access to patients" />
            ) : duplicateAlertsQuery.isLoading ? (
              <SkeletonText lines={4} />
            ) : duplicateAlertsQuery.isError ? (
              <EmptyState compact variant="error" title="Couldn't load duplicate alerts" />
            ) : duplicateAlertsQuery.data && duplicateAlertsQuery.data.length > 0 ? (
              <ul className="space-y-3">
                {duplicateAlertsQuery.data.map((match) => (
                  <li key={match.patient.id} className="text-sm">
                    <Link
                      href={`/dashboard/patients/${match.patient.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {match.patient.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {match.patient.phone} · {match.confidence}% match
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No likely duplicates detected recently" />
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  )
}
