import { SystemRole } from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

export interface ResolvedAuthContext {
  roles: SystemRole[]
  permissions: string[]
  hospitalIds: string[]
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolves a user's effective roles/permissions/hospital-scope for embedding in a JWT. */
  async resolveAuthContext(userId: string): Promise<ResolvedAuthContext> {
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
      },
    })

    const roles = [...new Set(userRoles.map((ur) => ur.role.systemRole).filter(Boolean))] as SystemRole[]

    const permissions = [
      ...new Set(
        userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map(
            (rp) => `${rp.permission.resource}.${rp.permission.action}.${rp.permission.scope}`,
          ),
        ),
      ),
    ]

    const hospitalIds = [...new Set(userRoles.map((ur) => ur.hospitalId).filter(Boolean))] as string[]

    return { roles, permissions, hospitalIds }
  }

  /** Creates the org-wide administrator role used at organization registration time. */
  async createDefaultOrgAdminRole(organizationId: string) {
    const allPermissions = await this.prisma.permission.findMany()
    return this.prisma.role.create({
      data: {
        name: 'Admin',
        systemRole: SystemRole.ORG_ADMIN,
        organizationId,
        description: 'Full access across the organization',
        rolePermissions: {
          create: allPermissions.map((p) => ({ permissionId: p.id })),
        },
      },
    })
  }

  async listRoles(organizationId: string) {
    return this.prisma.role.findMany({
      where: { organizationId },
      include: { rolePermissions: { include: { permission: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] })
  }

  async createRole(organizationId: string, dto: { name: string; description?: string; permissionIds: string[] }) {
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: dto.permissionIds } },
    })
    if (permissions.length !== dto.permissionIds.length) {
      throw new BadRequestException('One or more permission IDs are invalid')
    }

    const existing = await this.prisma.role.findUnique({
      where: { name_organizationId: { name: dto.name, organizationId } },
    })
    if (existing) throw new ConflictException('A role with this name already exists')

    return this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        organizationId,
        rolePermissions: { create: dto.permissionIds.map((permissionId) => ({ permissionId })) },
      },
      include: { rolePermissions: { include: { permission: true } } },
    })
  }

  async updateRolePermissions(organizationId: string, roleId: string, permissionIds: string[]) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, organizationId } })
    if (!role) throw new NotFoundException('Role not found')

    await this.prisma.rolePermission.deleteMany({ where: { roleId } })
    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        rolePermissions: { create: permissionIds.map((permissionId) => ({ permissionId })) },
      },
    })

    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    })
  }

  async assignRole(organizationId: string, userId: string, roleId: string, hospitalId?: string) {
    const [user, role] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, organizationId } }),
      this.prisma.role.findFirst({ where: { id: roleId, organizationId } }),
    ])
    if (!user) throw new NotFoundException('User not found in this organization')
    if (!role) throw new NotFoundException('Role not found in this organization')

    if (hospitalId) {
      const hospital = await this.prisma.hospital.findFirst({
        where: { id: hospitalId, organizationId },
      })
      if (!hospital) throw new NotFoundException('Hospital not found in this organization')
    }

    return this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: { hospitalId },
      create: { userId, roleId, hospitalId },
    })
  }

  async revokeRole(organizationId: string, userId: string, roleId: string) {
    const role = await this.prisma.role.findFirst({ where: { id: roleId, organizationId } })
    if (!role) throw new NotFoundException('Role not found in this organization')

    await this.prisma.userRole.delete({ where: { userId_roleId: { userId, roleId } } })
  }
}
