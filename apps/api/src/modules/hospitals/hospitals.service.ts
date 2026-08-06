import {
  CreateHospitalDto,
  OnboardHospitalDto,
  OnboardHospitalResult,
  TenantContext,
  UpdateHospitalDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'

import { StaffOnboardingService } from '../../common/onboarding/staff-onboarding.service'
import { hospitalScopeFilter } from '../../common/tenant/tenant.util'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

@Injectable()
export class HospitalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly onboardingService: StaffOnboardingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * `tenant` is optional so every pre-existing caller keeps working unchanged.
   * When supplied, a user whose role assignments are hospital-scoped sees only
   * those hospitals - the org-wide behaviour (empty `hospitalIds`) is
   * unchanged, per Checkpoint 16.3.
   */
  async list(organizationId: string, tenant?: TenantContext, includeInactive = true) {
    const scope = tenant ? hospitalScopeFilter(tenant) : null

    return this.prisma.hospital.findMany({
      where: {
        organizationId,
        ...(scope ? { id: { in: scope } } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: { _count: { select: { departments: true, doctors: true, staff: true } } },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getById(organizationId: string, id: string) {
    const hospital = await this.prisma.hospital.findFirst({ where: { id, organizationId } })
    if (!hospital) throw new NotFoundException('Hospital not found')
    return hospital
  }

  async create(organizationId: string, dto: CreateHospitalDto, actorUserId?: string) {
    await this.assertCodeAvailable(organizationId, dto.code)

    const hospital = await this.prisma.hospital.create({ data: { ...dto, organizationId } })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'hospital.created',
      resource: 'Hospital',
      resourceId: hospital.id,
      after: { name: hospital.name, code: hospital.code },
    })

    this.eventEmitter.emit('hospital.created', {
      organizationId,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      hospitalCode: hospital.code,
      userId: actorUserId,
    })

    return hospital
  }

  /**
   * Hospital onboarding wizard (Checkpoint 16.1).
   *
   * The hospital and its departments are created in one transaction, so a bad
   * department code cannot leave a half-configured hospital behind. The
   * administrator account is provisioned inside the same transaction via the
   * existing generic `StaffOnboardingService`; its welcome email is sent
   * *after* commit, exactly as that service's contract requires.
   */
  async onboard(
    organizationId: string,
    dto: OnboardHospitalDto,
    actorUserId?: string,
  ): Promise<OnboardHospitalResult> {
    const { admin, departments: requestedDepartments, ...hospitalFields } = dto
    const departments = requestedDepartments ?? []

    await this.assertCodeAvailable(organizationId, hospitalFields.code)

    const duplicateDeptCode = firstDuplicate(departments.map((d) => d.code))
    if (duplicateDeptCode) {
      throw new ConflictException(`Duplicate department code in request: ${duplicateDeptCode}`)
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const hospital = await tx.hospital.create({
        data: { ...hospitalFields, organizationId },
      })

      const createdDepartments = []
      for (const dept of departments) {
        createdDepartments.push(
          await tx.department.create({
            data: {
              name: dept.name,
              code: dept.code,
              description: dept.description,
              hospitalId: hospital.id,
              organizationId,
            },
          }),
        )
      }

      const onboarded = admin
        ? await this.onboardingService.onboardUserInTransaction(tx, {
            organizationId,
            hospitalId: hospital.id,
            email: admin.email,
            firstName: admin.firstName,
            lastName: admin.lastName,
            phone: admin.phone,
            systemRole: admin.systemRole,
          })
        : null

      return { hospital, departments: createdDepartments, onboarded }
    })

    if (result.onboarded && admin) {
      // Outside the transaction on purpose - a rollback must never leave a
      // user holding an email promising access that doesn't exist.
      this.onboardingService.sendOnboardingEmail({
        user: result.onboarded.user,
        created: result.onboarded.created,
        temporaryPassword: result.onboarded.temporaryPassword,
        roleName: admin.systemRole,
      })
    }

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'hospital.onboarded',
      resource: 'Hospital',
      resourceId: result.hospital.id,
      after: {
        name: result.hospital.name,
        code: result.hospital.code,
        departmentCount: result.departments.length,
        adminEmail: admin?.email ?? null,
      },
    })

    this.eventEmitter.emit('hospital.created', {
      organizationId,
      hospitalId: result.hospital.id,
      hospitalName: result.hospital.name,
      hospitalCode: result.hospital.code,
      userId: actorUserId,
    })

    return {
      hospital: result.hospital,
      departments: result.departments,
      admin: result.onboarded
        ? {
            userId: result.onboarded.user.id,
            email: result.onboarded.user.email,
            created: result.onboarded.created,
          }
        : null,
    }
  }

  async update(organizationId: string, id: string, dto: UpdateHospitalDto, actorUserId?: string) {
    const before = await this.getById(organizationId, id)

    if (dto.code && dto.code !== before.code) {
      await this.assertCodeAvailable(organizationId, dto.code)
    }

    const after = await this.prisma.hospital.update({ where: { id }, data: dto })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: 'hospital.updated',
      resource: 'Hospital',
      resourceId: id,
      before: { name: before.name, code: before.code, city: before.city },
      after: { name: after.name, code: after.code, city: after.city },
    })

    return after
  }

  async activate(organizationId: string, id: string, actorUserId?: string) {
    return this.setActive(organizationId, id, true, actorUserId)
  }

  async deactivate(organizationId: string, id: string, actorUserId?: string) {
    return this.setActive(organizationId, id, false, actorUserId)
  }

  /**
   * Deactivation is a soft switch - it hides the hospital from pickers and
   * blocks new activity, but deliberately does **not** cascade to its
   * departments, staff, or in-flight admissions. Cascading would silently
   * detach live clinical records; the same conservative choice already applies
   * to ward/room deactivation (TD-0031).
   */
  private async setActive(
    organizationId: string,
    id: string,
    isActive: boolean,
    actorUserId?: string,
  ) {
    const hospital = await this.getById(organizationId, id)
    if (hospital.isActive === isActive) return hospital

    const updated = await this.prisma.hospital.update({ where: { id }, data: { isActive } })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: isActive ? 'hospital.activated' : 'hospital.deactivated',
      resource: 'Hospital',
      resourceId: id,
      before: { isActive: hospital.isActive },
      after: { isActive },
    })

    return updated
  }

  private async assertCodeAvailable(organizationId: string, code: string): Promise<void> {
    const existing = await this.prisma.hospital.findUnique({
      where: { code_organizationId: { code, organizationId } },
    })
    if (existing) throw new ConflictException('A hospital with this code already exists')
  }
}

function firstDuplicate(values: string[]): string | undefined {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return undefined
}
