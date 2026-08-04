'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  Clock,
  IndianRupee,
  LogIn,
  LogOut,
  Loader2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { clockIn, clockOut } from '@/lib/api/attendance'
import { getMyStaffProfile, getStaffDashboardStats } from '@/lib/api/staff'
import { useAuth } from '@/lib/auth/auth-context'

function getErrorMessage(error: unknown): string {
  const axiosError = error as { response?: { data?: { error?: { message?: string } } } }
  return axiosError?.response?.data?.error?.message ?? 'Something went wrong. Please try again.'
}

export default function StaffDashboardPage() {
  const { hasPermission } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const canReadShifts = hasPermission('shifts.read')
  const canReadLeave = hasPermission('leave.read')
  const canRunPayroll = hasPermission('attendance.manage')

  const statsQuery = useQuery({ queryKey: ['staff', 'dashboard-stats'], queryFn: getStaffDashboardStats })
  const stats = statsQuery.data

  const myProfileQuery = useQuery({
    queryKey: ['staff', 'me'],
    queryFn: getMyStaffProfile,
    retry: false,
  })

  const clockInMutation = useMutation({
    mutationFn: () => clockIn(),
    onSuccess: () => {
      toast({ title: 'Clocked in' })
      void queryClient.invalidateQueries({ queryKey: ['staff', 'dashboard-stats'] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not clock in', description: getErrorMessage(error) }),
  })

  const clockOutMutation = useMutation({
    mutationFn: () => clockOut(),
    onSuccess: () => {
      toast({ title: 'Clocked out' })
      void queryClient.invalidateQueries({ queryKey: ['staff', 'dashboard-stats'] })
    },
    onError: (error) => toast({ variant: 'destructive', title: 'Could not clock out', description: getErrorMessage(error) }),
  })

  const tiles = [
    { key: 'totalStaff', label: 'Total staff', icon: Users, value: stats?.totalStaff },
    { key: 'activeStaff', label: 'Active staff', icon: UserCheck, value: stats?.activeStaff },
    { key: 'presentToday', label: 'Present today', icon: UserCheck, value: stats?.presentToday },
    { key: 'lateToday', label: 'Late today', icon: Clock, value: stats?.lateToday },
    { key: 'absentToday', label: 'Absent today', icon: UserMinus, value: stats?.absentToday },
    { key: 'onLeaveToday', label: 'On leave today', icon: CalendarClock, value: stats?.onLeaveToday },
    { key: 'pendingLeaveApprovals', label: 'Pending leave approvals', icon: CalendarClock, value: stats?.pendingLeaveApprovals },
  ] as const

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Staff & Attendance</h1>
          <p className="text-sm text-muted-foreground">Staff directory, attendance, leave, shifts, and payroll prep.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/staff/directory">
              <Users className="h-4 w-4" />
              Directory
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/staff/attendance">
              <Clock className="h-4 w-4" />
              Attendance
            </Link>
          </Button>
          {canReadLeave && (
            <Button asChild variant="outline">
              <Link href="/dashboard/staff/leave">
                <CalendarClock className="h-4 w-4" />
                Leave
              </Link>
            </Button>
          )}
          {canReadShifts && (
            <>
              <Button asChild variant="outline">
                <Link href="/dashboard/staff/shifts">
                  <Clock className="h-4 w-4" />
                  Shifts
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/staff/roster">
                  <CalendarClock className="h-4 w-4" />
                  Roster
                </Link>
              </Button>
            </>
          )}
          {canRunPayroll && (
            <Button asChild variant="outline">
              <Link href="/dashboard/staff/payroll">
                <IndianRupee className="h-4 w-4" />
                Payroll prep
              </Link>
            </Button>
          )}
        </div>
      </div>

      {myProfileQuery.data && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-foreground">Your attendance today</p>
            <p className="text-xs text-muted-foreground">{myProfileQuery.data.fullName} — {myProfileQuery.data.designation}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => clockInMutation.mutate()} disabled={clockInMutation.isPending}>
              {clockInMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
              Clock in
            </Button>
            <Button size="sm" variant="outline" onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}>
              {clockOutMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
              Clock out
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="flex items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <tile.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">{statsQuery.isLoading ? '—' : (tile.value ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{tile.label}</p>
            </div>
          </div>
        ))}
      </div>

      {stats && stats.byDepartment.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Staff by department</h2>
          <div className="space-y-2">
            {stats.byDepartment.map((d) => (
              <div key={d.departmentId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.departmentName}</span>
                <span className="font-medium text-foreground">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats && stats.shiftCoverageToday.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Shift coverage today</h2>
          <div className="space-y-2">
            {stats.shiftCoverageToday.map((s) => (
              <div key={s.shiftId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.shiftName}</span>
                <span className="font-medium text-foreground">
                  {s.clockedIn} / {s.assigned} clocked in
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/staff/directory">
            <UserPlus className="h-3.5 w-3.5" />
            Add staff member
          </Link>
        </Button>
      </div>
    </div>
  )
}
