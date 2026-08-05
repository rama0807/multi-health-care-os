'use client'

import type { ExecutiveDashboardKey, ReportFilterQuery } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { listDepartments } from '@/lib/api/hospitals'
import { getExecutiveDashboard } from '@/lib/api/reports'

import { ChartCard } from './_components/charts'
import { DashboardDataTable, KpiTile, ReportFilters, defaultFilters } from './_components/report-filters'

const DASHBOARDS: Array<{ key: ExecutiveDashboardKey; label: string }> = [
  { key: 'ceo', label: 'CEO' },
  { key: 'medical-director', label: 'Medical Director' },
  { key: 'operations', label: 'Operations' },
  { key: 'finance', label: 'Finance' },
  { key: 'department', label: 'Department' },
]

/**
 * Executive dashboards (Milestone 17 Checkpoints 17.2/17.4).
 *
 * Every tile, chart and table on this page is rendered from what the API
 * returned — the page chooses no metrics of its own, so a change to a
 * dashboard's composition needs no frontend change.
 */
export default function ReportsDashboardPage() {
  const [active, setActive] = useState<ExecutiveDashboardKey>('ceo')
  const [filters, setFilters] = useState<ReportFilterQuery>(defaultFilters())

  const departmentsQuery = useQuery({
    queryKey: ['reports', 'departments'],
    queryFn: () => listDepartments(),
    enabled: active === 'department',
  })
  const departments = departmentsQuery.data ?? []

  // The department dashboard is the one view that cannot render without a
  // department, so it is only requested once one is chosen.
  const ready = active !== 'department' || Boolean(filters.departmentId)

  const dashboardQuery = useQuery({
    queryKey: ['reports', 'dashboard', active, filters],
    queryFn: () => getExecutiveDashboard(active, filters),
    enabled: ready,
  })
  const dashboard = dashboardQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Reports &amp; Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Executive dashboards built from live operational data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/reports/operational">Operational reports</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/reports/builder">Report builder</Link>
          </Button>
        </div>
      </div>

      <Tabs value={active} onValueChange={(next) => setActive(next as ExecutiveDashboardKey)}>
        <TabsList>
          {DASHBOARDS.map((dash) => (
            <TabsTrigger key={dash.key} value={dash.key}>
              {dash.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ReportFilters value={filters} onChange={setFilters} show={['groupBy']}>
        {active === 'department' && (
          <Select
            value={filters.departmentId ?? ''}
            onValueChange={(next) => setFilters({ ...filters, departmentId: next })}
          >
            <SelectTrigger className="h-9 w-[220px]">
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
      </ReportFilters>

      {!ready ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          Select a department to view its dashboard.
        </div>
      ) : dashboardQuery.isLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border p-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
        </div>
      ) : dashboardQuery.isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
          Could not load this dashboard. {dashboardQuery.error.message}
        </div>
      ) : dashboard ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">{dashboard.title}</h2>
            <p className="text-xs text-muted-foreground">
              {dashboard.period.from} to {dashboard.period.to} · {dashboard.period.days} days · grouped by{' '}
              {dashboard.period.groupBy}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {dashboard.kpis.map((kpi) => (
              <KpiTile key={kpi.key} kpi={kpi} />
            ))}
          </div>

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
