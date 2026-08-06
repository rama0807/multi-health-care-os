'use client'

import type { DashboardKpi, DashboardTable, ReportFilterQuery, ReportGroupBy } from '@medicore/types'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatCard } from '@/components/ui/stat-card'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { listDoctors } from '@/lib/api/doctors'

/** Sentinel for "no filter" - Radix Select cannot hold an empty-string value. */
const ANY = '__any__'

const PRESETS: Array<{ label: string; days: number }> = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
]

function toDateInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function defaultFilters(days = 30): ReportFilterQuery {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return { from: toDateInput(from), to: toDateInput(to), groupBy: 'day' }
}

export interface ReportFiltersProps {
  value: ReportFilterQuery
  onChange: (next: ReportFilterQuery) => void
  /** Which controls to show - mirrors the report's declared `filters`. */
  show?: Array<'groupBy' | 'doctorId' | 'departmentId'>
  children?: React.ReactNode
}

/**
 * The shared filter bar for every report and dashboard (Checkpoint 17.4).
 *
 * Only the controls a given report actually honours are rendered - showing a
 * doctor picker on a report that ignores it would silently produce unfiltered
 * numbers under a filtered heading.
 */
export function ReportFilters({ value, onChange, show = ['groupBy'], children }: ReportFiltersProps) {
  const doctorsQuery = useQuery({
    queryKey: ['reports', 'doctor-options'],
    queryFn: () => listDoctors({ limit: 100 }),
    enabled: show.includes('doctorId'),
  })

  const applyPreset = (days: number) => onChange({ ...value, ...defaultFilters(days), groupBy: value.groupBy })

  return (
    <Card className="flex flex-wrap items-end gap-3 p-3">
      <div className="space-y-1">
        <Label htmlFor="report-from" className="text-xs">
          From
        </Label>
        <Input
          id="report-from"
          type="date"
          className="h-9 w-[150px]"
          value={value.from ?? ''}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="report-to" className="text-xs">
          To
        </Label>
        <Input
          id="report-to"
          type="date"
          className="h-9 w-[150px]"
          value={value.to ?? ''}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
        />
      </div>

      <div className="flex gap-1">
        {PRESETS.map((preset) => (
          <Button key={preset.label} variant="outline" size="sm" onClick={() => applyPreset(preset.days)}>
            {preset.label}
          </Button>
        ))}
      </div>

      {show.includes('groupBy') && (
        <div className="space-y-1">
          <Label className="text-xs">Group by</Label>
          <Select
            value={value.groupBy ?? 'day'}
            onValueChange={(next) => onChange({ ...value, groupBy: next as ReportGroupBy })}
          >
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {show.includes('doctorId') && (
        <div className="space-y-1">
          <Label className="text-xs">Doctor</Label>
          <Select
            value={value.doctorId ?? ANY}
            onValueChange={(next) => onChange({ ...value, doctorId: next === ANY ? undefined : next })}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All doctors</SelectItem>
              {(doctorsQuery.data?.data ?? []).map((doctor) => (
                <SelectItem key={doctor.id} value={doctor.id}>
                  {doctor.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="ml-auto flex gap-2">{children}</div>
    </Card>
  )
}

/**
 * A KPI tile. A change of null renders as a neutral dash - the API returns
 * null when the previous period was zero, where any percentage would be a
 * fabrication.
 */
export function KpiTile({ kpi }: { kpi: DashboardKpi }) {
  const value =
    kpi.value === '-'
      ? '-'
      : kpi.format === 'currency'
        ? `₹${Number(kpi.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
        : kpi.format === 'percent'
          ? `${kpi.value}%`
          : kpi.format === 'days'
            ? `${kpi.value} d`
            : kpi.format === 'hours'
              ? `${kpi.value} h`
              : Number(kpi.value).toLocaleString('en-IN')

  const change = kpi.changePercent
  const improving = change === null ? null : kpi.higherIsBetter === change >= 0

  return (
    <StatCard
      label={kpi.label}
      value={value}
      hint={kpi.hint}
      trend={{
        value: change === null ? '-' : `${change > 0 ? '+' : ''}${change}%`,
        direction: change === null ? 'flat' : change >= 0 ? 'up' : 'down',
        intent: improving === null ? 'neutral' : improving ? 'positive' : 'negative',
        label: 'vs previous',
      }}
    />
  )
}

/** Renders a `DashboardTable` verbatim - the API owns the columns and order. */
export function DashboardDataTable({ table }: { table: DashboardTable }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{table.title}</CardTitle>
        {table.note && <p className="mt-0.5 text-xs text-muted-foreground">{table.note}</p>}
      </CardHeader>
      {table.rows.length === 0 ? (
        <CardContent>
          <EmptyState compact title="No data for the selected period" />
        </CardContent>
      ) : (
        <TableContainer className="rounded-none border-0 border-y">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                {table.columns.map((column) => (
                  <TableHead key={column.key} align={column.align === 'right' ? 'right' : undefined}>
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.rows.map((row, index) => (
                <TableRow key={index}>
                  {table.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      align={column.align === 'right' ? 'right' : undefined}
                      className={column.align === 'right' ? 'tabular-nums' : undefined}
                    >
                      {/* An absent measurement prints as a dash, never as 0. */}
                      {row[column.key] === null || row[column.key] === undefined ? '-' : String(row[column.key])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}
