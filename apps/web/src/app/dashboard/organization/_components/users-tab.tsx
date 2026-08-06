'use client'

import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOrganizationAdmins, getOrganizationStats } from '@/lib/api/organization'

import { formatDateTime } from './format'

/**
 * Administrators are users holding an ORG_ADMIN/SUPER_ADMIN role, not a
 * separate entity — see `OrganizationsService.listAdmins`. Full user
 * management already lives in the Staff module, so this tab shows the
 * administrator roster plus organization-wide user counts rather than
 * duplicating a second user CRUD screen.
 */
export function UsersTab() {
  const adminsQuery = useQuery({
    queryKey: ['organization', 'admins'],
    queryFn: getOrganizationAdmins,
  })
  const statsQuery = useQuery({
    queryKey: ['organization', 'stats'],
    queryFn: getOrganizationStats,
  })

  const admins = adminsQuery.data ?? []
  const stats = statsQuery.data

  return (
    <div className="space-y-4 pt-4">
      {stats && (
        <StatCardGrid columns={3}>
          <StatCard label="Total users" value={stats.users.total} />
          <StatCard label="Active users" value={stats.users.active} />
          <StatCard label="Signed in (last 30 days)" value={stats.users.activeLast30Days} />
        </StatCardGrid>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Organization administrators</CardTitle>
          <CardDescription>
            Users holding an organization-admin role. Manage the wider staff directory under Staff.
          </CardDescription>
        </CardHeader>
        {adminsQuery.isLoading ? (
          <div className="p-4">
            <TableSkeleton rows={4} columns={5} />
          </div>
        ) : admins.length === 0 ? (
          <EmptyState compact title="No administrators found" />
        ) : (
          <TableContainer className="rounded-none border-0 border-y">
            <Table density="compact" container={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      {admin.firstName} {admin.lastName}
                    </TableCell>
                    <TableCell>{admin.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {admin.roles.map((role) => (
                          <Badge key={role.roleId} variant="neutral">
                            {role.roleName}
                            {role.hospitalId ? ' (hospital-scoped)' : ''}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={admin.status} />
                    </TableCell>
                    <TableCell>{formatDateTime(admin.lastLoginAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </div>
  )
}
