import {
  CreateDoctorDto,
  Doctor,
  DoctorDashboardStats,
  DoctorSearchQuery,
  DoctorSummaryCounts,
  DoctorWithSummary,
  UpdateDoctorDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Doctor as PrismaDoctor, Prisma, SystemRole, User } from '@prisma/client'

import { StaffOnboardingService } from '../../common/onboarding/staff-onboarding.service'
import { PrismaService } from '../../prisma/prisma.service'
import { DepartmentsService } from '../departments/departments.service'
import { HospitalsService } from '../hospitals/hospitals.service'
import { AvailabilityService } from '../scheduling/availability.service'

type DoctorWithRelations = PrismaDoctor & {
  user: User
  department: { id: string; name: string; code: string } | null
  hospital: { id: string; name: string; code: string }
}

const DOCTOR_INCLUDE = {
  user: true,
  department: { select: { id: true, name: true, code: true } },
  hospital: { select: { id: true, name: true, code: true } },
} satisfies Prisma.DoctorInclude

@Injectable()
export class DoctorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staffOnboardingService: StaffOnboardingService,
    private readonly hospitalsService: HospitalsService,
    private readonly departmentsService: DepartmentsService,
    private readonly availabilityService: AvailabilityService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: DoctorSearchQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const where: Prisma.DoctorWhereInput = {
      organizationId,
      isActive: query.isActive === undefined ? true : query.isActive,
    }

    if (query.specialization) {
      where.specialization = { contains: query.specialization, mode: 'insensitive' }
    }
    if (query.departmentId) where.departmentId = query.departmentId
    if (query.hospitalId) where.hospitalId = query.hospitalId
    if (query.language) where.languagesSpoken = { has: query.language }
    if (query.availabilityStatus) where.availabilityStatus = query.availabilityStatus
    if (query.q) {
      where.OR = [
        { specialization: { contains: query.q, mode: 'insensitive' } },
        { registrationNumber: { contains: query.q, mode: 'insensitive' } },
        { user: { firstName: { contains: query.q, mode: 'insensitive' } } },
        { user: { lastName: { contains: query.q, mode: 'insensitive' } } },
      ]
    }

    const orderBy: Prisma.DoctorOrderByWithRelationInput =
      sortBy === 'firstName' ? { user: { firstName: sortOrder } } : { [sortBy]: sortOrder }

    const [data, total] = await Promise.all([
      this.prisma.doctor.findMany({
        where,
        include: DOCTOR_INCLUDE,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.doctor.count({ where }),
    ])

    return {
      data: data.map((doctor) => this.toResponse(doctor)),
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

  async getById(organizationId: string, id: string): Promise<DoctorWithSummary> {
    const doctor = await this.requireDoctor(organizationId, id)
    const summary = await this.getSummaryCounts(organizationId, id)
    return { ...this.toResponse(doctor), summary }
  }

  async getMyProfile(organizationId: string, userId: string): Promise<DoctorWithSummary> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { userId, organizationId },
      include: DOCTOR_INCLUDE,
    })
    if (!doctor) throw new NotFoundException('No doctor profile is linked to this account')

    const summary = await this.getSummaryCounts(organizationId, doctor.id)
    return { ...this.toResponse(doctor), summary }
  }

  async create(organizationId: string, dto: CreateDoctorDto, actorUserId?: string): Promise<Doctor> {
    await this.hospitalsService.getById(organizationId, dto.hospitalId)

    if (dto.departmentId) {
      const department = await this.departmentsService.getById(organizationId, dto.departmentId)
      if (department.hospitalId !== dto.hospitalId) {
        throw new ConflictException('The selected department does not belong to the selected hospital')
      }
    }

    const conflict = await this.prisma.doctor.findUnique({
      where: { registrationNumber_organizationId: { registrationNumber: dto.registrationNumber, organizationId } },
    })
    if (conflict) {
      throw new ConflictException('A doctor with this registration number already exists')
    }

    const { doctor, onboarding } = await this.prisma.$transaction(async (tx) => {
      const onboardingResult = await this.staffOnboardingService.onboardUserInTransaction(tx, {
        organizationId,
        hospitalId: dto.hospitalId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        systemRole: SystemRole.DOCTOR,
      })

      const existingDoctorProfile = await tx.doctor.findUnique({ where: { userId: onboardingResult.user.id } })
      if (existingDoctorProfile) {
        throw new ConflictException('This user already has a doctor profile')
      }

      const created = await tx.doctor.create({
        data: {
          userId: onboardingResult.user.id,
          organizationId,
          hospitalId: dto.hospitalId,
          departmentId: dto.departmentId,
          registrationNumber: dto.registrationNumber,
          specialization: dto.specialization,
          subSpecialization: dto.subSpecialization,
          qualification: dto.qualification,
          experienceYears: dto.experienceYears,
          languagesSpoken: dto.languagesSpoken,
          bio: dto.bio,
          consultationFee: dto.consultationFee,
          availabilityStatus: dto.availabilityStatus,
          joiningDate: new Date(dto.joiningDate),
        },
        include: DOCTOR_INCLUDE,
      })

      return { doctor: created, onboarding: onboardingResult }
    })

    this.staffOnboardingService.sendOnboardingEmail({
      user: onboarding.user,
      created: onboarding.created,
      temporaryPassword: onboarding.temporaryPassword,
      roleName: 'Doctor',
    })

    this.eventEmitter.emit('doctor.created', { doctorId: doctor.id, organizationId, userId: actorUserId })

    return this.toResponse(doctor)
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateDoctorDto,
    actorUserId?: string,
  ): Promise<Doctor> {
    await this.requireDoctor(organizationId, id)

    if (dto.hospitalId) {
      await this.hospitalsService.getById(organizationId, dto.hospitalId)
    }
    if (dto.departmentId) {
      const department = await this.departmentsService.getById(organizationId, dto.departmentId)
      const targetHospitalId = dto.hospitalId
      if (targetHospitalId && department.hospitalId !== targetHospitalId) {
        throw new ConflictException('The selected department does not belong to the selected hospital')
      }
    }

    if (dto.registrationNumber) {
      const conflict = await this.prisma.doctor.findUnique({
        where: {
          registrationNumber_organizationId: { registrationNumber: dto.registrationNumber, organizationId },
        },
      })
      if (conflict && conflict.id !== id) {
        throw new ConflictException('A doctor with this registration number already exists')
      }
    }

    const doctor = await this.prisma.doctor.update({
      where: { id },
      data: {
        ...dto,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
      },
      include: DOCTOR_INCLUDE,
    })

    this.eventEmitter.emit('doctor.updated', { doctorId: id, organizationId, userId: actorUserId })

    return this.toResponse(doctor)
  }

  async deactivate(organizationId: string, id: string, actorUserId?: string): Promise<Doctor> {
    await this.requireDoctor(organizationId, id)

    const doctor = await this.prisma.doctor.update({
      where: { id },
      data: { isActive: false },
      include: DOCTOR_INCLUDE,
    })

    this.eventEmitter.emit('doctor.deactivated', { doctorId: id, organizationId, userId: actorUserId })

    return this.toResponse(doctor)
  }

  async restore(organizationId: string, id: string, actorUserId?: string): Promise<Doctor> {
    await this.requireDoctor(organizationId, id)

    const doctor = await this.prisma.doctor.update({
      where: { id },
      data: { isActive: true },
      include: DOCTOR_INCLUDE,
    })

    this.eventEmitter.emit('doctor.restored', { doctorId: id, organizationId, userId: actorUserId })

    return this.toResponse(doctor)
  }

  async getDashboardStats(organizationId: string): Promise<DoctorDashboardStats> {
    const [totalDoctors, activeDoctors, availability] = await Promise.all([
      this.prisma.doctor.count({ where: { organizationId } }),
      this.prisma.doctor.count({ where: { organizationId, isActive: true } }),
      this.availabilityService.getDashboardStats(organizationId),
    ])

    return { totalDoctors, activeDoctors, ...availability }
  }

  private async requireDoctor(organizationId: string, id: string): Promise<DoctorWithRelations> {
    const doctor = await this.prisma.doctor.findFirst({
      where: { id, organizationId },
      include: DOCTOR_INCLUDE,
    })
    if (!doctor) throw new NotFoundException('Doctor not found')
    return doctor
  }

  private async getSummaryCounts(organizationId: string, doctorId: string): Promise<DoctorSummaryCounts> {
    const [appointments, prescriptions, labTests, radiologyOrders, distinctPatients] = await Promise.all([
      this.prisma.appointment.count({ where: { doctorId, organizationId } }),
      this.prisma.prescription.count({ where: { doctorId, organizationId } }),
      this.prisma.labTest.count({ where: { doctorId, organizationId } }),
      this.prisma.radiologyOrder.count({ where: { doctorId, organizationId } }),
      this.prisma.appointment.findMany({
        where: { doctorId, organizationId },
        distinct: ['patientId'],
        select: { patientId: true },
      }),
    ])

    return {
      appointments,
      patients: distinctPatients.length,
      prescriptions,
      labTests,
      radiologyOrders,
    }
  }

  // Prisma's generated DoctorAvailabilityStatus enum and @medicore/types' are
  // the same string values by construction (types/enums.ts mirrors
  // schema.prisma) but are nominally distinct TS types, hence the cast.
  private toResponse(doctor: DoctorWithRelations): Doctor {
    return {
      id: doctor.id,
      userId: doctor.userId,
      firstName: doctor.user.firstName,
      lastName: doctor.user.lastName,
      fullName: `${doctor.user.firstName} ${doctor.user.lastName}`,
      email: doctor.user.email,
      phone: doctor.user.phone,
      registrationNumber: doctor.registrationNumber,
      specialization: doctor.specialization,
      subSpecialization: doctor.subSpecialization,
      qualification: doctor.qualification,
      experienceYears: doctor.experienceYears,
      languagesSpoken: doctor.languagesSpoken,
      bio: doctor.bio,
      consultationFee: Number(doctor.consultationFee),
      availabilityStatus: doctor.availabilityStatus as unknown as Doctor['availabilityStatus'],
      joiningDate: doctor.joiningDate,
      hospitalId: doctor.hospitalId,
      hospital: doctor.hospital,
      departmentId: doctor.departmentId,
      department: doctor.department,
      organizationId: doctor.organizationId,
      isActive: doctor.isActive,
      createdAt: doctor.createdAt,
      updatedAt: doctor.updatedAt,
    }
  }
}
