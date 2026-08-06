'use client'

import { DoctorAvailabilityStatus } from '@medicore/types'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Stethoscope,
  Trash2,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableRowActions,
} from '@/components/ui/table'
import { BulkActionBar, FilterBar, SearchInput } from '@/components/ui/toolbar'
import { useToast } from '@/hooks/use-toast'
import { deactivateDoctor, getDoctorDashboardStats, listDoctors, restoreDoctor } from '@/lib/api/doctors'
import { listDepartments, listHospitals } from '@/lib/api/hospitals'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

type SortBy = 'createdAt' | 'firstName' | 'specialization' | 'experienceYears'
type SortOrder = 'asc' | 'desc'

const AVAILABILITY_OPTIONS = Object.values(DoctorAvailabilityStatus)

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export default function DoctorsListPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [hospitalId, setHospitalId] = useState<string>('all')
  const [departmentId, setDepartmentId] = useState<string>('all')
  const [language, setLanguage] = useState('')
  const [availabilityStatus, setAvailabilityStatus] = useState<string>('all')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [sortBy, setSortBy] = useState<SortBy>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDeactivate, setConfirmBulkDeactivate] = useState(false)
  const [isBulkActing, setIsBulkActing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [qInput])

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [q, hospitalId, departmentId, language, availabilityStatus, status])

  const hospitalsQuery = useQuery({ queryKey: ['hospitals'], queryFn: listHospitals })
  const departmentsQuery = useQuery({
    queryKey: ['departments', hospitalId],
    queryFn: () => listDepartments(hospitalId === 'all' ? undefined : hospitalId),
  })

  const statsQuery = useQuery({ queryKey: ['doctors', 'stats', 'dashboard'], queryFn: getDoctorDashboardStats })

  const query = useQuery({
    queryKey: [
      'doctors',
      'list',
      { q, hospitalId, departmentId, language, availabilityStatus, status, sortBy, sortOrder, page, limit },
    ],
    queryFn: () =>
      listDoctors({
        q: q || undefined,
        hospitalId: hospitalId === 'all' ? undefined : hospitalId,
        departmentId: departmentId === 'all' ? undefined : departmentId,
        language: language.trim() || undefined,
        availabilityStatus:
          availabilityStatus === 'all' ? undefined : (availabilityStatus as DoctorAvailabilityStatus),
        isActive: status === 'active',
        sortBy,
        sortOrder,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
  })

  const doctors = query.data?.data ?? []
  const pagination = query.data?.pagination

  function toggleSort(column: SortBy) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  function toggleSelectAll(checked: boolean) {
    setSelected(checked ? new Set(doctors.map((d) => d.id)) : new Set())
  }

  function toggleSelectOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateDoctor(id)
      await queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast({ title: 'Doctor deactivated' })
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not deactivate doctor', description: getErrorMessage(error) })
    }
  }

  async function handleRestore(id: string) {
    try {
      await restoreDoctor(id)
      await queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast({ title: 'Doctor restored' })
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not restore doctor', description: getErrorMessage(error) })
    }
  }

  async function handleBulkDeactivate() {
    setIsBulkActing(true)
    try {
      await Promise.all([...selected].map((id) => deactivateDoctor(id)))
      await queryClient.invalidateQueries({ queryKey: ['doctors'] })
      toast({ title: `Deactivated ${selected.size} doctor${selected.size === 1 ? '' : 's'}` })
      setSelected(new Set())
    } catch (error) {
      toast({ variant: 'destructive', title: 'Bulk deactivation failed', description: getErrorMessage(error) })
    } finally {
      setIsBulkActing(false)
      setConfirmBulkDeactivate(false)
    }
  }

  const canCreate = hasPermission('doctors.create')
  const canUpdate = hasPermission('doctors.update')
  const canDelete = hasPermission('doctors.delete')

  const activeFilterCount = [
    qInput.length > 0,
    hospitalId !== 'all',
    departmentId !== 'all',
    language.trim().length > 0,
    availabilityStatus !== 'all',
    status !== 'active',
  ].filter(Boolean).length

  function clearFilters() {
    setQInput('')
    setHospitalId('all')
    setDepartmentId('all')
    setLanguage('')
    setAvailabilityStatus('all')
    setStatus('active')
  }

  const columnCount = canDelete ? 8 : 7

  return (
    <PageLayout
      title="Doctors"
      description={pagination ? `${pagination.total} doctor${pagination.total === 1 ? '' : 's'}` : undefined}
      actions={
        canCreate && (
          <Button asChild>
            <Link href="/dashboard/doctors/new">
              <Plus />
              New Doctor
            </Link>
          </Button>
        )
      }
    >
      <StatCardGrid columns={2}>
        <StatCard
          icon={Stethoscope}
          label="Total doctors"
          value={statsQuery.data?.totalDoctors}
          loading={statsQuery.isLoading}
        />
        <StatCard
          icon={Users}
          label="Active doctors"
          value={statsQuery.data?.activeDoctors}
          loading={statsQuery.isLoading}
          tone="success"
        />
      </StatCardGrid>

      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <SearchInput
          value={qInput}
          onValueChange={setQInput}
          placeholder="Search by name, specialization, or registration no..."
        />
        <Select
          value={hospitalId}
          onValueChange={(v) => {
            setHospitalId(v)
            setDepartmentId('all')
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Hospital" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All hospitals</SelectItem>
            {hospitalsQuery.data?.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={departmentId} onValueChange={setDepartmentId}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departmentsQuery.data?.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="h-8 w-36"
        />
        <Select value={availabilityStatus} onValueChange={setAvailabilityStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Availability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any availability</SelectItem>
            {AVAILABILITY_OPTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {formatEnumLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      {query.isLoading ? (
        <TableSkeleton rows={8} columns={columnCount} />
      ) : query.isError ? (
        <EmptyState variant="error" title="Couldn't load doctors" description={getErrorMessage(query.error)} />
      ) : doctors.length === 0 && activeFilterCount > 0 ? (
        <EmptyState
          variant="search"
          title="No doctors match these filters"
          secondaryAction={{ label: 'Clear filters', onClick: clearFilters }}
        />
      ) : doctors.length === 0 ? (
        <EmptyState
          title={status === 'inactive' ? 'No deactivated doctors' : 'No doctors yet'}
          description={status === 'inactive' ? undefined : 'Register the first one to get started.'}
          action={canCreate && status === 'active' ? { label: 'New doctor', href: '/dashboard/doctors/new' } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                {canDelete && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={doctors.length > 0 && selected.size === doctors.length}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="Select all doctors on this page"
                    />
                  </TableHead>
                )}
                <SortableHead
                  label="Name"
                  column="firstName"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={toggleSort}
                />
                <SortableHead
                  label="Specialization"
                  column="specialization"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={toggleSort}
                />
                <TableHead>Department</TableHead>
                <TableHead>Hospital</TableHead>
                <TableHead>Registration No.</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id} selected={selected.has(doctor.id)}>
                  {canDelete && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(doctor.id)}
                        onCheckedChange={(checked) => toggleSelectOne(doctor.id, Boolean(checked))}
                        aria-label={`Select ${doctor.fullName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link
                      href={`/dashboard/doctors/${doctor.id}`}
                      className="flex items-center gap-2 font-medium hover:underline"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {initials(doctor.firstName, doctor.lastName)}
                        </AvatarFallback>
                      </Avatar>
                      Dr. {doctor.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>{doctor.specialization}</TableCell>
                  <TableCell>{doctor.department?.name ?? '—'}</TableCell>
                  <TableCell>{doctor.hospital?.name ?? '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{doctor.registrationNumber}</TableCell>
                  <TableCell>
                    <StatusBadge status={doctor.availabilityStatus} />
                  </TableCell>
                  <TableCell align="right">
                    <TableRowActions>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/doctors/${doctor.id}`}>View profile</Link>
                          </DropdownMenuItem>
                          {status === 'active' && canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void handleDeactivate(doctor.id)}
                            >
                              <Trash2 />
                              Deactivate
                            </DropdownMenuItem>
                          )}
                          {status === 'inactive' && canUpdate && (
                            <DropdownMenuItem onClick={() => void handleRestore(doctor.id)}>
                              <RotateCcw />
                              Restore
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableRowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {pagination && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <BulkActionBar count={canDelete ? selected.size : 0} onClear={() => setSelected(new Set())} noun="doctor">
        <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDeactivate(true)}>
          <Trash2 />
          Deactivate
        </Button>
      </BulkActionBar>

      <Dialog open={confirmBulkDeactivate} onOpenChange={setConfirmBulkDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {selected.size} doctor{selected.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              This deactivates the selected doctor profiles — they can be restored later from the Deactivated
              filter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkDeactivate(false)} disabled={isBulkActing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleBulkDeactivate()} disabled={isBulkActing}>
              {isBulkActing && <Loader2 className="animate-spin" />}
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}

function SortableHead({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string
  column: SortBy
  sortBy: SortBy
  sortOrder: SortOrder
  onSort: (column: SortBy) => void
}) {
  const isActive = sortBy === column
  const Icon = !isActive ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground',
          isActive && 'text-foreground',
        )}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </TableHead>
  )
}
