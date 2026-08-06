'use client'

import type { ExecutiveDashboardKey, ReportFilterQuery } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { Building2, HeartPulse, LayoutDashboard, Settings2, Wallet } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { SegmentedNav } from '@/components/ui/segmented-nav'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatCardSkeleton } from '@/components/ui/skeleton'
import { StatCardGrid } from '@/components/ui/stat-card'
import { listDepartments } from '@/lib/api/hospitals'
import { getExecutiveDashboard } from '@/lib/api/reports'

import { ChartCard, ChartCardSkeleton } from './charts'
import { DashboardDataTable, KpiTile } from './report-filters'

const PERSPECTIVES: Array<{ value: ExecutiveDashboardKey; label: string; icon: React.ElementType }> = [
  { value: 'ceo', label: 'CEO', icon: LayoutDashboard },
  { value: 'medical-director', label: 'Medical Director', icon: HeartPulse },
  { value: 'operations', label: 'Operations', icon: Settings2 },
  { value: 'finance', label: 'Finance', icon: Wallet },
  { value: 'department', label: 'Department', icon: Building2 },
]

export interface OverviewSectionProps {
  perspective: ExecutiveDashboardKey
  onPerspectiveChange: (next: ExecutiveDashboardKey) => void
  filters: ReportFilterQuery
  onFiltersChange: (next: ReportFilterQuery) => void
}

/**
 * The executive overview - composed dashboards built from the same
 * per-module report services every other section in this hub calls
 * directly (Checkpoint 17.2's `DashboardsService`). CEO / Medical Director
 * / Operations / Finance are org-wide cuts of the same live data; Department
 * is the one perspective that needs a department chosen before it can run.
 */
export function OverviewSection({ perspective, onPerspectiveChange, filters, onFiltersChange }: OverviewSectionProps) {
  const departmentsQuery = useQuery({
    queryKey: ['reports', 'departments'],
    queryFn: () => listDepartments(),
    enabled: perspective === 'department',
  })
  const departments = departmentsQuery.data ?? []

  const ready = perspective !== 'department' || Boolean(filters.departmentId)

  const dashboardQuery = useQuery({
    queryKey: ['reports', 'dashboard', perspective, filters],
    queryFn: () => getExecutiveDashboard(perspective, filters),
    enabled: ready,
  })
  const dashboard = dashboardQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedNav items={PERSPECTIVES} value={perspective} onChange={onPerspectiveChange} size="sm" className="w-fit" />

        {perspective === 'department' && (
          <Select
            value={filters.departmentId ?? ''}
            onValueChange={(next) => onFiltersChange({ ...filters, departmentId: next })}
          >
            <SelectTrigger className="h-8 w-[220px] text-sm">
              <SelectValue placeholder="Select a department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!ready ? (
        <EmptyState compact title="Select a department to view its dashboard" />
      ) : dashboardQuery.isLoading ? (
        <div className="space-y-4">
          <StatCardSkeleton count={4} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCardSkeleton />
            <ChartCardSkeleton />
          </div>
        </div>
      ) : dashboardQuery.isError ? (
        <EmptyState
          variant="error"
          title="Could not load this dashboard"
          description={dashboardQuery.error.message}
          secondaryAction={{ label: 'Retry', onClick: () => void dashboardQuery.refetch() }}
        />
      ) : dashboard ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">{dashboard.title}</h2>
            <p className="text-xs text-muted-foreground">
              {dashboard.period.from} to {dashboard.period.to} · {dashboard.period.days} days · grouped by{' '}
              {dashboard.period.groupBy}
            </p>
          </div>

          <StatCardGrid columns={4}>
            {dashboard.kpis.map((kpi) => (
              <KpiTile key={kpi.key} kpi={kpi} />
            ))}
          </StatCardGrid>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {dashboard.charts.map((chart) => (
              <ChartCard key={chart.key} chart={chart} />
            ))}
          </div>

          <div className="space-y-4">
            {dashboard.tables.map((table) => (
              <DashboardDataTable key={table.key} table={table} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
