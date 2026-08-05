import {
  OrganizationStatus,
  PlatformHospitalRow,
  PlatformOrganizationDetail,
  PlatformOrganizationQuery,
  PlatformOrganizationSummary,
} from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { StorageUsageService } from '../../common/tenant/storage-usage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

export interface PlatformHospitalQuery {
  page?: number
  limit?: number
  search?: string
  organizationId?: string
}

/**
 * Cross-tenant organization administration (Checkpoint 16.2).
 *
 * Only reachable behind `PlatformGuard` + a `platform.*` permission. Audit
 * entries written here are stamped with the *target* organization's id, not
 * the platform tenant's — a suspension must appear in the affected customer's
 * own audit trail, which is where anyone investigating it will look.
 */
@Injectable()
export class PlatformOrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageUsage: StorageUsageService,
  ) {}

  async list(query: PlatformOrganizationQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 25

    const where: Prisma.OrganizationWhereInput = {
      // The platform's own tenant is infrastructure, not a customer — it is
      // excluded unless explicitly requested.
      ...(query.includePlatform ? {} : { isPlatform: false }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.plan ? { subscriptionTier: query.plan } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        include: {
          subscription: true,
          _count: { select: { hospitals: true, users: true, patients: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ])

    const data: PlatformOrganizationSummary[] = rows.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      // Prisma generates its enums as string-literal unions; `@medicore/types`
      // declares them as TypeScript enums. The two are structurally identical
      // but nominally distinct, so a cast at the Prisma boundary is this
      // repo's established idiom (see `AdmissionsService`, `StaffService`).
      type: org.type as unknown as PlatformOrganizationSummary['type'],
      status: org.status as unknown as PlatformOrganizationSummary['status'],
      isActive: org.isActive,
      isPlatform: org.isPlatform,
      email: org.email,
      phone: org.phone,
      city: org.city,
      country: org.country,
      suspendedAt: org.suspendedAt,
      suspensionReason: org.suspensionReason,
      subscriptionPlan: (org.subscription?.plan ??
        org.subscriptionTier) as unknown as PlatformOrganizationSummary['subscriptionPlan'],
      subscriptionStatus: (org.subscription?.status ??
        null) as unknown as PlatformOrganizationSummary['subscriptionStatus'],
      subscriptionEndsAt: org.subscription?.endsAt ?? org.subscriptionExpiresAt,
      hospitalCount: org._count.hospitals,
      userCount: org._count.users,
      patientCount: org._count.patients,
      createdAt: org.createdAt,
    }))

    return { data, pagination: buildPagination(page, limit, total) }
  }

  async getById(organizationId: string): Promise<PlatformOrganizationDetail> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: true,
        _count: { select: { hospitals: true, users: true, patients: true } },
        hospitals: {
          include: { _count: { select: { departments: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!org) throw new NotFoundException('Organization not found')

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [admins, storageBytes, activeUsersLast30Days] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          organizationId,
          userRoles: { some: { role: { systemRole: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] } } } },
        },
        select: { id: true, email: true, firstName: true, lastName: true, lastLoginAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.storageUsage.getTotalBytes(organizationId),
      this.prisma.user.count({ where: { organizationId, lastLoginAt: { gte: thirtyDaysAgo } } }),
    ])

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      type: org.type as unknown as PlatformOrganizationDetail['type'],
      status: org.status as unknown as PlatformOrganizationDetail['status'],
      isActive: org.isActive,
      isPlatform: org.isPlatform,
      email: org.email,
      phone: org.phone,
      address: org.address,
      city: org.city,
      state: org.state,
      country: org.country,
      pincode: org.pincode,
      website: org.website,
      licenseNumber: org.licenseNumber,
      taxId: org.taxId,
      suspendedAt: org.suspendedAt,
      suspensionReason: org.suspensionReason,
      subscriptionPlan: (org.subscription?.plan ??
        org.subscriptionTier) as unknown as PlatformOrganizationDetail['subscriptionPlan'],
      subscriptionStatus: (org.subscription?.status ??
        null) as unknown as PlatformOrganizationDetail['subscriptionStatus'],
      subscriptionEndsAt: org.subscription?.endsAt ?? org.subscriptionExpiresAt,
      hospitalCount: org._count.hospitals,
      userCount: org._count.users,
      patientCount: org._count.patients,
      createdAt: org.createdAt,
      hospitals: org.hospitals.map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code,
        city: h.city,
        isActive: h.isActive,
        departmentCount: h._count.departments,
        createdAt: h.createdAt,
      })),
      admins,
      storageBytes,
      activeUsersLast30Days,
    }
  }

  /** Every hospital across every tenant. */
  async listHospitals(query: PlatformHospitalQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 25

    const where: Prisma.HospitalWhereInput = {
      ...(query.organizationId ? { organizationId: query.organizationId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { code: { contains: query.search, mode: 'insensitive' } },
              { organization: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.hospital.findMany({
        where,
        include: {
          organization: { select: { name: true, slug: true } },
          _count: { select: { departments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.hospital.count({ where }),
    ])

    const data: PlatformHospitalRow[] = rows.map((h) => ({
      id: h.id,
      name: h.name,
      code: h.code,
      city: h.city,
      isActive: h.isActive,
      createdAt: h.createdAt,
      organizationId: h.organizationId,
      organizationName: h.organization.name,
      organizationSlug: h.organization.slug,
      departmentCount: h._count.departments,
    }))

    return { data, pagination: buildPagination(page, limit, total) }
  }

  // ── Tenant lifecycle ───────────────────────────────────────────────────

  /**
   * Suspending sets `isActive = false` as well as `status = SUSPENDED`.
   * `isActive` is the switch `JwtStrategy.validate` and `AuthService.login`
   * already enforce, so reusing it means suspension takes effect on the very
   * next request instead of needing a second enforcement path that an existing
   * route could miss.
   */
  async suspend(organizationId: string, reason: string, actorUserId: string) {
    const org = await this.requireCustomerOrganization(organizationId)

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: OrganizationStatus.SUSPENDED,
        isActive: false,
        suspendedAt: new Date(),
        suspensionReason: reason,
      },
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'platform.organization_suspended',
      resource: 'Organization',
      resourceId: organizationId,
      before: { status: org.status, isActive: org.isActive },
      after: { status: updated.status, isActive: updated.isActive, reason },
    })

    return updated
  }

  /** Lifts a suspension and re-enables logins. */
  async reinstate(organizationId: string, actorUserId: string) {
    const org = await this.requireCustomerOrganization(organizationId)

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        status: OrganizationStatus.ACTIVE,
        isActive: true,
        suspendedAt: null,
        suspensionReason: null,
      },
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'platform.organization_reinstated',
      resource: 'Organization',
      resourceId: organizationId,
      before: {
        status: org.status,
        isActive: org.isActive,
        suspensionReason: org.suspensionReason,
      },
      after: { status: updated.status, isActive: updated.isActive },
    })

    return updated
  }

  /**
   * Enable/disable a tenant without recording a suspension — the operational
   * kill switch, as opposed to the commercial one. `status` is left untouched
   * so a disabled-but-not-suspended tenant stays distinguishable from a
   * suspended one. Re-enabling a *suspended* organization is refused: lifting
   * a suspension is `reinstate`'s job, and silently clearing one here would
   * lose the reason.
   */
  async setEnabled(organizationId: string, enabled: boolean, actorUserId: string) {
    const org = await this.requireCustomerOrganization(organizationId)

    if (enabled && org.status === OrganizationStatus.SUSPENDED) {
      throw new BadRequestException(
        'This organization is suspended — reinstate it instead of re-enabling it',
      )
    }

    if (org.isActive === enabled) return org

    const updated = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { isActive: enabled },
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: enabled ? 'platform.organization_enabled' : 'platform.organization_disabled',
      resource: 'Organization',
      resourceId: organizationId,
      before: { isActive: org.isActive },
      after: { isActive: updated.isActive },
    })

    return updated
  }

  /**
   * The platform tenant must never be suspendable from its own console —
   * doing so would lock every platform owner out with no way back in.
   */
  private async requireCustomerOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found')
    if (org.isPlatform) {
      throw new BadRequestException('The platform organization cannot be suspended or disabled')
    }
    return org
  }
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  }
}
