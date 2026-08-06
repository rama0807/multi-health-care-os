'use client'

import { type CsvImportResult, Gender } from '@medicore/types'
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
  Upload,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
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
import { deletePatient, importPatientsCsv, listPatients, restorePatient } from '@/lib/api/patients'
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
  const [importDialogOpen, setImportDialogOpen] = useState(false)

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
  const canManage = hasPermission('patients.manage')

  const activeFilterCount = [qInput.length > 0, gender !== 'all', status !== 'active'].filter(Boolean).length

  function clearFilters() {
    setQInput('')
    setGender('all')
    setStatus('active')
  }

  const columnCount = canDelete ? 8 : 7

  return (
    <PageLayout
      title="Patients"
      description={pagination ? `${pagination.total} registered patient${pagination.total === 1 ? '' : 's'}` : undefined}
      actions={
        <>
          <Button variant="outline" disabled title="CSV export is coming soon">
            Export
          </Button>
          {canManage && (
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload />
              Import CSV
            </Button>
          )}
          {canCreate && (
            <Button asChild>
              <Link href="/dashboard/patients/new">
                <Plus />
                New Patient
              </Link>
            </Button>
          )}
        </>
      }
    >
      <FilterBar activeCount={activeFilterCount} onClear={clearFilters}>
        <SearchInput
          value={qInput}
          onValueChange={setQInput}
          placeholder="Search by name, UHID, or phone..."
        />
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-40">
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
        <EmptyState variant="error" title="Couldn't load patients" description={getErrorMessage(query.error)} />
      ) : patients.length === 0 && activeFilterCount > 0 ? (
        <EmptyState
          variant="search"
          title="No patients match these filters"
          secondaryAction={{ label: 'Clear filters', onClick: clearFilters }}
        />
      ) : patients.length === 0 ? (
        <EmptyState
          title={status === 'inactive' ? 'No deactivated patients' : 'No patients yet'}
          description={status === 'inactive' ? undefined : 'Register the first one to get started.'}
          action={canCreate && status === 'active' ? { label: 'Register patient', href: '/dashboard/patients/new' } : undefined}
        />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
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
              {patients.map((patient) => (
                <TableRow key={patient.id} selected={selected.has(patient.id)}>
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
                  <TableCell>{patient.city ?? '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(patient.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
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

      <BulkActionBar count={canDelete ? selected.size : 0} onClear={() => setSelected(new Set())} noun="patient">
        <Button variant="destructive" size="sm" onClick={() => setConfirmBulkDeactivate(true)}>
          <Trash2 />
          Deactivate
        </Button>
      </BulkActionBar>

      <Dialog open={confirmBulkDeactivate} onOpenChange={setConfirmBulkDeactivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {selected.size} patient{selected.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              This soft-deletes the selected records - they can be restored later from the Deactivated
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

      <ImportCsvDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => void queryClient.invalidateQueries({ queryKey: ['patients'] })}
      />
    </PageLayout>
  )
}

function ImportCsvDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}) {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  async function handleImport() {
    if (!file) return
    setIsImporting(true)
    try {
      const importResult = await importPatientsCsv(file)
      setResult(importResult)
      onImported()
      toast({
        title: 'Import complete',
        description: `${importResult.created} of ${importResult.total} row${importResult.total === 1 ? '' : 's'} created`,
      })
    } catch (error) {
      toast({ variant: 'destructive', title: 'Import failed', description: getErrorMessage(error) })
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) {
          setFile(null)
          setResult(null)
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import patients from CSV</DialogTitle>
          <DialogDescription>
            Header row required: firstName, lastName, phone, dateOfBirth (YYYY-MM-DD), gender, and
            optionally email, bloodGroup, address, city, state, pincode, emergencyContactName,
            emergencyContactPhone. Up to 500 rows per file.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            <p className="text-sm text-muted-foreground">
              {result.created} created · {result.failed} failed · {result.total} total
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {result.results.map((r) => (
                <li key={r.row} className="flex items-center justify-between gap-2 p-2">
                  <span>Row {r.row}</span>
                  {r.success ? (
                    <span className="font-mono text-xs text-muted-foreground">{r.uhid}</span>
                  ) : (
                    <span className="text-xs text-destructive">{r.error}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleImport()} disabled={!file || isImporting}>
                {isImporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Import
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
