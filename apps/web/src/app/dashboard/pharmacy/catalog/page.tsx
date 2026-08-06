'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { SkeletonText } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { useToast } from '@/hooks/use-toast'
import { createDrug, listDrugCatalog, updateDrug } from '@/lib/api/pharmacy'
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

export default function PharmacyCatalogPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canManage = hasPermission('pharmacy.create')

  const [genericName, setGenericName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [strength, setStrength] = useState('')
  const [dosageForm, setDosageForm] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [batchNumber, setBatchNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [price, setPrice] = useState('')
  const [taxPercent, setTaxPercent] = useState('')
  const [currentStock, setCurrentStock] = useState('')
  const [reorderLevel, setReorderLevel] = useState('')

  const catalogQuery = useQuery({
    queryKey: ['pharmacy', 'catalog', 'all'],
    queryFn: () => listDrugCatalog({ limit: 100, sortBy: 'genericName', sortOrder: 'asc' }),
  })

  const createMutation = useMutation({
    mutationFn: () =>
      createDrug({
        genericName,
        brandName: brandName || undefined,
        strength: strength || undefined,
        dosageForm,
        manufacturer: manufacturer || undefined,
        batchNumber,
        expiryDate: new Date(expiryDate),
        price: Number(price),
        taxPercent: taxPercent ? Number(taxPercent) : 0,
        currentStock: currentStock ? Number(currentStock) : 0,
        minStockLevel: 10,
        reorderLevel: reorderLevel ? Number(reorderLevel) : 20,
      }),
    onSuccess: () => {
      toast({ title: 'Drug batch added' })
      setGenericName('')
      setBrandName('')
      setStrength('')
      setDosageForm('')
      setManufacturer('')
      setBatchNumber('')
      setExpiryDate('')
      setPrice('')
      setTaxPercent('')
      setCurrentStock('')
      setReorderLevel('')
      void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add drug', description: getErrorMessage(error) }),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateDrug(id, { isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['pharmacy', 'catalog'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  const canSubmit = Boolean(genericName && dosageForm && batchNumber && expiryDate && price)

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Pharmacy', href: '/dashboard/pharmacy' }, { label: 'Catalog' }]}
      title="Drug Catalog"
      description="One row per batch - restocking a drug adds a new batch row."
    >
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>New batch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Input placeholder="Generic name *" value={genericName} onChange={(e) => setGenericName(e.target.value)} />
            <Input placeholder="Brand name" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            <Input placeholder="Strength (e.g. 500mg)" value={strength} onChange={(e) => setStrength(e.target.value)} />
            <Input placeholder="Dosage form * (e.g. Tablet)" value={dosageForm} onChange={(e) => setDosageForm(e.target.value)} />
            <Input placeholder="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            <Input placeholder="Batch number *" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            <Input placeholder="Expiry date *" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            <Input placeholder="Price (₹) *" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Input placeholder="Tax %" type="number" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
            <Input placeholder="Initial stock" type="number" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} />
            <Input placeholder="Reorder level" type="number" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add batch
          </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
        </CardHeader>
        <CardContent>
          {catalogQuery.isLoading ? (
            <SkeletonText lines={4} />
          ) : catalogQuery.data?.data.length === 0 ? (
            <EmptyState compact title="No drugs in the catalog yet" />
          ) : (
            <div className="-mx-4 divide-y">
              {catalogQuery.data?.data.map((drug) => (
                <div key={drug.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{drug.genericName}</span>{' '}
                    {drug.brandName && <span className="text-muted-foreground">({drug.brandName})</span>}
                    <div className="text-xs text-muted-foreground">
                      {drug.strength ?? '-'} · {drug.dosageForm} · Batch {drug.batchNumber} · ₹{drug.price} + {drug.taxPercent}% tax
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stock: {drug.currentStock} (reserved {drug.reservedStock}, available {drug.availableStock})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {drug.currentStock <= drug.reorderLevel && <StatusBadge status="LOW_STOCK" />}
                    {isExpiringSoon(drug.expiryDate) && <StatusBadge status="EXPIRING" />}
                    <StatusBadge status={drug.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    {canManage && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActiveMutation.mutate({ id: drug.id, isActive: !drug.isActive })}
                      >
                        {drug.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
