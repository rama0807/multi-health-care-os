'use client'

import type { ReportExportFormat, ReportFilterQuery } from '@medicore/types'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import { downloadReportExport, listReportDefinitions } from '@/lib/api/reports'
import { useAuth } from '@/lib/auth/auth-context'

const FORMATS: Array<{ format: ReportExportFormat; label: string }> = [
  { format: 'csv', label: 'CSV' },
  { format: 'xlsx', label: 'Excel (XLSX)' },
  { format: 'pdf', label: 'PDF' },
]

/**
 * A section's export action - lists every registered report for this
 * module (Checkpoint 17.3's registry) and downloads it with the section's
 * own current filters, so exporting never requires a trip to the separate
 * Report Builder just to find the right report and re-enter the same dates.
 *
 * Renders nothing (not even a disabled button) when the module has no
 * registered report - an empty menu would be a dead end, not a feature.
 */
export function SectionExportMenu({ module, filters }: { module: string | string[]; filters: ReportFilterQuery }) {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const canExport = hasPermission('reports.export')
  const modules = Array.isArray(module) ? module : [module]

  const definitionsQuery = useQuery({ queryKey: ['reports', 'definitions'], queryFn: listReportDefinitions })
  const definitions = (definitionsQuery.data ?? []).filter((d) => modules.includes(d.module))

  const exportMutation = useMutation({
    mutationFn: ({ key, format }: { key: string; format: ReportExportFormat }) =>
      downloadReportExport(key, format, filters),
    onError: (error: Error) => toast({ title: 'Export failed', description: error.message }),
  })

  if (definitions.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!canExport}
          title={canExport ? undefined : 'Requires the reports.export permission'}
        >
          {exportMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-3.5 w-3.5" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {definitions.map((definition, index) => (
          <div key={definition.key}>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {definition.label}
            </DropdownMenuLabel>
            {FORMATS.map((option) => (
              <DropdownMenuItem
                key={option.format}
                onClick={() => exportMutation.mutate({ key: definition.key, format: option.format })}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
