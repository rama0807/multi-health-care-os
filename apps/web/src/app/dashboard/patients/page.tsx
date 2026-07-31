'use client'

import { Gender } from '@medicore/types'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { deletePatient, listPatients, restorePatient } from '@/lib/api/patients'
import { useAuth } from '@/lib/auth/auth-context'
import { cn } from '@/lib/utils'

type SortBy = 'createdAt' | 'firstName' | 'lastName' | 'uhid'
type SortOrder = 'asc' | 'desc'

const GENDER_OPTIONS = Object.values(Gender)

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function PatientsListPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [gender, setGender] = useState<string>('all')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [sortBy, setSortBy] = useState<SortBy>('createdAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDeactivate, setConfirmBulkDeactivate] = useState(false)
  const [isBulkActing, setIsBulkActing] = useState(false)

  // Debounce free-text search so we don't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQ(qInput.trim()), 350)
    return () => clearTimeout(timer)
  }, [qInput])

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [q, gender, status])

  const query = useQuery({
    queryKey: ['patients', 'list', { q, gender, status, sortBy, sortOrder, page, limit }],
    queryFn: () =>
      listPatients({
        q: q || undefined,
        gender: gender === 'all' ? undefined : (gender as Gender),
        isActive: status === 'active',
        sortBy,
        sortOrder,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
  })

  const patients = query.data?.data ?? []
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
    setSelected(checked ? new Set(patients.map((p) => p.id)) : new Set())
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
      await deletePatient(id)
      await queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Patient deactivated' })
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not deactivate patient', description: getErrorMessage(error) })
    }
  }

  async function handleRestore(id: string) {
    try {
      await restorePatient(id)
      await queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: 'Patient restored' })
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not restore patient', description: getErrorMessage(error) })
    }
  }

  async function handleBulkDeactivate() {
    setIsBulkActing(true)
    try {
      await Promise.all([...selected].map((id) => deletePatient(id)))
      await queryClient.invalidateQueries({ queryKey: ['patients'] })
      toast({ title: `Deactivated ${selected.size} patient${selected.size === 1 ? '' : 's'}` })
      setSelected(new Set())
    } catch (error) {
      toast({ variant: 'destructive', title: 'Bulk deactivation failed', description: getErrorMessage(error) })
    } finally {
      setIsBulkActing(false)
      setConfirmBulkDeactivate(false)
    }
  }

  const canCreate = hasPermission('patients.create')
  const canUpdate = hasPermission('patients.update')
  const canDelete = hasPermission('patients.delete')

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">
            {pagination ? `${pagination.total} registered patient${pagination.total === 1 ? '' : 's'}` : 'Loading...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled title="CSV export is coming soon">
            Export
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/dashboard/patients/new">
                <Plus />
                New Patient
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name, UHID, or phone..."
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genders</SelectItem>
            {GENDER_OPTIONS.map((g) => (
              <SelectItem key={g} value={g}>
                {g.charAt(0) + g.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Deactivated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && canDelete && (
        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-2">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDeactivate(true)}>
            <Trash2 />
            Deactivate selected
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={patients.length > 0 && selected.size === patients.length}
                    onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                    aria-label="Select all patients on this page"
                  />
                </TableHead>
              )}
              <SortableHead label="UHID" column="uhid" sortBy={sortBy} sortOrder={sortOrder} onSort={toggleSort} />
              <SortableHead
                label="Name"
                column="firstName"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={toggleSort}
              />
              <TableHead>Phone</TableHead>
              <TableHead>Age / Gender</TableHead>
              <TableHead>City</TableHead>
              <SortableHead
                label="Registered"
                column="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={toggleSort}
              />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load patients. {getErrorMessage(query.error)}
                </TableCell>
              </TableRow>
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No patients found.
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow key={patient.id} data-state={selected.has(patient.id) ? 'selected' : undefined}>
                  {canDelete && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(patient.id)}
                        onCheckedChange={(checked) => toggleSelectOne(patient.id, Boolean(checked))}
                        aria-label={`Select ${patient.fullName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-xs">{patient.uhid}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/patients/${patient.id}`} className="font-medium hover:underline">
                      {patient.fullName}
                    </Link>
                  </TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell>
                    {patient.age}y · {patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()}
                  </TableCell>
                  <TableCell>{patient.city ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(patient.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/patients/${patient.id}`}>View profile</Link>
                        </DropdownMenuItem>
                        {status === 'active' && canDelete && (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => void handleDeactivate(patient.id)}
                          >
                            <Trash2 />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                        {status === 'inactive' && canUpdate && (
                          <DropdownMenuItem onClick={() => void handleRestore(patient.id)}>
                            <RotateCcw />
                            Restore
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={setPage} />
      )}

      <Dialog open={confirmBulkDeactivate} onOpenChange={setConfirmBulkDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {selected.size} patient{selected.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              This soft-deletes the selected records — they can be restored later from the Deactivated
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
    </div>
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
