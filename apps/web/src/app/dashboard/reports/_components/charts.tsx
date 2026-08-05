'use client'

import type { DashboardChart } from '@medicore/types'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Chart primitives for the reports module (Milestone 17 Checkpoint 17.4).
 *
 * Uses `recharts`, which was already a dependency of this app (the encounter
 * weight-trend chart uses it) — no new chart library was added. Every chart is
 * driven by the `DashboardChart` shape the API returns, so the backend decides
 * *what* is plotted and this file only decides how it looks.
 */

/**
 * Series colours. The lead colour is the theme's own primary, so charts follow
 * the organization's branding and both light and dark themes rather than a
 * hard-coded palette that only suits one.
 */
const SERIES_COLORS = [
  'hsl(var(--primary))',
  'hsl(199 89% 48%)',
  'hsl(160 84% 39%)',
  'hsl(43 96% 46%)',
  'hsl(280 65% 60%)',
  'hsl(0 72% 51%)',
  'hsl(217 91% 60%)',
]

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

const AXIS_TICK = { fontSize: 11 }

export function formatChartValue(value: number | string, format: DashboardChart['valueFormat']): string {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return String(value)
  if (format === 'currency') return `₹${numeric.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
  if (format === 'percent') return `${numeric}%`
  return numeric.toLocaleString('en-IN')
}

/** Shortens `2026-08-05` to `5 Aug` so a 30-day axis stays readable. */
function formatBucket(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export interface ChartCardProps {
  chart: DashboardChart
  height?: number
}

/**
 * Renders whichever chart type the API asked for. A chart with no data
 * renders an explicit empty state rather than an empty axis frame, which
 * otherwise reads as "zero" instead of "nothing to show".
 */
export function ChartCard({ chart, height = 240 }: ChartCardProps) {
  const hasData =
    chart.data.length > 0 && chart.data.some((row) => chart.series.some((s) => Number(row[s.key]) !== 0))

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{chart.title}</h3>
        {chart.note && <p className="mt-0.5 text-xs text-muted-foreground">{chart.note}</p>}
      </div>

      {!hasData ? (
        <div
          className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
          style={{ height }}
        >
          No data for the selected period
        </div>
      ) : chart.type === 'heatmap' ? (
        <Heatmap chart={chart} />
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {renderChart(chart)}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function renderChart(chart: DashboardChart): React.ReactElement {
  const tooltip = (
    <RechartsTooltip
      formatter={(value: number | string) => formatChartValue(value, chart.valueFormat)}
      contentStyle={{ fontSize: 12 }}
    />
  )
  const xAxis = (
    <XAxis
      dataKey={chart.xKey}
      tick={AXIS_TICK}
      tickFormatter={chart.xKey === 'bucket' ? formatBucket : undefined}
      interval="preserveStartEnd"
    />
  )
  const yAxis = (
    <YAxis
      tick={AXIS_TICK}
      width={48}
      tickFormatter={(value: number) => formatChartValue(value, chart.valueFormat)}
    />
  )
  const legend = chart.series.length > 1 ? <Legend wrapperStyle={{ fontSize: 11 }} /> : undefined

  switch (chart.type) {
    case 'bar':
      return (
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {chart.series.map((s, index) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={seriesColor(index)} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      )

    case 'area':
      return (
        <AreaChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {chart.series.map((s, index) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(index)}
              fill={seriesColor(index)}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      )

    case 'pie':
      return (
        <PieChart>
          {tooltip}
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Pie
            data={chart.data}
            dataKey={chart.series[0]?.key ?? 'value'}
            nameKey={chart.xKey}
            innerRadius="45%"
            outerRadius="75%"
            paddingAngle={2}
          >
            {chart.data.map((row, index) => (
              <Cell key={String(row[chart.xKey])} fill={seriesColor(index)} />
            ))}
          </Pie>
        </PieChart>
      )

    case 'line':
    default:
      return (
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          {xAxis}
          {yAxis}
          {tooltip}
          {legend}
          {chart.series.map((s, index) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={seriesColor(index)}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      )
  }
}

/**
 * A categorical heatmap — one tile per row, shaded by its value relative to
 * the largest in the set. Recharts has no heatmap primitive, so this is a
 * plain CSS grid rather than an abused scatter chart; it also keeps the
 * numeric value visible, which a pure colour scale would hide.
 */
function Heatmap({ chart }: { chart: DashboardChart }) {
  const valueKey = chart.series[0]?.key ?? 'value'
  const max = Math.max(...chart.data.map((row) => Number(row[valueKey]) || 0), 1)

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {chart.data.map((row) => {
        const value = Number(row[valueKey]) || 0
        // Floor the opacity so a low-but-nonzero cell is still legible.
        const intensity = 0.12 + (value / max) * 0.68
        return (
          <div
            key={String(row[chart.xKey])}
            className="rounded-md border p-3"
            style={{ backgroundColor: `hsl(var(--primary) / ${intensity.toFixed(2)})` }}
            title={`${String(row[chart.xKey])}: ${formatChartValue(value, chart.valueFormat)}`}
          >
            <p className="truncate text-xs font-medium text-foreground">{String(row[chart.xKey])}</p>
            <p className="text-lg font-semibold text-foreground">{formatChartValue(value, chart.valueFormat)}</p>
          </div>
        )
      })}
    </div>
  )
}
