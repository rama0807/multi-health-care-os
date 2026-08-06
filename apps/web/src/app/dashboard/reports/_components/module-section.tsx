'use client'

import type { DashboardChart, DashboardKpi, DashboardTable, ReportFilterQuery } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'

import { EmptyState } from '@/components/ui/empty-state'
import { StatCardSkeleton } from '@/components/ui/skeleton'
import { StatCardGrid } from '@/components/ui/stat-card'

import { ChartCard, ChartCardSkeleton } from './charts'
import { DashboardDataTable, KpiTile } from './report-filters'

export interface ModuleView {
  kpis: DashboardKpi[]
  charts: DashboardChart[]
  tables?: DashboardTable[]
}

export interface ModuleSectionProps {
  sectionKey: string
  description?: string
  filters: ReportFilterQuery
  load: (filters: ReportFilterQuery) => Promise<ModuleView>
}

/**
 * The generic renderer every analytics domain in the redesigned Reports hub
 * shares - one query, one stat/chart/table layout. A domain contributes only
 * its `load()` function (`report-sections.ts`); this file owns the
 * loading/empty/error states so every section behaves identically rather
 * than each reinventing its own skeleton. The filter bar and export menu are
 * owned by the page shell (`page.tsx`) - shared across every section rather
 * than repeated per module.
 */
export function ModuleSection({ sectionKey, description, filters, load }: ModuleSectionProps) {
  const query = useQuery({
    queryKey: ['reports', 'section', sectionKey, filters],
    queryFn: () => load(filters),
  })

  return (
    <div className="space-y-4">
      {description && <p className="text-sm text-muted-foreground">{description}</p>}

      {query.isLoading ? (
        <div className="space-y-4">
          <StatCardSkeleton count={4} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <ChartCardSkeleton />
            <ChartCardSkeleton />
          </div>
        </div>
      ) : query.isError ? (
        <EmptyState
          variant="error"
          title="Could not load this report"
          description={query.error.message}
          secondaryAction={{ label: 'Retry', onClick: () => void query.refetch() }}
        />
      ) : query.data ? (
        <div className="space-y-4">
          {query.data.kpis.length > 0 && (
            <StatCardGrid columns={4}>
              {query.data.kpis.map((kpi) => (
                <KpiTile key={kpi.key} kpi={kpi} />
              ))}
            </StatCardGrid>
          )}

          {query.data.charts.length > 0 && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {query.data.charts.map((chart) => (
                <ChartCard key={chart.key} chart={chart} />
              ))}
            </div>
          )}

          {(query.data.tables ?? []).map((table) => (
            <DashboardDataTable key={table.key} table={table} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
