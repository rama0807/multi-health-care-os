'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Drug Catalog</h1>
        <p className="text-sm text-muted-foreground">One row per batch — restocking a drug adds a new batch row.</p>
      </div>

      {canManage && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">New batch</h3>
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
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b p-3">
          <h3 className="text-sm font-semibold text-foreground">Catalog</h3>
        </div>
        {catalogQuery.isLoading ? (
          <div className="flex h-16 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y">
            {catalogQuery.data?.data.map((drug) => (
              <div key={drug.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-medium">{drug.genericName}</span>{' '}
                  {drug.brandName && <span className="text-muted-foreground">({drug.brandName})</span>}
                  <div className="text-xs text-muted-foreground">
                    {drug.strength ?? '—'} · {drug.dosageForm} · Batch {drug.batchNumber} · ₹{drug.price} + {drug.taxPercent}% tax
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Stock: {drug.currentStock} (reserved {drug.reservedStock}, available {drug.availableStock})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {drug.currentStock <= drug.reorderLevel && <Badge variant="destructive">Low stock</Badge>}
                  {isExpiringSoon(drug.expiryDate) && <Badge variant="destructive">Expiring soon</Badge>}
                  <Badge variant={drug.isActive ? 'success' : 'secondary'}>{drug.isActive ? 'Active' : 'Inactive'}</Badge>
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
            {catalogQuery.data?.data.length === 0 && <p className="p-4 text-sm text-muted-foreground">No drugs in the catalog yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
