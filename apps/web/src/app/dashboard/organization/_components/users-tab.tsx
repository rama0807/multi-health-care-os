'use client'

import { useQuery } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Total users" value={stats.users.total} />
          <Stat label="Active users" value={stats.users.active} />
          <Stat label="Signed in (last 30 days)" value={stats.users.activeLast30Days} />
        </div>
      )}

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Organization administrators</h3>
          <p className="text-xs text-muted-foreground">
            Users holding an organization-admin role. Manage the wider staff directory under Staff.
          </p>
        </div>
        <Table>
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
            {adminsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  Loading administrators…
                </TableCell>
              </TableRow>
            )}
            {!adminsQuery.isLoading && admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No administrators found.
                </TableCell>
              </TableRow>
            )}
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="font-medium">
                  {admin.firstName} {admin.lastName}
                </TableCell>
                <TableCell>{admin.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {admin.roles.map((role) => (
                      <Badge key={role.roleId} variant="secondary">
                        {role.roleName}
                        {role.hospitalId ? ' (hospital-scoped)' : ''}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={admin.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {admin.status.replace(/_/g, ' ').toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(admin.lastLoginAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
