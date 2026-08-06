'use client'

import { Priority, RadiologyStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Scan } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { PageLayout } from '@/components/layout/page-layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TableSkeleton } from '@/components/ui/skeleton'
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
import { FilterBar } from '@/components/ui/toolbar'
import { useToast } from '@/hooks/use-toast'
import { listDoctors } from '@/lib/api/doctors'
import { completeRadiologyStudy, listRadiologyOrders, startRadiologyStudy } from '@/lib/api/radiology'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

function formatEnumLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export default function RadiologyOrdersPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [doctorId, setDoctorId] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [priority, setPriority] = useState<string>('all')

  const canUpdate = hasPermission('radiology.update')

  const doctorsQuery = useQuery({ queryKey: ['doctors', 'list', 'all'], queryFn: () => listDoctors({ limit: 100 }) })

  const ordersQuery = useQuery({
    queryKey: ['radiology', 'list', { doctorId, status, priority }],
    queryFn: () =>
      listRadiologyOrders({
        doctorId: doctorId === 'all' ? undefined : doctorId,
        status: status === 'all' ? undefined : (status as RadiologyStatus),
        priority: priority === 'all' ? undefined : (priority as Priority),
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  })

  function invalidateOrders() {
    void queryClient.invalidateQueries({ queryKey: ['radiology', 'list'] })
  }

  const startMutation = useMutation({
    mutationFn: (id: string) => startRadiologyStudy(id),
    onSuccess: () => {
      toast({ title: 'Study started' })
      invalidateOrders()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not start study', description: getErrorMessage(error) }),
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => completeRadiologyStudy(id),
    onSuccess: () => {
      toast({ title: 'Study completed' })
      invalidateOrders()
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not complete study', description: getErrorMessage(error) }),
  })

  const orders = ordersQuery.data?.data ?? []

  return (
    <PageLayout
      breadcrumbs={[{ label: 'Radiology', href: '/dashboard/radiology' }, { label: 'Orders' }]}
      title="Radiology Orders"
      description={
        ordersQuery.data
          ? `${ordersQuery.data.pagination.total} order${ordersQuery.data.pagination.total === 1 ? '' : 's'}`
          : undefined
      }
    >
      <FilterBar>
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Doctor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {doctorsQuery.data?.data.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                Dr. {d.fullName} — {d.specialization}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(RadiologyStatus).map((s) => (
              <SelectItem key={s} value={s}>
                {formatEnumLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.values(Priority).map((p) => (
              <SelectItem key={p} value={p}>
                {formatEnumLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {ordersQuery.isLoading ? (
        <TableSkeleton rows={8} columns={8} />
      ) : ordersQuery.isError ? (
        <EmptyState variant="error" title="Couldn't load radiology orders" description={getErrorMessage(ordersQuery.error)} />
      ) : orders.length === 0 ? (
        <EmptyState variant="search" title="No radiology orders found" description="Try a different doctor, status, or priority filter." />
      ) : (
        <TableContainer className="max-h-[65vh]">
          <Table density="compact" container={false}>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Study</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/radiology/${order.id}`}
                      className="flex items-center gap-1.5 font-mono text-xs hover:underline"
                    >
                      <Scan className="h-3.5 w-3.5 text-muted-foreground" />
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {order.patient.fullName}
                    <div className="font-mono text-xs text-muted-foreground">{order.patient.uhid}</div>
                  </TableCell>
                  <TableCell>Dr. {order.doctor.fullName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.modality} — {order.bodyPart}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {order.scheduledAt ? new Date(order.scheduledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatEnumLabel(order.priority)}</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell align="right">
                    <TableRowActions>
                      {canUpdate && order.status === RadiologyStatus.SCHEDULED && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startMutation.mutate(order.id)}
                          disabled={startMutation.isPending}
                        >
                          Start
                        </Button>
                      )}
                      {canUpdate && order.status === RadiologyStatus.IN_PROGRESS && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => completeMutation.mutate(order.id)}
                          disabled={completeMutation.isPending}
                        >
                          Complete
                        </Button>
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/radiology/${order.id}`}>Open</Link>
                      </Button>
                    </TableRowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PageLayout>
  )
}
