'use client'

import { useQuery } from '@tanstack/react-query'
import { KeyRound, Mail, ShieldCheck, UsersRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { SectionHeader } from '@/components/ui/page-header'
import { TableSkeleton } from '@/components/ui/skeleton'
import { StatCard, StatCardGrid } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/status-badge'
import { Table, TableBody, TableCell, TableContainer, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getOrganizationAdmins, getOrganizationStats } from '@/lib/api/organization'

import { formatDateTime } from './format'

const NOT_YET_AVAILABLE = [
  {
    key: 'roles',
    icon: ShieldCheck,
    title: 'Custom roles',
    description: 'Compose roles from individual permissions instead of the seeded role set.',
  },
  {
    key: 'invitations',
    icon: Mail,
    title: 'Invitations',
    description: 'Invite a teammate by email and let them set their own password.',
  },
  {
    key: 'teams',
    icon: UsersRound,
    title: 'Teams',
    description: 'Group users across hospitals for shared visibility and approvals.',
  },
] as const

/**
 * Administrators are users holding an ORG_ADMIN/SUPER_ADMIN role, not a
 * separate entity - see `OrganizationsService.listAdmins`. Full user
 * management already lives in the Staff module, so this tab shows the
 * administrator roster plus organization-wide user counts rather than
 * duplicating a second user CRUD screen. Roles/Invitations/Teams have no
 * backing API yet - shown as disclosed, non-interactive cards rather than a
 * form that would silently do nothing.
 */
export function PeopleSection() {
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
    <div className="space-y-4">
      <SectionHeader title="People" description="Administrators, roles and access across every hospital." />

      {stats && (
        <StatCardGrid columns={3}>
          <StatCard icon={UsersRound} label="Total users" value={stats.users.total} />
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

      <div>
        <SectionHeader title="Coming soon" description="Not available in this release." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {NOT_YET_AVAILABLE.map((item) => (
            <Card key={item.key} variant="inset" className="p-4">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-md bg-surface text-subtle-foreground ring-1 ring-inset ring-border/60">
                  <item.icon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{item.description}</p>
            </Card>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <KeyRound className="mr-1 inline size-3.5" aria-hidden="true" />
        Access today is role-based via the seeded role catalog - see the Security tab for what
        governs sign-in.
      </p>
    </div>
  )
}
