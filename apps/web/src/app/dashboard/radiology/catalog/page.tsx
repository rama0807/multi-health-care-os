'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { createRadiologyCatalogItem, listRadiologyCatalog, updateRadiologyCatalogItem } from '@/lib/api/radiology'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function RadiologyCatalogPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canManage = hasPermission('radiology.create')

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [modality, setModality] = useState('')
  const [bodyPart, setBodyPart] = useState('')
  const [contrastRequired, setContrastRequired] = useState(false)
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('')

  const catalogQuery = useQuery({ queryKey: ['radiology', 'catalog', 'all'], queryFn: () => listRadiologyCatalog() })

  const createMutation = useMutation({
    mutationFn: () =>
      createRadiologyCatalogItem({
        code,
        name,
        category,
        modality,
        bodyPart,
        contrastRequired,
        price: Number(price),
        estimatedDurationMinutes: Number(duration),
      }),
    onSuccess: () => {
      toast({ title: 'Catalog item added' })
      setCode('')
      setName('')
      setCategory('')
      setModality('')
      setBodyPart('')
      setContrastRequired(false)
      setPrice('')
      setDuration('')
      void queryClient.invalidateQueries({ queryKey: ['radiology', 'catalog'] })
    },
    onError: (error) => {
      toast({ variant: 'destructive', title: 'Could not add catalog item', description: getErrorMessage(error) })
    },
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateRadiologyCatalogItem(id, { isActive }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['radiology', 'catalog'] }),
    onError: (error) => toast({ variant: 'destructive', title: 'Update failed', description: getErrorMessage(error) }),
  })

  const canSubmit = Boolean(code && name && category && modality && bodyPart && price && duration)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Radiology Catalog</h1>
        <p className="text-sm text-muted-foreground">Org-configurable orderable imaging studies.</p>
      </div>

      {canManage && (
        <div className="space-y-2 rounded-lg border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">New study</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Input placeholder="Code *" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input placeholder="Name * (e.g. X-Ray Chest)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Category *" value={category} onChange={(e) => setCategory(e.target.value)} />
            <Input placeholder="Modality * (e.g. X_RAY, CT, MRI)" value={modality} onChange={(e) => setModality(e.target.value)} />
            <Input placeholder="Body part *" value={bodyPart} onChange={(e) => setBodyPart(e.target.value)} />
            <Input placeholder="Price (₹) *" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
            <Input
              placeholder="Estimated duration (min) *"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={contrastRequired} onChange={(e) => setContrastRequired(e.target.checked)} />
              Contrast required
            </label>
          </div>
          <Button size="sm" onClick={() => createMutation.mutate()} disabled={!canSubmit || createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Add study
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
            {catalogQuery.data?.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <span className="font-medium">{item.name}</span>{' '}
                  <span className="font-mono text-xs text-muted-foreground">({item.code})</span>
                  <div className="text-xs text-muted-foreground">
                    {item.category} · {item.modality} · {item.bodyPart} · ₹{item.price} · {item.estimatedDurationMinutes} min
                    {item.contrastRequired ? ' · Contrast required' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.isActive ? 'success' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActiveMutation.mutate({ id: item.id, isActive: !item.isActive })}
                    >
                      {item.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {catalogQuery.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">No catalog items yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
