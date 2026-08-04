'use client'

import { InsuranceNetworkType } from '@medicore/types'
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
import { createInsurancePlan, listInsurancePlans, listInsuranceProviders, updateInsurancePlan } from '@/lib/api/insurance'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function InsurancePlansPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('insurance.plans.create')
  const canUpdate = hasPermission('insurance.plans.update')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const plansQuery = useQuery({ queryKey: ['insurance', 'plans', 'list'], queryFn: () => listInsurancePlans({ limit: 100 }) })
  const plans = plansQuery.data?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Insurance Plans</h1>
          <p className="text-sm text-muted-foreground">Coverage, co-pay, deductible, and limits per provider.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add plan
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead>Co-pay</TableHead>
              <TableHead>Deductible</TableHead>
              <TableHead>Annual limit</TableHead>
              <TableHead>Network</TableHead>
              {canUpdate && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plansQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : plans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No insurance plans yet.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name} <span className="font-mono text-xs text-muted-foreground">({p.code})</span>
                  </TableCell>
                  <TableCell className="text-sm">{p.provider.name}</TableCell>
                  <TableCell>{p.coveragePercent}%</TableCell>
                  <TableCell>{p.coPayPercent}%</TableCell>
                  <TableCell>₹{p.deductible}</TableCell>
                  <TableCell>{p.annualLimit ? `₹${p.annualLimit}` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(p.networkType)}</Badge>
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

      <PlanDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {editing && (
        <PlanDialog open onOpenChange={(open) => !open && setEditing(null)} plan={plans.find((p) => p.id === editing)} />
      )}
    </div>
  )
}

function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: {
    id: string
    providerId: string
    name: string
    code: string
    coveragePercent: string
    coPayPercent: string
    deductible: string
    annualLimit: string | null
    perVisitLimit: string | null
    networkType: InsuranceNetworkType
  }
}) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEdit = Boolean(plan)

  const providersQuery = useQuery({
    queryKey: ['insurance', 'providers', 'list'],
    queryFn: () => listInsuranceProviders({ limit: 100, isActive: true }),
    enabled: open,
  })

  const [providerId, setProviderId] = useState(plan?.providerId ?? '')
  const [name, setName] = useState(plan?.name ?? '')
  const [code, setCode] = useState(plan?.code ?? '')
  const [coveragePercent, setCoveragePercent] = useState(plan?.coveragePercent ?? '100')
  const [coPayPercent, setCoPayPercent] = useState(plan?.coPayPercent ?? '0')
  const [deductible, setDeductible] = useState(plan?.deductible ?? '0')
  const [annualLimit, setAnnualLimit] = useState(plan?.annualLimit ?? '')
  const [perVisitLimit, setPerVisitLimit] = useState(plan?.perVisitLimit ?? '')
  const [networkType, setNetworkType] = useState<InsuranceNetworkType>(plan?.networkType ?? InsuranceNetworkType.CASHLESS)

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        code,
        coveragePercent: Number(coveragePercent),
        coPayPercent: Number(coPayPercent),
        deductible: Number(deductible),
        annualLimit: annualLimit ? Number(annualLimit) : undefined,
        perVisitLimit: perVisitLimit ? Number(perVisitLimit) : undefined,
        networkType,
      }
      return isEdit ? updateInsurancePlan(plan!.id, payload) : createInsurancePlan({ ...payload, providerId })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['insurance', 'plans', 'list'] })
      toast({ title: isEdit ? 'Plan updated' : 'Plan added' })
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not save plan', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit plan' : 'Add insurance plan'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {!isEdit && (
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                {providersQuery.data?.data.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input placeholder="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Plan code" value={code} onChange={(e) => setCode(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Coverage %" value={coveragePercent} onChange={(e) => setCoveragePercent(e.target.value)} />
            <Input type="number" placeholder="Co-pay %" value={coPayPercent} onChange={(e) => setCoPayPercent(e.target.value)} />
            <Input type="number" placeholder="Deductible ₹" value={deductible} onChange={(e) => setDeductible(e.target.value)} />
            <Input type="number" placeholder="Annual limit ₹" value={annualLimit} onChange={(e) => setAnnualLimit(e.target.value)} />
            <Input
              type="number"
              placeholder="Per-visit limit ₹"
              value={perVisitLimit}
              onChange={(e) => setPerVisitLimit(e.target.value)}
            />
          </div>
          <Select value={networkType} onValueChange={(v) => setNetworkType(v as InsuranceNetworkType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InsuranceNetworkType).map((t) => (
                <SelectItem key={t} value={t}>
                  {formatEnumLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!name.trim() || !code.trim() || (!isEdit && !providerId) || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
