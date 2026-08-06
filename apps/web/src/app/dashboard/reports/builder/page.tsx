'use client'

import type { ReportDefinition, ReportExportFormat, ReportFilterQuery } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bookmark, Download, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TableSkeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  createSavedReport,
  deleteSavedReport,
  downloadReportExport,
  listReportDefinitions,
  listSavedReports,
  runReport,
  runSavedReport,
} from '@/lib/api/reports'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

import { ReportFilters, defaultFilters } from '../_components/report-filters'

const EXPORT_FORMATS: Array<{ format: ReportExportFormat; label: string }> = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel' },
  { format: 'pdf', label: 'PDF' },
]

/**
 * The report builder (Milestone 17 Checkpoints 17.3/17.4).
 *
 * The report catalog, its filters and its columns all come from the API's
 * registry — this page hard-codes no report. Adding a report on the backend
 * makes it appear here with no frontend change.
 */
export default function ReportBuilderPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { hasPermission } = useAuth()
  const canExport = hasPermission('reports.export')

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReportFilterQuery>(defaultFilters())
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')

  const definitionsQuery = useQuery({
    queryKey: ['reports', 'definitions'],
    queryFn: listReportDefinitions,
  })
  // Memoised so the `byModule` grouping below is not rebuilt on every render
  // by a fresh `[]` fallback identity.
  const definitions = useMemo(() => definitionsQuery.data ?? [], [definitionsQuery.data])

  const savedQuery = useQuery({ queryKey: ['reports', 'saved'], queryFn: () => listSavedReports({ limit: 50 }) })
  const saved = savedQuery.data?.data ?? []

  const selected = definitions.find((d) => d.key === selectedKey) ?? null

  const byModule = useMemo(() => {
    const groups = new Map<string, ReportDefinition[]>()
    for (const definition of definitions) {
      const existing = groups.get(definition.module) ?? []
      existing.push(definition)
      groups.set(definition.module, existing)
    }
    return [...groups.entries()]
  }, [definitions])

  const resultQuery = useQuery({
    queryKey: ['reports', 'run', selectedKey, filters],
    queryFn: () => runReport(selectedKey as string, filters),
    enabled: Boolean(selectedKey),
  })
  const result = resultQuery.data

  const saveMutation = useMutation({
    mutationFn: () =>
      createSavedReport({
        name: saveName.trim(),
        description: saveDescription.trim() || undefined,
        reportKey: selectedKey as string,
        filters,
      }),
    onSuccess: () => {
      toast({ title: 'Report saved' })
      setSaveOpen(false)
      setSaveName('')
      setSaveDescription('')
      void queryClient.invalidateQueries({ queryKey: ['reports', 'saved'] })
    },
    onError: (error: Error) => toast({ title: 'Could not save report', description: error.message }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedReport(id),
    onSuccess: () => {
      toast({ title: 'Saved report deleted' })
      void queryClient.invalidateQueries({ queryKey: ['reports', 'saved'] })
    },
    onError: (error: Error) => toast({ title: 'Could not delete', description: error.message }),
  })

  const exportMutation = useMutation({
    mutationFn: (format: ReportExportFormat) => downloadReportExport(selectedKey as string, format, filters),
    onError: (error: Error) => toast({ title: 'Export failed', description: error.message }),
  })

  /** Loading a saved report replays its stored filters, then re-runs it live. */
  const openSaved = async (id: string, reportKey: string) => {
    const savedResult = await runSavedReport(id)
    setSelectedKey(reportKey)
    setFilters((current) => ({
      ...current,
      from: savedResult.period.from,
      to: savedResult.period.to,
      groupBy: savedResult.period.groupBy,
    }))
    void queryClient.invalidateQueries({ queryKey: ['reports', 'saved'] })
  }

  const exportButtons = (
    <>
      <Button variant="outline" size="sm" onClick={() => setSaveOpen(true)}>
        <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Save
      </Button>
      {EXPORT_FORMATS.map((option) => (
        <Button
          key={option.format}
          variant="outline"
          size="sm"
          disabled={!canExport || exportMutation.isPending}
          title={canExport ? undefined : 'Requires the reports.export permission'}
          onClick={() => exportMutation.mutate(option.format)}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" /> {option.label}
        </Button>
      ))}
    </>
  )

  return (
    <PageLayout
      title="Report Builder"
      description="Pick a report, set filters, then export or save it for reuse."
      actions={
        <>
          <Button asChild variant="outline">
            <Link href="/dashboard/reports">Dashboards</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/reports/operational">Operational reports</Link>
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* ── Catalog + saved reports ─────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border p-3">
              <CardTitle>Reports</CardTitle>
            </CardHeader>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {definitionsQuery.isLoading ? (
                <p className="p-2 text-xs text-muted-foreground">Loading…</p>
              ) : (
                byModule.map(([module, reports]) => (
                  <div key={module} className="mb-2">
                    <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {module}
                    </p>
                    <ul className="space-y-0.5">
                      {reports.map((definition) => (
                        <li key={definition.key}>
                          <button
                            type="button"
                            onClick={() => setSelectedKey(definition.key)}
                            className={cn(
                              'w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                              selectedKey === definition.key
                                ? 'bg-accent font-medium text-accent-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                          >
                            {definition.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader className="border-b border-border p-3">
              <CardTitle>Saved reports</CardTitle>
            </CardHeader>
            <div className="max-h-[260px] overflow-y-auto p-2">
              {saved.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">
                  No saved reports yet. Run a report and choose &ldquo;Save&rdquo;.
                </p>
              ) : (
                <ul className="space-y-1">
                  {saved.map((report) => (
                    <li
                      key={report.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                    >
                      <button
                        type="button"
                        className="flex-1 text-left"
                        onClick={() => void openSaved(report.id, report.reportKey)}
                      >
                        <span className="block text-sm text-foreground">{report.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {report.reportKey}
                          {report.isShared ? ' · shared' : ''}
                          {report.scheduleEnabled ? ' · schedule saved (not yet dispatched)' : ''}
                        </span>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteMutation.mutate(report.id)}
                        aria-label={`Delete ${report.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

        {/* ── Selected report ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {!selected ? (
            <EmptyState compact title="Select a report from the catalog to begin" />
          ) : (
            <>
              <Card className="p-4">
                <h2 className="text-base font-semibold text-foreground">{selected.label}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>
                {selected.filters.length === 0 && (
                  <Badge variant="outline" className="mt-2">
                    Point-in-time report — date filters do not apply
                  </Badge>
                )}
              </Card>

              {/* Only the filters this report declares are offered. */}
              {selected.filters.length > 0 ? (
                <ReportFilters
                  value={filters}
                  onChange={setFilters}
                  show={
                    [
                      ...(selected.filters.includes('groupBy') ? ['groupBy'] : []),
                      ...(selected.filters.includes('doctorId') ? ['doctorId'] : []),
                    ] as Array<'groupBy' | 'doctorId'>
                  }
                >
                  {exportButtons}
                </ReportFilters>
              ) : (
                <div className="flex flex-wrap gap-2">{exportButtons}</div>
              )}

              {resultQuery.isLoading ? (
                <TableSkeleton rows={8} columns={5} />
              ) : resultQuery.isError ? (
                <EmptyState variant="error" title="Could not run this report" description={resultQuery.error.message} />
              ) : result ? (
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                    <p className="text-xs text-muted-foreground">
                      {result.period.from} to {result.period.to} · {result.totalRows} row
                      {result.totalRows === 1 ? '' : 's'}
                    </p>
                    {result.truncated && (
                      <Badge variant="warning">
                        Showing the first {result.rows.length} of {result.totalRows} rows
                      </Badge>
                    )}
                  </div>
                  {result.rows.length === 0 ? (
                    <EmptyState compact title="No data for the selected period" />
                  ) : (
                    <TableContainer className="max-h-[520px] rounded-none border-0">
                      <Table density="compact" container={false}>
                        <TableHeader>
                          <TableRow>
                            {result.definition.columns.map((column) => (
                              <TableHead
                                key={column.key}
                                align={column.type === 'string' || column.type === 'date' ? undefined : 'right'}
                              >
                                {column.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.rows.map((row, index) => (
                            <TableRow key={index}>
                              {result.definition.columns.map((column) => (
                                <TableCell
                                  key={column.key}
                                  align={column.type === 'string' || column.type === 'date' ? undefined : 'right'}
                                  className={column.type === 'string' || column.type === 'date' ? undefined : 'tabular-nums'}
                                >
                                  {row[column.key] === null || row[column.key] === undefined
                                    ? '—'
                                    : String(row[column.key])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save report</DialogTitle>
            <DialogDescription>
              Saves the report and its current filters, not its results — re-running it always shows current data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="saved-name">Name</Label>
              <Input
                id="saved-name"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                placeholder="Monthly OPD revenue"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="saved-description">Description (optional)</Label>
              <Textarea
                id="saved-description"
                value={saveDescription}
                onChange={(event) => setSaveDescription(event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!saveName.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
