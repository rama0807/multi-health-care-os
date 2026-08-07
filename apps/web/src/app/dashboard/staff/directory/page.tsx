'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { CreateStaffSchema, EmploymentStatus, EmploymentType, type CreateStaffDto } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterBar, SearchInput } from '@/components/ui/toolbar'
import { useToast } from '@/hooks/use-toast'
import { listDepartments, listHospitals } from '@/lib/api/hospitals'
import { createStaff, listStaff } from '@/lib/api/staff'
import { useAuth } from '@/lib/auth/auth-context'

const NON_DOCTOR_ROLES = [
  'NURSE',
  'RECEPTIONIST',
  'LAB_TECHNICIAN',
  'RADIOLOGY_TECHNICIAN',
  'PHARMACIST',
  'CASHIER',
  'HR',
  'INVENTORY_MANAGER',
] as const

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function StaffDirectoryPage() {
  const router = useRouter()
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('staff.create')

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<EmploymentStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)

  const staffQuery = useQuery({
    queryKey: ['staff', 'list', { q, status, page }],
    queryFn: () =>
      listStaff({ q: q || undefined, employmentStatus: status === 'ALL' ? undefined : status, page, limit: 20 }),
  })

  const staff = staffQuery.data?.data ?? []
  const pagination = staffQuery.data?.pagination
  const activeFilterCount = (q ? 1 : 0) + (status !== 'ALL' ? 1 : 0)

  return (
    <PageLayout
      title="Staff Directory"
      description="Employee records, departments, designations, and employment status."
      actions={
        canCreate && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add staff member
          </Button>
        )
      }
    >
      <FilterBar
        activeCount={activeFilterCount}
        onClear={() => {
          setQ('')
          setStatus('ALL')
          setPage(1)
        }}
      >
        <SearchInput
          value={q}
          onValueChange={(v) => {
            setQ(v)
            setPage(1)
          }}
          placeholder="Search by name, employee ID, designation"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as EmploymentStatus | 'ALL')
            setPage(1)
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {Object.values(EmploymentStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {staffQuery.isLoading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : staff.length === 0 ? (
        <EmptyState
          variant={activeFilterCount > 0 ? 'search' : 'empty'}
          title={activeFilterCount > 0 ? 'No staff match these filters' : 'No staff members yet'}
          action={canCreate && activeFilterCount === 0 ? { label: 'Add staff member', onClick: () => setDialogOpen(true) } : undefined}
        />
      ) : (
        <TableContainer>
          <Table container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Employee ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Employment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((s) => (
                <TableRow key={s.id} interactive onClick={() => router.push(`/dashboard/staff/${s.id}`)}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/dashboard/staff/${s.id}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      {s.employeeId}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{s.fullName}</TableCell>
                  <TableCell>{s.designation}</TableCell>
                  <TableCell className="text-muted-foreground">{s.department?.name ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(s.employmentType)}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.employmentStatus} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <AddStaffDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </PageLayout>
  )
}

const DEFAULT_VALUES: CreateStaffDto = {
  email: '',
  firstName: '',
  lastName: '',
  phone: undefined,
  systemRole: 'NURSE',
  employeeId: undefined,
  designation: '',
  departmentId: undefined,
  hospitalId: '',
  employmentType: EmploymentType.FULL_TIME,
  reportsToId: undefined,
  joiningDate: '',
  monthlySalary: undefined,
}

function AddStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const form = useForm<CreateStaffDto>({
    resolver: zodResolver(CreateStaffSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onTouched',
  })

  const hospitalId = form.watch('hospitalId')
  const hospitalsQuery = useQuery({ queryKey: ['hospitals'], queryFn: listHospitals })
  const departmentsQuery = useQuery({
    queryKey: ['departments', hospitalId],
    queryFn: () => listDepartments(hospitalId || undefined),
    enabled: Boolean(hospitalId),
  })

  const createMutation = useMutation({
    mutationFn: createStaff,
    onSuccess: (staff) => {
      void queryClient.invalidateQueries({ queryKey: ['staff'] })
      toast({ title: 'Staff member added', description: `${staff.fullName} was added successfully` })
      form.reset(DEFAULT_VALUES)
      onOpenChange(false)
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not add staff member', description: getErrorMessage(error) }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent bodyClassName="contents" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add staff member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => void form.handleSubmit((values) => createMutation.mutate(values))(e)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="systemRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {NON_DOCTOR_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {formatEnumLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee ID (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Auto-generated if left blank" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Staff Nurse" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hospitalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hospital</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => {
                          field.onChange(v)
                          form.setValue('departmentId', undefined)
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select hospital" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {hospitalsQuery.data?.map((h) => (
                            <SelectItem key={h.id} value={h.id}>
                              {h.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department (optional)</FormLabel>
                      <Select value={field.value ?? ''} onValueChange={field.onChange} disabled={!hospitalId}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departmentsQuery.data?.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.values(EmploymentType).map((t) => (
                            <SelectItem key={t} value={t}>
                              {formatEnumLabel(t)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="joiningDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining date</FormLabel>
                      <FormControl>
                        <Input type="date" max={new Date().toISOString().slice(0, 10)} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="monthlySalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly salary (₹, optional - used for payroll prep)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-xs text-muted-foreground">
                A login account is created automatically. If this email already has a MediCore account, the selected
                role is added to it instead of creating a duplicate.
              </p>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
