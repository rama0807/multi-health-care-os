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

import { PageLayout } from '@/components/layout/page-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
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

  return (
    <PageLayout
      title="Staff & Attendance"
      description="Staff directory, attendance, leave, shifts, and payroll prep."
      actions={
        <>
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
        </>
      }
    >
      {myProfileQuery.data && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium text-foreground">Your attendance today</p>
              <p className="text-xs text-muted-foreground">{myProfileQuery.data.fullName} - {myProfileQuery.data.designation}</p>
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
          </CardContent>
        </Card>
      )}

      <StatCardGrid columns={4}>
        <StatCard icon={Users} label="Total staff" value={stats?.totalStaff} loading={statsQuery.isLoading} href="/dashboard/staff/directory" />
        <StatCard icon={UserCheck} label="Active staff" value={stats?.activeStaff} loading={statsQuery.isLoading} tone="success" href="/dashboard/staff/directory" />
        <StatCard icon={UserCheck} label="Present today" value={stats?.presentToday} loading={statsQuery.isLoading} href="/dashboard/staff/attendance" />
        <StatCard icon={Clock} label="Late today" value={stats?.lateToday} loading={statsQuery.isLoading} tone="warning" href="/dashboard/staff/attendance" />
        <StatCard icon={UserMinus} label="Absent today" value={stats?.absentToday} loading={statsQuery.isLoading} tone="danger" href="/dashboard/staff/attendance" />
        <StatCard icon={CalendarClock} label="On leave today" value={stats?.onLeaveToday} loading={statsQuery.isLoading} href="/dashboard/staff/leave" />
        <StatCard
          icon={CalendarClock}
          label="Pending leave approvals"
          value={stats?.pendingLeaveApprovals}
          loading={statsQuery.isLoading}
          tone={stats?.pendingLeaveApprovals ? 'warning' : 'default'}
          href="/dashboard/staff/leave"
        />
      </StatCardGrid>

      {stats && stats.byDepartment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Staff by department</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.byDepartment.map((d) => (
              <div key={d.departmentId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.departmentName}</span>
                <span className="font-medium text-foreground">{d.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {stats && stats.shiftCoverageToday.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shift coverage today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.shiftCoverageToday.map((s) => (
              <div key={s.shiftId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{s.shiftName}</span>
                <span className="font-medium text-foreground">
                  {s.clockedIn} / {s.assigned} clocked in
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/staff/directory">
            <UserPlus className="h-3.5 w-3.5" />
            Add staff member
          </Link>
        </Button>
      </div>
    </PageLayout>
  )
}
