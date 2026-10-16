'use client'

import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Calendar,
  IndianRupee,
  Package,
  TrendingUp,
  Users,
  CheckCircle2,
  Phone,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import type { ElementType, ReactNode } from 'react'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Skeleton, SkeletonText } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { getDentalDashboardSummary } from '@/lib/api/dental'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

function money(value: string | number | undefined): string {
  if (value === undefined) return '-'
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
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
  metrics: Array<{ label: string; value: ReactNode; tone?: 'default' | 'warning' | 'danger' }>
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
                  metric.tone === 'warning' && metric.value && 'text-warning-subtle-foreground',
                  metric.tone === 'danger' && metric.value && 'text-danger-subtle-foreground',
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

function NeedsAttentionCard({
  item,
}: {
  item: {
    id: string
    type: string
    title: string
    description: string
    count: number
    href: string
    severity: 'high' | 'medium' | 'low'
  }
}) {
  const toneMap: Record<string, 'danger' | 'warning' | 'default'> = {
    high: 'danger',
    medium: 'warning',
    low: 'default',
  }

  const tone = toneMap[item.severity]
  
  return (
    <Link href={item.href} className="group block">
      <Card className="transition-[border-color,box-shadow] duration-fast hover:border-border-strong hover:shadow-sm">
        <CardContent className="flex items-center gap-4 p-4">
           <div className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              tone === 'danger' ? 'bg-danger-subtle text-danger-subtle-foreground' : 
              tone === 'warning' ? 'bg-warning-subtle text-warning-subtle-foreground' :
              'bg-primary-subtle text-primary-subtle-foreground'
            )}>
              <AlertTriangle className="size-5" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {item.title}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
            </div>
            <div className="shrink-0 text-muted-foreground">
               <span className="text-xs font-medium uppercase hover:underline">Review</span>
            </div>
        </CardContent>
      </Card>
    </Link>
  )
}


export default function DentalDashboardPage() {
  const { user, hasPermission } = useAuth()
  
  const isOwner = hasPermission('organization.manage')
  const isDentist = hasPermission('dental_encounters.read')
  const isAccountant = hasPermission('dental_billing.read')

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const { data: summary, isLoading } = useQuery({
    queryKey: ['dental-dashboard-summary'],
    queryFn: getDentalDashboardSummary,
    refetchInterval: 60_000,
  })

  return (
    <div className="space-y-8 pb-8">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Good morning, {user?.firstName ? `Dr. ${user.firstName}` : 'Doctor'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
      </div>

      {/* ── 1. Primary KPIs (TODAY) ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Today&apos;s Operations</h2>
        </div>
        <StatCardGrid>
          <StatCard
            icon={Calendar}
            label="Appointments"
            value={summary?.appointments?.total}
            hint={
              summary?.appointments ? (
                 <span>
                  {summary.appointments.confirmed ?? 0} confirmed &middot; {summary.appointments.noShow ?? 0} no-show
                 </span>
              ) : undefined
            }
            href="/dental/appointments"
            loading={isLoading}
          />
          <StatCard
            icon={Users}
            label="Patients"
            value={summary?.patients?.total}
            hint={
              summary?.patients ? (
                 <span>
                  {summary.patients.returning ?? 0} returning &middot; {summary.patients.newPatients ?? 0} new
                 </span>
              ) : undefined
            }
            href="/dental/patients"
            loading={isLoading}
          />
           {(isOwner || isDentist) && (
              <StatCard
                icon={TrendingUp}
                label="Production"
                value={isLoading ? undefined : money(summary?.todayFinancials?.production)}
                href="/dental/billing"
                loading={isLoading}
              />
            )}
            {(isOwner || isAccountant) && (
              <StatCard
                icon={IndianRupee}
                label="Collections"
                value={isLoading ? undefined : money(summary?.todayFinancials?.collections)}
                href="/dental/billing/payments"
                loading={isLoading}
                tone="success"
              />
            )}
        </StatCardGrid>
      </section>

      {/* ── 2. Needs Attention ────────────────────────────────────────────── */}
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 space-y-4">
           <h2 className="text-base font-semibold tracking-tight">Today&apos;s Clinic</h2>
           <Card className="flex h-[350px] flex-col overflow-hidden">
             {isLoading ? (
                <div className="p-4"><SkeletonText lines={4} /></div>
             ) : (summary?.todaysClinic && summary.todaysClinic.length > 0) ? (
                <div className="flex-1 overflow-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-surface text-xs uppercase text-muted-foreground z-10 border-b">
                         <tr>
                           <th className="px-4 py-3 font-medium">Time</th>
                           <th className="px-4 py-3 font-medium">Patient</th>
                           <th className="px-4 py-3 font-medium">Provider</th>
                           <th className="px-4 py-3 font-medium text-right">Status</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                          {summary.todaysClinic.map(apt => {
                            const time = new Date(apt.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            let badgeTone: BadgeProps['variant'] = 'default'
                            if (apt.status === 'CONFIRMED') badgeTone = 'solid'
                            if (apt.status === 'IN_PROGRESS' || apt.status === 'ARRIVED') badgeTone = 'warning'
                            if (apt.status === 'COMPLETED') badgeTone = 'success'
                            if (apt.status === 'CANCELLED' || apt.status === 'NO_SHOW') badgeTone = 'danger'
                            
                            return (
                               <tr key={apt.id} className="transition-colors hover:bg-muted/30">
                                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{time}</td>
                                  <td className="px-4 py-3">
                                      <Link href={`/dental/patients/${apt.patient.id}`} className="font-medium text-foreground hover:underline">
                                          {apt.patient.firstName} {apt.patient.lastName}
                                      </Link>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                                      {apt.doctor ? `Dr. ${apt.doctor.user.lastName}` : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <Badge variant={badgeTone}>{apt.status.replace('_', ' ')}</Badge>
                                  </td>
                               </tr>
                            )
                          })}
                      </tbody>
                   </table>
                </div>
             ) : (
                <EmptyState icon={Calendar} title="No appointments today" description="Take a break or schedule a new patient." />
             )}
           </Card>
        </section>

        <section className="space-y-4">
           <h2 className="text-base font-semibold tracking-tight text-danger">Needs Attention</h2>
           {isLoading ? (
             <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
           ) : summary?.attention && summary.attention.length > 0 ? (
             <div className="space-y-3">
               {summary.attention.map(item => (
                  <NeedsAttentionCard key={item.id} item={item} />
               ))}
             </div>
           ) : (
             <Card className="flex h-[200px] items-center justify-center border-dashed bg-muted/20">
               <div className="text-center">
                 <CheckCircle2 className="mx-auto size-8 text-muted-foreground/50" />
                 <p className="mt-2 text-sm font-medium text-muted-foreground">All caught up</p>
               </div>
             </Card>
           )}
        </section>
      </div>

       {/* ── 3. Queues & Workflows ─────────────────────────────────────────── */}
       <section className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight">Workflows</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QueueCard
                icon={Users}
                title="Chair Queue"
                href="/dental/appointments"
                loading={isLoading}
                metrics={[
                  { label: 'Waiting', value: summary?.appointments?.inProgress ?? 0, tone: 'warning' },
                  { label: 'Completed', value: summary?.appointments?.completed ?? 0 },
                ]}
              />
               <QueueCard
                icon={FileText}
                title="Treatment Pipeline"
                href="/dental/treatment-plans"
                loading={isLoading}
                metrics={[
                  { label: 'Proposed', value: isLoading ? undefined : money(summary?.pipeline?.proposed) },
                  { label: 'Accepted', value: isLoading ? undefined : money(summary?.pipeline?.accepted), tone: 'default' },
                ]}
              />
               <QueueCard
                icon={Package}
                title="Lab & Restorations"
                href="/dental/lab-cases"
                loading={isLoading}
                metrics={[
                  { label: 'Active', value: summary?.lab?.active ?? 0 },
                  { label: 'Overdue', value: summary?.lab?.overdue ?? 0, tone: 'danger' },
                ]}
              />
               <QueueCard
                icon={Phone}
                title="Patient Follow-up"
                href="/dental/recalls"
                loading={isLoading}
                metrics={[
                  { label: 'Due Today', value: summary?.recalls?.dueToday ?? 0 },
                  { label: 'Overdue', value: summary?.recalls?.overdue ?? 0, tone: 'warning' },
                ]}
              />
          </div>
       </section>

        {/* ── 4. Financial Health (Admins & Accountants) ───────────────────── */}
        {(isOwner || isAccountant) && (
            <section className="space-y-3">
                <h2 className="text-base font-semibold tracking-tight">Financial Health (MTD)</h2>
                <Card>
                   <CardContent className="flex flex-col sm:flex-row sm:divide-x divide-border/70 p-4">
                        <div className="flex-1">
                            <OverviewMetric label="Production" value={isLoading ? undefined : money(summary?.revenue?.production)} loading={isLoading} />
                        </div>
                        <div className="flex-1">
                            <OverviewMetric label="Collections" value={isLoading ? undefined : money(summary?.revenue?.collections)} loading={isLoading} />
                        </div>
                        <div className="flex-1">
                            <OverviewMetric label="Outstanding" value={isLoading ? undefined : money(summary?.revenue?.outstanding)} loading={isLoading} />
                        </div>
                        <div className="flex-1">
                            <OverviewMetric label="Discounts" value={isLoading ? undefined : money(summary?.revenue?.discounts)} loading={isLoading} />
                        </div>
                   </CardContent>
                </Card>
            </section>
        )}
    </div>
  )
}
