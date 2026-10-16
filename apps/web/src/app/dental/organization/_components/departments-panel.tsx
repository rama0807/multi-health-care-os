'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionHeader } from '@/components/ui/page-header'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import {
  createDepartment,
  deactivateDepartment,
  listHospitalsWithCounts,
  listOrganizationDepartments,
} from '@/lib/api/organization'
import { useAuth } from '@/lib/auth/auth-context'

const ANY_HOSPITAL = '__any__'

export function DepartmentsPanel() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()

  const canCreate = hasPermission('departments.create')
  const canDeactivate = hasPermission('departments.delete')

  const [hospitalFilter, setHospitalFilter] = useState(ANY_HOSPITAL)

  const hospitalsQuery = useQuery({
    queryKey: ['organization', 'hospitals'],
    queryFn: listHospitalsWithCounts,
  })
  const departmentsQuery = useQuery({
    queryKey: ['organization', 'departments', hospitalFilter],
    queryFn: () => listOrganizationDepartments(hospitalFilter === ANY_HOSPITAL ? undefined : hospitalFilter),
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [draftHospitalId, setDraftHospitalId] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')

  function resetDraft() {
    setDraftHospitalId('')
    setName('')
    setCode('')
    setDescription('')
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['organization', 'departments'] })
    void queryClient.invalidateQueries({ queryKey: ['organization', 'hospitals'] })
  }

  const createMutation = useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      invalidate()
      setCreateOpen(false)
      resetDraft()
      toast({ title: 'Department created' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not create department',
        description: error.response?.data?.message ?? 'Please check the details and try again.',
        variant: 'destructive',
      }),
  })

  const deactivateMutation = useMutation({
    mutationFn: deactivateDepartment,
    onSuccess: () => {
      invalidate()
      toast({ title: 'Department deactivated' })
    },
    onError: (error: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Could not deactivate department',
        description: error.response?.data?.message ?? 'Please try again.',
        variant: 'destructive',
      }),
  })

  const hospitals = hospitalsQuery.data ?? []
  const departments = departmentsQuery.data ?? []
  const hospitalName = (hospitalId: string) => hospitals.find((h) => h.id === hospitalId)?.name ?? '-'

  const draftValid =
    Boolean(draftHospitalId) && name.trim().length >= 2 && /^[A-Z0-9-]{2,20}$/.test(code.trim())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeader
          title="Specialties"
          description={`${departments.length} department${departments.length === 1 ? '' : 's'}${hospitalFilter === ANY_HOSPITAL ? ' across the organization' : ''}.`}
        />
        <div className="flex items-center gap-2">
          <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All hospitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY_HOSPITAL}>All hospitals</SelectItem>
              {hospitals.map((hospital) => (
                <SelectItem key={hospital.id} value={hospital.id}>
                  {hospital.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {canCreate && (
            <Dialog
              open={createOpen}
              onOpenChange={(open) => {
                setCreateOpen(open)
                if (!open) resetDraft()
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add department
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add department</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="dept-hospital">Hospital</Label>
                    <Select value={draftHospitalId} onValueChange={setDraftHospitalId}>
                      <SelectTrigger id="dept-hospital">
                        <SelectValue placeholder="Select a hospital" />
                      </SelectTrigger>
                      <SelectContent>
                        {hospitals.map((hospital) => (
                          <SelectItem key={hospital.id} value={hospital.id}>
                            {hospital.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dept-name">Name</Label>
                    <Input
                      id="dept-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Cardiology"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dept-code">Code</Label>
                    <Input
                      id="dept-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="CARDIO"
                    />
                    <p className="text-xs text-muted-foreground">Uppercase letters, digits and hyphens.</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dept-description">Description (optional)</Label>
                    <Input
                      id="dept-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    disabled={!draftValid || createMutation.isPending}
                    onClick={() =>
                      createMutation.mutate({
                        hospitalId: draftHospitalId,
                        name: name.trim(),
                        code: code.trim(),
                        description: description.trim() || undefined,
                      })
                    }
                  >
                    {createMutation.isPending ? 'Creating…' : 'Create department'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {departmentsQuery.isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="Departments organize doctors and staff within a hospital."
          action={canCreate ? { label: 'Add department', onClick: () => setCreateOpen(true) } : undefined}
        />
      ) : (
        <TableContainer>
          <Table container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Status</TableHead>
                <TableHead align="right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((department) => (
                <TableRow key={department.id}>
                  <TableCell className="font-medium">{department.name}</TableCell>
                  <TableCell>{department.code}</TableCell>
                  <TableCell>{hospitalName(department.hospitalId)}</TableCell>
                  <TableCell>
                    <StatusBadge status={department.isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </TableCell>
                  <TableCell align="right">
                    {department.isActive && canDeactivate && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deactivateMutation.isPending}
                        onClick={() => deactivateMutation.mutate(department.id)}
                      >
                        Deactivate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  )
}
