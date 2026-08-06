import {
  OrganizationBranding,
  OrganizationSettings,
  OrganizationStats,
  UpdateOrganizationBrandingDto,
  UpdateOrganizationDto,
  UpdateOrganizationSettingsDto,
} from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { StorageUsageService } from '../../common/tenant/storage-usage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

const LOGO_MAX_BYTES = 2 * 1024 * 1024
const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']

export interface LogoUploadInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly storageUsage: StorageUsageService,
  ) {}

  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found')
    return org
  }

  async updateCurrent(organizationId: string, dto: UpdateOrganizationDto, actorUserId: string) {
    const before = await this.getCurrent(organizationId)
    const after = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.updated',
      resource: 'Organization',
      resourceId: organizationId,
      before: pickProfileFields(before),
      after: pickProfileFields(after),
    })

    return after
  }

  // ── Settings (Checkpoint 16.4) ─────────────────────────────────────────

  async getSettings(organizationId: string): Promise<OrganizationSettings> {
    const org = await this.getCurrent(organizationId)
    return (org.settings ?? {}) as unknown as OrganizationSettings
  }

  /**
   * Merges into the existing blob rather than replacing it. `settings` is read
   * by Patients (`uhidPrefix`), Billing (`gstRate`) and Appointments
   * (`defaultAppointmentDuration`) without a fallback, so a PUT-style replace
   * from a partially-populated settings form would silently break them.
   */
  async updateSettings(
    organizationId: string,
    dto: UpdateOrganizationSettingsDto,
    actorUserId: string,
  ): Promise<OrganizationSettings> {
    const current = await this.getSettings(organizationId)
    const merged: OrganizationSettings = { ...current, ...dto }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: merged as unknown as Prisma.InputJsonValue },
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.settings_updated',
      resource: 'Organization',
      resourceId: organizationId,
      before: current,
      after: merged,
    })

    return merged
  }

  // ── Branding (Checkpoint 16.1 / 16.4) ──────────────────────────────────

  async getBranding(
    organizationId: string,
  ): Promise<OrganizationBranding & { logo: string | null }> {
    const org = await this.getCurrent(organizationId)
    return {
      ...((org.branding ?? {}) as unknown as OrganizationBranding),
      logo: org.logo,
    }
  }

  async updateBranding(
    organizationId: string,
    dto: UpdateOrganizationBrandingDto,
    actorUserId: string,
  ): Promise<OrganizationBranding & { logo: string | null }> {
    const org = await this.getCurrent(organizationId)
    const current = (org.branding ?? {}) as unknown as OrganizationBranding
    const merged: OrganizationBranding = { ...current, ...dto }

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { branding: merged as unknown as Prisma.InputJsonValue },
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.branding_updated',
      resource: 'Organization',
      resourceId: organizationId,
      before: current,
      after: merged,
    })

    return { ...merged, logo: org.logo }
  }

  /**
   * Reuses the shared `StorageService` - the same upload path every document
   * feature in this repo already uses. The previous logo is deleted only after
   * the new URL is committed, so a delete failure never leaves the
   * organization without a logo.
   */
  async uploadLogo(
    organizationId: string,
    file: LogoUploadInput,
    actorUserId: string,
  ): Promise<{ logo: string }> {
    if (!LOGO_MIME_TYPES.includes(file.mimeType)) {
      throw new BadRequestException(`Logo must be one of: ${LOGO_MIME_TYPES.join(', ')}`)
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new BadRequestException('Logo must be 2 MB or smaller')
    }

    const org = await this.getCurrent(organizationId)
    const previousLogo = org.logo

    const key = `organizations/${organizationId}/branding/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const url = await this.storageService.upload({
      key,
      buffer: file.buffer,
      mimeType: file.mimeType,
    })

    await this.prisma.organization.update({ where: { id: organizationId }, data: { logo: url } })

    if (previousLogo && previousLogo !== url) {
      // Best-effort: an orphaned old logo is preferable to failing an upload
      // the caller has already been told succeeded.
      await this.storageService.delete(previousLogo).catch(() => undefined)
    }

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.logo_uploaded',
      resource: 'Organization',
      resourceId: organizationId,
      before: { logo: previousLogo },
      after: { logo: url },
    })

    return { logo: url }
  }

  async removeLogo(organizationId: string, actorUserId: string): Promise<void> {
    const org = await this.getCurrent(organizationId)
    if (!org.logo) return

    await this.prisma.organization.update({ where: { id: organizationId }, data: { logo: null } })
    await this.storageService.delete(org.logo).catch(() => undefined)

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'organization.logo_removed',
      resource: 'Organization',
      resourceId: organizationId,
      before: { logo: org.logo },
    })
  }

  // ── Dashboard statistics (Checkpoint 16.1) ─────────────────────────────

  async getStats(organizationId: string): Promise<OrganizationStats> {
    const org = await this.getCurrent(organizationId)
    const thirtyDaysAgo = daysAgo(30)

    const [
      hospitalsTotal,
      hospitalsActive,
      usersTotal,
      usersActive,
      usersActiveRecently,
      departments,
      patients,
      doctors,
      staff,
      appointments,
      admissions,
      storageBytes,
    ] = await Promise.all([
      this.prisma.hospital.count({ where: { organizationId } }),
      this.prisma.hospital.count({ where: { organizationId, isActive: true } }),
      this.prisma.user.count({ where: { organizationId } }),
      this.prisma.user.count({ where: { organizationId, status: 'ACTIVE' } }),
      this.prisma.user.count({ where: { organizationId, lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.prisma.department.count({ where: { organizationId } }),
      this.prisma.patient.count({ where: { organizationId, isActive: true } }),
      this.prisma.doctor.count({ where: { organizationId } }),
      this.prisma.staff.count({ where: { organizationId } }),
      this.prisma.appointment.count({
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.admission.count({ where: { organizationId, createdAt: { gte: thirtyDaysAgo } } }),
      this.storageUsage.getTotalBytes(organizationId),
    ])

    return {
      hospitals: { total: hospitalsTotal, active: hospitalsActive },
      users: { total: usersTotal, active: usersActive, activeLast30Days: usersActiveRecently },
      departments,
      patients,
      doctors,
      staff,
      appointmentsLast30Days: appointments,
      admissionsLast30Days: admissions,
      storageBytes,
      createdAt: org.createdAt,
    }
  }

  // ── Organization administrators (Checkpoint 16.1) ──────────────────────

  /**
   * Administrators are not a new entity - they are the organization's users
   * holding a role whose `systemRole` is ORG_ADMIN (or the platform tenant's
   * SUPER_ADMIN). Reusing `UserRole` keeps one source of truth for who can do
   * what; a separate `OrganizationAdmin` table would immediately drift from it.
   */
  async listAdmins(organizationId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        organizationId,
        userRoles: { some: { role: { systemRole: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] } } } },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        userRoles: {
          select: { hospitalId: true, role: { select: { id: true, name: true, systemRole: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      phone: u.phone,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      roles: u.userRoles.map((ur) => ({
        roleId: ur.role.id,
        roleName: ur.role.name,
        systemRole: ur.role.systemRole,
        hospitalId: ur.hospitalId,
      })),
    }))
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

/** The subset an audit entry needs - avoids copying the whole settings blob. */
function pickProfileFields(org: {
  name: string
  email: string
  phone: string
  address: string | null
  city: string | null
  state: string | null
  country: string
  pincode: string | null
  website: string | null
  licenseNumber: string | null
  taxId: string | null
}) {
  return {
    name: org.name,
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
  }
}
