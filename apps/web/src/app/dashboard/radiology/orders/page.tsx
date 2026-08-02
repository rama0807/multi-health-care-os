'use client'

import { Priority, RadiologyStatus } from '@medicore/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Scan } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

const STATUS_BADGE: Record<RadiologyStatus, 'secondary' | 'success' | 'destructive' | 'outline'> = {
  [RadiologyStatus.ORDERED]: 'secondary',
  [RadiologyStatus.SCHEDULED]: 'outline',
  [RadiologyStatus.IN_PROGRESS]: 'outline',
  [RadiologyStatus.COMPLETED]: 'success',
  [RadiologyStatus.REPORTED]: 'success',
  [RadiologyStatus.CANCELLED]: 'destructive',
  [RadiologyStatus.REJECTED]: 'destructive',
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
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Radiology Orders</h1>
        <p className="text-sm text-muted-foreground">
          {ordersQuery.data ? `${ordersQuery.data.pagination.total} order${ordersQuery.data.pagination.total === 1 ? '' : 's'}` : 'Loading...'}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={doctorId} onValueChange={setDoctorId}>
          <SelectTrigger className="sm:w-56">
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
          <SelectTrigger className="sm:w-44">
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
          <SelectTrigger className="sm:w-40">
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Study</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordersQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : ordersQuery.isError ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  Couldn&apos;t load radiology orders. {getErrorMessage(ordersQuery.error)}
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No radiology orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
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
                    <Badge variant={STATUS_BADGE[order.status]}>{formatEnumLabel(order.status)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
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
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
