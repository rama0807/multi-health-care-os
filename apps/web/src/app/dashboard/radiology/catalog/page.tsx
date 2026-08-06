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
    <PageLayout
      breadcrumbs={[{ label: 'Radiology', href: '/dashboard/radiology' }, { label: 'Catalog' }]}
      title="Radiology Catalog"
      description="Org-configurable orderable imaging studies."
    >
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>New study</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
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
          ) : catalogQuery.data?.length === 0 ? (
            <EmptyState compact title="No catalog items yet" />
          ) : (
            <div className="-mx-4 divide-y">
              {catalogQuery.data?.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{item.name}</span>{' '}
                    <span className="font-mono text-xs text-muted-foreground">({item.code})</span>
                    <div className="text-xs text-muted-foreground">
                      {item.category} · {item.modality} · {item.bodyPart} · ₹{item.price} · {item.estimatedDurationMinutes} min
                      {item.contrastRequired ? ' · Contrast required' : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.isActive ? 'ACTIVE' : 'INACTIVE'} />
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
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}
