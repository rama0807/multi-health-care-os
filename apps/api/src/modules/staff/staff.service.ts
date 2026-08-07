import { CreateStaffDto, Staff, StaffSearchQuery, UpdateStaffDto } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { EmploymentStatus, Prisma, Staff as PrismaStaff, SystemRole, User } from '@prisma/client'

import { StaffOnboardingService } from '../../common/onboarding/staff-onboarding.service'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { HospitalsService } from '../hospitals/hospitals.service'

type StaffWithRelations = PrismaStaff & {
  user: User
  department: { id: string; name: string; code: string } | null
  hospital: { id: string; name: string; code: string }
  reportsTo: { id: string; designation: string; user: Pick<User, 'firstName' | 'lastName'> } | null
}

const STAFF_INCLUDE = {
  user: true,
  department: { select: { id: true, name: true, code: true } },
  hospital: { select: { id: true, name: true, code: true } },
  reportsTo: { select: { id: true, designation: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.StaffInclude

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffOnboardingService: StaffOnboardingService,
    private readonly hospitalsService: HospitalsService,
    private readonly departmentsService: DepartmentsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: StaffSearchQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const where: Prisma.StaffWhereInput = { organizationId }
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.hospitalId) where.hospitalId = query.hospitalId
    if (query.reportsToId) where.reportsToId = query.reportsToId
    if (query.employmentType) where.employmentType = query.employmentType
    if (query.employmentStatus) where.employmentStatus = query.employmentStatus
    if (query.designation) where.designation = { contains: query.designation, mode: 'insensitive' }
    if (query.q) {
      where.OR = [
        { employeeId: { contains: query.q, mode: 'insensitive' } },
        { designation: { contains: query.q, mode: 'insensitive' } },
        { user: { firstName: { contains: query.q, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.q, mode: 'insensitive' } } },
      ]
    }

    const orderBy: Prisma.StaffOrderByWithRelationInput =
      sortBy === 'firstName' ? { user: { firstName: sortOrder } } : { [sortBy]: sortOrder }

    const [data, total] = await Promise.all([
      this.prisma.staff.findMany({ where, include: STAFF_INCLUDE, orderBy, skip: (page - 1) * limit, take: limit }),
      this.prisma.staff.count({ where }),
    ])

    return {
      data: data.map((staff) => this.toResponse(staff)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  async getById(organizationId: string, id: string): Promise<Staff> {
    const staff = await this.requireStaffWithRelations(organizationId, id)
    return this.toResponse(staff)
  }

  async getMyProfile(organizationId: string, userId: string): Promise<Staff> {
    const staff = await this.prisma.staff.findFirst({ where: { userId, organizationId }, include: STAFF_INCLUDE })
    if (!staff) throw new NotFoundException('No staff profile is linked to this account')
    return this.toResponse(staff)
  }

  async create(organizationId: string, dto: CreateStaffDto, actorUserId?: string): Promise<Staff> {
    await this.hospitalsService.getById(organizationId, dto.hospitalId)

    if (dto.departmentId) {
      const department = await this.departmentsService.getById(organizationId, dto.departmentId)
      if (department.hospitalId !== dto.hospitalId) {
        throw new ConflictException('The selected department does not belong to the selected hospital')
      }
    }

    if (dto.reportsToId) {
      await this.requireStaffWithRelations(organizationId, dto.reportsToId)
    }

    if (dto.employeeId) {
      const conflict = await this.prisma.staff.findUnique({
        where: { employeeId_organizationId: { employeeId: dto.employeeId, organizationId } },
      })
      if (conflict) {
        throw new ConflictException('A staff member with this employee ID already exists')
      }
    }

    const { staff, onboarding } = await this.prisma.$transaction(async (tx) => {
      const onboardingResult = await this.staffOnboardingService.onboardUserInTransaction(tx, {
        organizationId,
        hospitalId: dto.hospitalId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        systemRole: dto.systemRole as unknown as SystemRole,
      })

      const existingStaffProfile = await tx.staff.findUnique({ where: { userId: onboardingResult.user.id } })
      if (existingStaffProfile) {
        throw new ConflictException('This user already has a staff profile')
      }

      const employeeId = dto.employeeId ?? (await this.generateEmployeeId(tx, organizationId))

      const created = await tx.staff.create({
        data: {
          userId: onboardingResult.user.id,
          organizationId,
          hospitalId: dto.hospitalId,
          departmentId: dto.departmentId,
          employeeId,
          designation: dto.designation,
          employmentType: dto.employmentType,
          reportsToId: dto.reportsToId,
          joiningDate: new Date(dto.joiningDate),
          monthlySalary: dto.monthlySalary,
        },
        include: STAFF_INCLUDE,
      })

      return { staff: created, onboarding: onboardingResult }
    })

    this.staffOnboardingService.sendOnboardingEmail({
      user: onboarding.user,
      created: onboarding.created,
      temporaryPassword: onboarding.temporaryPassword,
      roleName: dto.systemRole,
    })

    this.eventEmitter.emit('staff.created', { staffId: staff.id, organizationId, userId: actorUserId })

    return this.toResponse(staff)
  }

  async update(organizationId: string, id: string, dto: UpdateStaffDto, actorUserId?: string): Promise<Staff> {
    await this.requireStaffWithRelations(organizationId, id)

    if (dto.hospitalId) {
      await this.hospitalsService.getById(organizationId, dto.hospitalId)
    }
    if (dto.departmentId) {
      const department = await this.departmentsService.getById(organizationId, dto.departmentId)
      if (dto.hospitalId && department.hospitalId !== dto.hospitalId) {
        throw new ConflictException('The selected department does not belong to the selected hospital')
      }
    }
    if (dto.reportsToId) {
      if (dto.reportsToId === id) {
        throw new ConflictException('A staff member cannot report to themselves')
      }
      await this.requireStaffWithRelations(organizationId, dto.reportsToId)
    }
    if (dto.employeeId) {
      const conflict = await this.prisma.staff.findUnique({
        where: { employeeId_organizationId: { employeeId: dto.employeeId, organizationId } },
      })
      if (conflict && conflict.id !== id) {
        throw new ConflictException('A staff member with this employee ID already exists')
      }
    }

    const staff = await this.prisma.staff.update({
      where: { id },
      data: {
        ...dto,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        dateOfLeaving: dto.dateOfLeaving ? new Date(dto.dateOfLeaving) : undefined,
      },
      include: STAFF_INCLUDE,
    })

    this.eventEmitter.emit('staff.updated', { staffId: id, organizationId, userId: actorUserId })

    return this.toResponse(staff)
  }

  async setEmploymentStatus(
    organizationId: string,
    id: string,
    status: EmploymentStatus,
    actorUserId?: string,
  ): Promise<Staff> {
    await this.requireStaffWithRelations(organizationId, id)

    const staff = await this.prisma.staff.update({
      where: { id },
      data: {
        employmentStatus: status,
        dateOfLeaving: status === 'TERMINATED' || status === 'RESIGNED' ? new Date() : undefined,
      },
      include: STAFF_INCLUDE,
    })

    this.eventEmitter.emit('staff.employment_status_changed', {
      staffId: id,
      organizationId,
      userId: actorUserId,
      status,
    })

    return this.toResponse(staff)
  }

  private async generateEmployeeId(tx: Prisma.TransactionClient, organizationId: string): Promise<string> {
    const org = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':staff_employee_id')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.staff.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `EMP-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  async requireStaffWithRelations(organizationId: string, id: string): Promise<StaffWithRelations> {
    const staff = await this.prisma.staff.findFirst({ where: { id, organizationId }, include: STAFF_INCLUDE })
    if (!staff) throw new NotFoundException('Staff member not found')
    return staff
  }

  private toResponse(staff: StaffWithRelations): Staff {
    return {
      id: staff.id,
      userId: staff.userId,
      firstName: staff.user.firstName,
      lastName: staff.user.lastName,
      fullName: `${staff.user.firstName} ${staff.user.lastName}`,
      email: staff.user.email,
      phone: staff.user.phone,
      employeeId: staff.employeeId,
      designation: staff.designation,
      departmentId: staff.departmentId,
      department: staff.department,
      hospitalId: staff.hospitalId,
      hospital: staff.hospital,
      organizationId: staff.organizationId,
      employmentType: staff.employmentType as unknown as Staff['employmentType'],
      employmentStatus: staff.employmentStatus as unknown as Staff['employmentStatus'],
      reportsToId: staff.reportsToId,
      reportsTo: staff.reportsTo
        ? {
            id: staff.reportsTo.id,
            fullName: `${staff.reportsTo.user.firstName} ${staff.reportsTo.user.lastName}`,
            designation: staff.reportsTo.designation,
          }
        : null,
      joiningDate: staff.joiningDate,
      dateOfLeaving: staff.dateOfLeaving,
      monthlySalary: staff.monthlySalary ? Number(staff.monthlySalary) : null,
      createdAt: staff.createdAt,
      updatedAt: staff.updatedAt,
    }
  }
}
