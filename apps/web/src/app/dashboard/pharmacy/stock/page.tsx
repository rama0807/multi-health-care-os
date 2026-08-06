'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FilterBar } from '@/components/ui/toolbar'
import { useToast } from '@/hooks/use-toast'
import { adjustDrugStock, listDrugCatalog } from '@/lib/api/pharmacy'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function isExpiringSoon(expiryDate: string | Date): boolean {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + 30)
  return new Date(expiryDate) <= cutoff
}

export default function PharmacyStockPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canUpdate = hasPermission('pharmacy.update')

  const [search, setSearch] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [expiringOnly, setExpiringOnly] = useState(false)
  const [adjusting, setAdjusting] = useState<Record<string, string>>({})

  const stockQuery = useQuery({
    queryKey: ['pharmacy', 'catalog', 'stock', { search, lowStockOnly, expiringOnly }],
    queryFn: () =>
      listDrugCatalog({
        search: search || undefined,
        lowStockOnly: lowStockOnly || undefined,
        expiringWithinDays: expiringOnly ? 30 : undefined,
        limit: 100,
        sortBy: 'currentStock',
        sortOrder: 'asc',
      }),
  })

  const adjustMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => adjustDrugStock(id, { quantity }),
    onSuccess: () => {
      toast({ title: 'Stock adjusted' })
      void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not adjust stock', description: getErrorMessage(error) }),
  })

  const drugs = stockQuery.data?.data ?? []

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Pharmacy', href: '/dashboard/pharmacy' }, { label: 'Stock' }]}
      title="Stock"
      description="Current, reserved, and available stock across every drug batch."
    >
      <FilterBar>
        <Input placeholder="Search generic/brand/batch" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-64" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
          Expiring within 30 days
        </label>
      </FilterBar>

      {stockQuery.isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : stockQuery.isError ? (
        <EmptyState variant="error" title="Couldn't load stock" description={getErrorMessage(stockQuery.error)} />
      ) : drugs.length === 0 ? (
        <EmptyState variant="search" title="No drugs found" description="Try a different search or clear the filters." />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Drug</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Current</TableHead>
                <TableHead>Reserved</TableHead>
                <TableHead>Available</TableHead>
                <TableHead>Reorder level</TableHead>
                <TableHead>Adjust</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drugs.map((drug) => (
                <TableRow key={drug.id}>
                  <TableCell>
                    <div className="font-medium">{drug.genericName}</div>
                    <div className="text-xs text-muted-foreground">{drug.brandName ?? '—'} · {drug.strength ?? '—'}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{drug.batchNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs">
                      {new Date(drug.expiryDate).toLocaleDateString('en-IN')}
                      {isExpiringSoon(drug.expiryDate) && <StatusBadge status="EXPIRING" />}
                    </div>
                  </TableCell>
                  <TableCell>{drug.currentStock}</TableCell>
                  <TableCell>{drug.reservedStock}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {drug.availableStock}
                      {drug.currentStock <= drug.reorderLevel && <StatusBadge status="LOW_STOCK" label="Low" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{drug.reorderLevel}</TableCell>
                  <TableCell>
                    {canUpdate && (
                      <div className="flex items-center gap-1.5">
                        <Input
                          className="h-8 w-20"
                          type="number"
                          placeholder="±qty"
                          value={adjusting[drug.id] ?? ''}
                          onChange={(e) => setAdjusting((prev) => ({ ...prev, [drug.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!adjusting[drug.id] || adjustMutation.isPending}
                          onClick={() => {
                            const quantity = Number(adjusting[drug.id])
                            adjustMutation.mutate({ id: drug.id, quantity })
                            setAdjusting((prev) => ({ ...prev, [drug.id]: '' }))
                          }}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
