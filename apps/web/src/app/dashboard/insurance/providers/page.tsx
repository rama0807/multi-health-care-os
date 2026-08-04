'use client'

import { InsuranceProviderType } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createInsuranceProvider, listInsuranceProviders, updateInsuranceProvider } from '@/lib/api/insurance'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InsuranceProvidersPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('insurance.providers.create')
  const canUpdate = hasPermission('insurance.providers.update')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const providersQuery = useQuery({
    queryKey: ['insurance', 'providers', 'list'],
    queryFn: () => listInsuranceProviders({ limit: 100 }),
  })
  const providers = providersQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Insurance Providers</h1>
          <p className="text-sm text-muted-foreground">Insurance companies, TPAs, and corporate plan issuers.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add provider
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              {canUpdate && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {providersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No insurance providers yet.
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="font-mono text-xs">{p.code}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(p.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.contactPerson ?? '—'} {p.phone ? `· ${p.phone}` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? 'success' : 'secondary'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  {canUpdate && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(p.id)}>
                        Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProviderDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && (
        <ProviderDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          provider={providers.find((p) => p.id === editing)}
        />
      )}
    </div>
  )
}

function ProviderDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider?: { id: string; name: string; code: string; type: InsuranceProviderType; contactPerson: string | null; email: string | null; phone: string | null; address: string | null; isActive: boolean }
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(provider)

  const [name, setName] = useState(provider?.name ?? '')
  const [code, setCode] = useState(provider?.code ?? '')
  const [type, setType] = useState<InsuranceProviderType>(provider?.type ?? InsuranceProviderType.INSURANCE_COMPANY)
  const [contactPerson, setContactPerson] = useState(provider?.contactPerson ?? '')
  const [email, setEmail] = useState(provider?.email ?? '')
  const [phone, setPhone] = useState(provider?.phone ?? '')

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        code,
        type,
        contactPerson: contactPerson || undefined,
        email: email || undefined,
        phone: phone || undefined,
      }
      return isEdit ? updateInsuranceProvider(provider!.id, payload) : createInsuranceProvider(payload)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['insurance', 'providers', 'list'] })
      toast({ title: isEdit ? 'Provider updated' : 'Provider added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save provider', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit provider' : 'Add insurance provider'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as InsuranceProviderType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InsuranceProviderType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Contact person" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !code.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
