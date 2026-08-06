import {
  CreateNursingTaskDto,
  NursingTask,
  NursingTaskPriority,
  NursingTaskQuery,
  NursingTaskStatus,
  NursingTaskWithDetails,
  UpdateNursingTaskStatusDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NursingTask as PrismaNursingTask, Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { AdmissionsService } from './admissions.service'

const TASK_WITH_ADMISSION_INCLUDE = {
  admission: {
    select: {
      id: true,
      admissionNumber: true,
      patientId: true,
      patient: { select: { firstName: true, lastName: true } },
      ward: { select: { name: true } },
    },
  },
} satisfies Prisma.NursingTaskInclude

type TaskWithAdmission = PrismaNursingTask & {
  admission: {
    id: string
    admissionNumber: string
    patientId: string
    patient: { firstName: string; lastName: string }
    ward: { name: string }
  }
}

/** Nursing to-do items - standalone or spawned from an `IpdOrder`. Backs the org-wide queue and per-admission list. */
@Injectable()
export class NursingTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admissionsService: AdmissionsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listForAdmission(organizationId: string, admissionId: string, query: NursingTaskQuery) {
    await this.admissionsService.requireAdmission(organizationId, admissionId)
    return this.list(organizationId, { ...query, admissionId })
  }

  async list(organizationId: string, query: NursingTaskQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.NursingTaskWhereInput = { organizationId }
    if (query.admissionId) where.admissionId = query.admissionId
    if (query.status) where.status = query.status as unknown as Prisma.NursingTaskWhereInput['status']
    if (query.priority) where.priority = query.priority as unknown as Prisma.NursingTaskWhereInput['priority']
    if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId

    const [data, total] = await Promise.all([
      this.prisma.nursingTask.findMany({
        where,
        include: TASK_WITH_ADMISSION_INCLUDE,
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.nursingTask.count({ where }),
    ])

    return {
      data: (data as TaskWithAdmission[]).map((t) => this.toResponse(t)),
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

  async create(
    organizationId: string,
    admissionId: string,
    dto: CreateNursingTaskDto,
    actorUserId: string,
  ): Promise<NursingTask> {
    const admission = await this.admissionsService.requireAdmission(organizationId, admissionId)

    if (dto.sourceOrderId) {
      const order = await this.prisma.ipdOrder.findFirst({
        where: { id: dto.sourceOrderId, admissionId, organizationId },
      })
      if (!order) throw new NotFoundException('Source IPD order not found')
    }

    const task = await this.prisma.nursingTask.create({
      data: {
        admissionId,
        organizationId,
        sourceOrderId: dto.sourceOrderId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority as unknown as Prisma.NursingTaskCreateInput['priority'],
        dueAt: dto.dueAt,
        assignedToUserId: dto.assignedToUserId,
        createdByUserId: actorUserId,
      },
    })

    this.eventEmitter.emit('ipd.nursing_task_created', {
      nursingTaskId: task.id,
      admissionId,
      patientId: admission.patientId,
      organizationId,
      userId: actorUserId,
      priority: task.priority,
    })

    return this.toPlainResponse(task)
  }

  async updateStatus(
    organizationId: string,
    taskId: string,
    dto: UpdateNursingTaskStatusDto,
    actorUserId: string,
  ): Promise<NursingTask> {
    const task = await this.requireTask(organizationId, taskId)
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
      throw new ConflictException(`Task is already ${task.status.toLowerCase()}`)
    }

    const isCompleting = dto.status === NursingTaskStatus.COMPLETED

    const updated = await this.prisma.nursingTask.update({
      where: { id: taskId },
      data: {
        status: dto.status as unknown as Prisma.NursingTaskUpdateInput['status'],
        completionNotes: dto.completionNotes,
        completedByUserId: isCompleting ? actorUserId : undefined,
        completedAt: isCompleting ? new Date() : undefined,
      },
    })

    this.eventEmitter.emit('ipd.nursing_task_status_changed', {
      nursingTaskId: task.id,
      admissionId: task.admissionId,
      organizationId,
      userId: actorUserId,
      fromStatus: task.status,
      toStatus: dto.status,
    })

    return this.toPlainResponse(updated)
  }

  private async requireTask(organizationId: string, taskId: string): Promise<PrismaNursingTask> {
    const task = await this.prisma.nursingTask.findFirst({ where: { id: taskId, organizationId } })
    if (!task) throw new NotFoundException('Nursing task not found')
    return task
  }

  private toPlainResponse(task: PrismaNursingTask): NursingTask {
    return {
      id: task.id,
      admissionId: task.admissionId,
      organizationId: task.organizationId,
      sourceOrderId: task.sourceOrderId,
      title: task.title,
      description: task.description,
      priority: task.priority as unknown as NursingTaskPriority,
      dueAt: task.dueAt,
      status: task.status as unknown as NursingTaskStatus,
      assignedToUserId: task.assignedToUserId,
      completedByUserId: task.completedByUserId,
      completedAt: task.completedAt,
      completionNotes: task.completionNotes,
      createdByUserId: task.createdByUserId,
      createdAt: task.createdAt,
    }
  }

  private toResponse(task: TaskWithAdmission): NursingTaskWithDetails {
    return {
      ...this.toPlainResponse(task),
      admission: {
        id: task.admission.id,
        admissionNumber: task.admission.admissionNumber,
        patientId: task.admission.patientId,
        patientName: `${task.admission.patient.firstName} ${task.admission.patient.lastName}`,
        wardName: task.admission.ward.name,
      },
    }
  }
}
