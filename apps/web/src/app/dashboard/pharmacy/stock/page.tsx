'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Stock</h1>
        <p className="text-sm text-muted-foreground">Current, reserved, and available stock across every drug batch.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input placeholder="Search generic/brand/batch" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-64" />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
          Low stock only
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={expiringOnly} onChange={(e) => setExpiringOnly(e.target.checked)} />
          Expiring within 30 days
        </label>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
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
            {stockQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : stockQuery.isError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load stock. {getErrorMessage(stockQuery.error)}
                </TableCell>
              </TableRow>
            ) : drugs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No drugs found.
                </TableCell>
              </TableRow>
            ) : (
              drugs.map((drug) => (
                <TableRow key={drug.id}>
                  <TableCell>
                    <div className="font-medium">{drug.genericName}</div>
                    <div className="text-xs text-muted-foreground">{drug.brandName ?? '—'} · {drug.strength ?? '—'}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{drug.batchNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs">
                      {new Date(drug.expiryDate).toLocaleDateString('en-IN')}
                      {isExpiringSoon(drug.expiryDate) && <Badge variant="destructive">Expiring</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>{drug.currentStock}</TableCell>
                  <TableCell>{drug.reservedStock}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {drug.availableStock}
                      {drug.currentStock <= drug.reorderLevel && <Badge variant="destructive">Low</Badge>}
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
