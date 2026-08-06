import {
  CreateRadiologyOrderDto,
  CreateRadiologyReportDto,
  JwtPayload,
  Priority,
  RadiologyAttachment,
  RadiologyAttachmentType,
  RadiologyOrder,
  RadiologyOrderQuery,
  RadiologyOrderWithDetails,
  RadiologyReport,
  RadiologyStatus,
  ScheduleRadiologyOrderDto,
  UpdateRadiologyOrderDto,
  UpdateRadiologyStatusDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Prisma,
  Priority as PrismaPriority,
  RadiologyAttachment as PrismaRadiologyAttachment,
  RadiologyAttachmentType as PrismaRadiologyAttachmentType,
  RadiologyOrder as PrismaRadiologyOrder,
  RadiologyReport as PrismaRadiologyReport,
  RadiologyStatus as PrismaRadiologyStatus,
} from '@prisma/client'
import { nanoid } from 'nanoid'

import { PermissionsService } from '../../common/permissions/permissions.service'
import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { EncountersService } from '../medical-records/encounters.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { RadiologyCatalogService } from './radiology-catalog.service'
import { generateRadiologyReportPdf } from './radiology-report-pdf'

export interface UploadedRadiologyFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const ALLOWED_REPORT_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024

/**
 * `ORDERED` can move to `SCHEDULED` (normal path), `REJECTED` (invalid/
 * declined order - never scheduled), or `CANCELLED`. `COMPLETED -> REPORTED`
 * is reachable only through the dedicated `releaseReport` action (requires
 * verification first) - never through this generic map - the same
 * "dedicated action for anything with side effects, generic PATCH only for
 * side-effect-free terminal transitions" idiom `LabTestsService` uses.
 */
const ALLOWED_TRANSITIONS: Record<RadiologyStatus, RadiologyStatus[]> = {
  [RadiologyStatus.ORDERED]: [RadiologyStatus.SCHEDULED, RadiologyStatus.REJECTED, RadiologyStatus.CANCELLED],
  [RadiologyStatus.SCHEDULED]: [RadiologyStatus.IN_PROGRESS, RadiologyStatus.CANCELLED],
  [RadiologyStatus.IN_PROGRESS]: [RadiologyStatus.COMPLETED, RadiologyStatus.CANCELLED],
  [RadiologyStatus.COMPLETED]: [RadiologyStatus.REPORTED],
  [RadiologyStatus.REPORTED]: [],
  [RadiologyStatus.CANCELLED]: [],
  [RadiologyStatus.REJECTED]: [],
}

type RadiologyOrderWithRelations = PrismaRadiologyOrder & {
  patient: { id: string; firstName: string; lastName: string; uhid: string }
  doctor: { id: string; specialization: string; user: { firstName: string; lastName: string } }
  reports: PrismaRadiologyReport[]
  attachments: PrismaRadiologyAttachment[]
}

const RADIOLOGY_ORDER_WITH_RELATIONS_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  doctor: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
  reports: { orderBy: { version: 'desc' } },
  attachments: { orderBy: { uploadedAt: 'desc' } },
} satisfies Prisma.RadiologyOrderInclude

@Injectable()
export class RadiologyOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly catalogService: RadiologyCatalogService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: RadiologyOrderQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.RadiologyOrderWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.doctorId) where.doctorId = query.doctorId
    if (query.encounterId) where.encounterId = query.encounterId
    if (query.status) where.status = query.status as unknown as PrismaRadiologyStatus
    if (query.priority) where.priority = query.priority as unknown as PrismaPriority
    if (query.modality) where.modality = query.modality

    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const [data, total] = await Promise.all([
      this.prisma.radiologyOrder.findMany({
        where,
        include: RADIOLOGY_ORDER_WITH_RELATIONS_INCLUDE,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.radiologyOrder.count({ where }),
    ])

    return {
      data: await Promise.all(data.map((o) => this.toResponse(o))),
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

  async getById(organizationId: string, id: string): Promise<RadiologyOrderWithDetails> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    return this.toResponse(order)
  }

  /**
   * Dashboard summary - see `RadiologyController`. `pendingReporting` is
   * `COMPLETED` (imaging done, no report released yet); `completedStudies`
   * counts both `COMPLETED` and `REPORTED` (the imaging itself is done
   * either way). `urgent` excludes terminal/reported states - it means
   * "still needs attention," not "was ever urgent."
   */
  async getDashboardStats(organizationId: string) {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTomorrow = new Date(startOfToday)
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)

    const [todaysStudies, pendingReporting, completedStudies, cancelled, urgent] = await Promise.all([
      this.prisma.radiologyOrder.count({
        where: { organizationId, scheduledAt: { gte: startOfToday, lt: startOfTomorrow } },
      }),
      this.prisma.radiologyOrder.count({ where: { organizationId, status: PrismaRadiologyStatus.COMPLETED } }),
      this.prisma.radiologyOrder.count({
        where: { organizationId, status: { in: [PrismaRadiologyStatus.COMPLETED, PrismaRadiologyStatus.REPORTED] } },
      }),
      this.prisma.radiologyOrder.count({ where: { organizationId, status: PrismaRadiologyStatus.CANCELLED } }),
      this.prisma.radiologyOrder.count({
        where: {
          organizationId,
          priority: { in: [PrismaPriority.URGENT, PrismaPriority.STAT] },
          status: { notIn: [PrismaRadiologyStatus.CANCELLED, PrismaRadiologyStatus.REJECTED, PrismaRadiologyStatus.REPORTED] },
        },
      }),
    ])

    return { todaysStudies, pendingReporting, completedStudies, cancelled, urgent }
  }

  async create(organizationId: string, dto: CreateRadiologyOrderDto, actorUserId?: string): Promise<RadiologyOrder> {
    const encounter = await this.encountersService.requireEncounter(organizationId, dto.encounterId)

    let modality = dto.modality
    let bodyPart = dto.bodyPart
    if (dto.catalogItemId) {
      const catalogItem = await this.catalogService.requireCatalogItem(organizationId, dto.catalogItemId)
      modality = catalogItem.modality
      bodyPart = catalogItem.bodyPart
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const order = await this.prisma.$transaction(async (tx) => {
      const orderNumber = await this.generateOrderNumber(tx, organizationId, prefix)
      return tx.radiologyOrder.create({
        data: {
          orderNumber,
          patientId: encounter.patientId,
          doctorId: encounter.doctorId,
          encounterId: dto.encounterId,
          catalogItemId: dto.catalogItemId,
          organizationId,
          modality: modality!,
          bodyPart: bodyPart!,
          clinicalIndication: dto.clinicalIndication,
          priority: dto.priority as unknown as PrismaPriority,
        },
      })
    })

    this.eventEmitter.emit('radiology_order.ordered', {
      radiologyOrderId: order.id,
      doctorId: encounter.doctorId,
      patientId: encounter.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toPlainResponse(order)
  }

  async update(organizationId: string, id: string, dto: UpdateRadiologyOrderDto): Promise<RadiologyOrder> {
    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    if (currentStatus !== RadiologyStatus.ORDERED && currentStatus !== RadiologyStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot edit an order once it is ${currentStatus}`)
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: {
        clinicalIndication: dto.clinicalIndication,
        priority: dto.priority as unknown as PrismaPriority | undefined,
      },
    })
    return this.toPlainResponse(updated)
  }

  /**
   * Scheduling - appointment date/time, room, machine, technician,
   * radiologist, duration (roadmap's dedicated "Scheduling" deliverable).
   * Callable while `ORDERED` (first schedule) or already `SCHEDULED`
   * (reschedule) - both land on `SCHEDULED`.
   */
  async schedule(
    organizationId: string,
    id: string,
    dto: ScheduleRadiologyOrderDto,
    actorUserId?: string,
  ): Promise<RadiologyOrder> {
    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    if (currentStatus !== RadiologyStatus.ORDERED && currentStatus !== RadiologyStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot schedule an order that is ${currentStatus}`)
    }

    if (dto.radiologistDoctorId) await this.doctorRef.requireDoctor(organizationId, dto.radiologistDoctorId)

    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: {
        status: PrismaRadiologyStatus.SCHEDULED,
        scheduledAt: dto.scheduledAt,
        room: dto.room,
        machine: dto.machine,
        technicianUserId: dto.technicianUserId,
        radiologistDoctorId: dto.radiologistDoctorId,
        durationMinutes: dto.durationMinutes,
      },
    })

    if (currentStatus !== RadiologyStatus.SCHEDULED) {
      this.emitStatusChanged(updated, currentStatus, RadiologyStatus.SCHEDULED, actorUserId)
    }
    return this.toPlainResponse(updated)
  }

  async startStudy(organizationId: string, id: string, actorUserId?: string): Promise<RadiologyOrder> {
    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    this.assertTransition(currentStatus, RadiologyStatus.IN_PROGRESS)

    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: { status: PrismaRadiologyStatus.IN_PROGRESS },
    })
    this.emitStatusChanged(updated, currentStatus, RadiologyStatus.IN_PROGRESS, actorUserId)
    return this.toPlainResponse(updated)
  }

  async completeStudy(organizationId: string, id: string, actorUserId?: string): Promise<RadiologyOrder> {
    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    this.assertTransition(currentStatus, RadiologyStatus.COMPLETED)

    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: { status: PrismaRadiologyStatus.COMPLETED },
    })
    this.emitStatusChanged(updated, currentStatus, RadiologyStatus.COMPLETED, actorUserId)
    return this.toPlainResponse(updated)
  }

  /**
   * Appends a new versioned report (append-only, mirrors `ClinicalNote` -
   * ADR-0008/ADR-0013) and denormalizes its content onto the order for cheap
   * reads. Only while `COMPLETED` - imaging must be done first, and once
   * `REPORTED` the report is locked (no amendment path in this milestone;
   * see TECH_DEBT).
   */
  async addReportVersion(
    organizationId: string,
    id: string,
    dto: CreateRadiologyReportDto,
    actorUserId?: string,
  ): Promise<RadiologyOrderWithDetails> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    if (currentStatus !== RadiologyStatus.COMPLETED) {
      throw new BadRequestException(
        `Cannot author a report while the order is ${currentStatus} - complete the study first`,
      )
    }

    const nextVersion = (order.reports[0]?.version ?? 0) + 1

    await this.prisma.$transaction([
      this.prisma.radiologyReport.create({
        data: {
          radiologyOrderId: id,
          version: nextVersion,
          clinicalIndication: dto.clinicalIndication,
          technique: dto.technique,
          findings: dto.findings,
          impression: dto.impression,
          recommendations: dto.recommendations,
          createdByUserId: actorUserId,
        },
      }),
      this.prisma.radiologyOrder.update({
        where: { id },
        data: {
          clinicalIndication: dto.clinicalIndication ?? order.clinicalIndication,
          technique: dto.technique,
          findings: dto.findings,
          impression: dto.impression,
          recommendations: dto.recommendations,
          // A new version invalidates any prior verification.
          verifiedByUserId: null,
          verifiedAt: null,
        },
      }),
    ])

    this.eventEmitter.emit('radiology_order.report_drafted', {
      radiologyOrderId: id,
      doctorId: order.doctorId,
      patientId: order.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.getById(organizationId, id)
  }

  /** Radiologist confirms the current (latest) report version is correct. */
  async verifyReport(organizationId: string, id: string, actorUserId?: string): Promise<RadiologyOrder> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    if (currentStatus !== RadiologyStatus.COMPLETED) {
      throw new BadRequestException(`Cannot verify a report while the order is ${currentStatus}`)
    }
    if (order.reports.length === 0) {
      throw new BadRequestException('No report has been authored yet - add a report first')
    }

    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: { verifiedByUserId: actorUserId, verifiedAt: new Date() },
    })
    return this.toPlainResponse(updated)
  }

  /** Releases the verified report, moving the order to `REPORTED`. */
  async releaseReport(organizationId: string, id: string, actorUserId?: string): Promise<RadiologyOrder> {
    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    this.assertTransition(currentStatus, RadiologyStatus.REPORTED)
    if (!order.verifiedAt) {
      throw new BadRequestException('Verify the report before releasing it')
    }

    const now = new Date()
    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: {
        status: PrismaRadiologyStatus.REPORTED,
        reportedBy: actorUserId,
        reportedAt: now,
        releasedByUserId: actorUserId,
        releasedAt: now,
      },
    })

    this.emitStatusChanged(updated, currentStatus, RadiologyStatus.REPORTED, actorUserId)
    return this.toPlainResponse(updated)
  }

  /**
   * External report file upload (e.g. a scanned report from an outside
   * imaging center) - distinct from `generateReportPdf`'s structured,
   * system-generated PDF. Requires the study to be `COMPLETED`; marks the
   * order `REPORTED` directly (an external file stands in for the
   * verify/release flow, since there's no in-system text to verify).
   */
  async uploadReportFile(
    organizationId: string,
    id: string,
    file: UploadedRadiologyFileInput,
    actorUserId?: string,
  ): Promise<RadiologyOrder> {
    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    if (currentStatus !== RadiologyStatus.COMPLETED) {
      throw new BadRequestException(`Cannot upload a report while the order is ${currentStatus}`)
    }
    if (!ALLOWED_REPORT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type - allowed: PDF, PNG, JPEG, WEBP')
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 20MB upload limit')
    }

    const key = `radiology-reports/${organizationId}/${id}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const now = new Date()
    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: {
        status: PrismaRadiologyStatus.REPORTED,
        reportFileUrl: fileUrl,
        reportedBy: actorUserId,
        reportedAt: now,
        releasedByUserId: actorUserId,
        releasedAt: now,
      },
    })

    this.emitStatusChanged(updated, currentStatus, RadiologyStatus.REPORTED, actorUserId)
    return this.toPlainResponse(updated)
  }

  /** Structured, system-generated PDF built from the order's current report fields. */
  async generateReportPdf(organizationId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const order = await this.requireOrderWithRelations(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    if (
      currentStatus === RadiologyStatus.ORDERED ||
      currentStatus === RadiologyStatus.SCHEDULED ||
      currentStatus === RadiologyStatus.IN_PROGRESS
    ) {
      throw new BadRequestException('A report is not yet available for this order')
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: order.patientId } })
    const radiologist = order.radiologistDoctorId
      ? await this.prisma.doctor.findUnique({
          where: { id: order.radiologistDoctorId },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
      : null

    const buffer = await generateRadiologyReportPdf({
      orderNumber: order.orderNumber,
      modality: order.modality,
      bodyPart: order.bodyPart,
      priority: order.priority,
      reportedAt: order.reportedAt,
      organization: { name: org.name, address: org.address, phone: org.phone, email: org.email },
      doctor: {
        fullName: `${order.doctor.user.firstName} ${order.doctor.user.lastName}`,
        specialization: order.doctor.specialization,
      },
      radiologist: radiologist
        ? { fullName: `${radiologist.user.firstName} ${radiologist.user.lastName}`, specialization: radiologist.specialization }
        : null,
      patient: {
        fullName: `${order.patient.firstName} ${order.patient.lastName}`,
        uhid: order.patient.uhid,
        age: computeAge(patient.dateOfBirth),
        gender: patient.gender,
      },
      clinicalIndication: order.clinicalIndication,
      technique: order.technique,
      findings: order.findings,
      impression: order.impression,
      recommendations: order.recommendations,
    })

    return { buffer, fileName: `${order.orderNumber}.pdf` }
  }

  /** Generic status route - only for the side-effect-free terminal transitions (CANCELLED/REJECTED). */
  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateRadiologyStatusDto,
    actorUserId?: string,
  ): Promise<RadiologyOrder> {
    if (dto.status !== RadiologyStatus.CANCELLED && dto.status !== RadiologyStatus.REJECTED) {
      throw new BadRequestException(
        'Use the dedicated scheduling, study, or report actions for this transition',
      )
    }

    const order = await this.requireOrder(organizationId, id)
    const currentStatus = order.status as unknown as RadiologyStatus
    this.assertTransition(currentStatus, dto.status)

    const updated = await this.prisma.radiologyOrder.update({
      where: { id },
      data: { status: dto.status as unknown as PrismaRadiologyStatus },
    })

    this.emitStatusChanged(updated, currentStatus, dto.status, actorUserId, dto.reason)
    return this.toPlainResponse(updated)
  }

  // ─── Attachments ──────────────────────────────────────────────────────────

  async listAttachments(organizationId: string, id: string): Promise<RadiologyAttachment[]> {
    await this.requireOrder(organizationId, id)
    const attachments = await this.prisma.radiologyAttachment.findMany({
      where: { radiologyOrderId: id },
      orderBy: { uploadedAt: 'desc' },
    })
    return attachments.map((a) => this.toAttachmentResponse(a))
  }

  /** `IMAGE`/`PDF` attachments - a real uploaded file via `StorageService`. */
  async addFileAttachment(
    organizationId: string,
    id: string,
    type: RadiologyAttachmentType.IMAGE | RadiologyAttachmentType.PDF,
    file: UploadedRadiologyFileInput,
    actorUserId?: string,
  ): Promise<RadiologyAttachment> {
    await this.requireOrder(organizationId, id)

    const allowed = type === RadiologyAttachmentType.IMAGE ? ALLOWED_IMAGE_MIME_TYPES : new Set(['application/pdf'])
    if (!allowed.has(file.mimeType)) {
      throw new BadRequestException(
        type === RadiologyAttachmentType.IMAGE ? 'Unsupported file type - allowed: PNG, JPEG, WEBP' : 'Only PDF files are accepted',
      )
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 20MB upload limit')
    }

    const key = `radiology-attachments/${organizationId}/${id}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const attachment = await this.prisma.radiologyAttachment.create({
      data: {
        radiologyOrderId: id,
        organizationId,
        type: type as unknown as PrismaRadiologyAttachmentType,
        fileName: file.fileName,
        fileUrl,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
        uploadedByUserId: actorUserId,
      },
    })
    return this.toAttachmentResponse(attachment)
  }

  /**
   * `EXTERNAL_IMAGING`/`DICOM_PLACEHOLDER` attachments - metadata-only,
   * referencing a study held in an outside PACS. No real DICOM parsing or
   * PACS connectivity exists (see TECH_DEBT) - this just records a pointer
   * (accession number / external URL / study instance UID) so the order's
   * timeline reflects that imaging exists elsewhere.
   */
  async addExternalAttachment(
    organizationId: string,
    id: string,
    type: RadiologyAttachmentType.EXTERNAL_IMAGING | RadiologyAttachmentType.DICOM_PLACEHOLDER,
    metadata: Record<string, unknown>,
    actorUserId?: string,
  ): Promise<RadiologyAttachment> {
    await this.requireOrder(organizationId, id)

    const attachment = await this.prisma.radiologyAttachment.create({
      data: {
        radiologyOrderId: id,
        organizationId,
        type: type as unknown as PrismaRadiologyAttachmentType,
        metadata: metadata as Prisma.InputJsonValue,
        uploadedByUserId: actorUserId,
      },
    })
    return this.toAttachmentResponse(attachment)
  }

  async deleteAttachment(organizationId: string, id: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.radiologyAttachment.findFirst({
      where: { id: attachmentId, radiologyOrderId: id, organizationId },
    })
    if (!attachment) throw new NotFoundException('Attachment not found')

    if (attachment.fileUrl) {
      const key = this.extractStorageKey(attachment.fileUrl)
      if (key) await this.storageService.delete(key).catch(() => undefined)
    }
    await this.prisma.radiologyAttachment.delete({ where: { id: attachmentId } })
  }

  private extractStorageKey(fileUrl: string): string | null {
    const marker = '/uploads/'
    const idx = fileUrl.indexOf(marker)
    return idx === -1 ? null : fileUrl.slice(idx + marker.length)
  }

  // ─── Shared helpers ───────────────────────────────────────────────────────

  /**
   * `radiology.*` can be held at `.own` scope (a doctor managing only
   * studies they ordered) - same idiom as `LabTestsService.assertOwnScopeOk`.
   * See ADR-0013.
   */
  async assertOwnScopeOk(organizationId: string, id: string, user: JwtPayload, action: string): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'radiology', action)
    if (scope !== 'own') return

    const order = await this.requireOrder(organizationId, id)
    const ownProfile = await this.doctorRef.findDoctorProfileForUser(organizationId, user.sub)
    if (!ownProfile || ownProfile.id !== order.doctorId) {
      throw new ForbiddenException('You can only access your own radiology orders')
    }
  }

  async requireOrder(organizationId: string, id: string): Promise<PrismaRadiologyOrder> {
    const order = await this.prisma.radiologyOrder.findFirst({ where: { id, organizationId } })
    if (!order) throw new NotFoundException('Radiology order not found')
    return order
  }

  private async requireOrderWithRelations(organizationId: string, id: string): Promise<RadiologyOrderWithRelations> {
    const order = await this.prisma.radiologyOrder.findFirst({
      where: { id, organizationId },
      include: RADIOLOGY_ORDER_WITH_RELATIONS_INCLUDE,
    })
    if (!order) throw new NotFoundException('Radiology order not found')
    return order as RadiologyOrderWithRelations
  }

  private assertTransition(current: RadiologyStatus, next: RadiologyStatus): void {
    if (current === next) throw new ConflictException(`Radiology order is already ${next}`)
    const allowed = ALLOWED_TRANSITIONS[current] ?? []
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Cannot transition a radiology order from ${current} to ${next}`)
    }
  }

  private emitStatusChanged(
    order: PrismaRadiologyOrder,
    fromStatus: RadiologyStatus,
    toStatus: RadiologyStatus,
    actorUserId?: string,
    reason?: string,
  ): void {
    this.eventEmitter.emit('radiology_order.status_changed', {
      radiologyOrderId: order.id,
      doctorId: order.doctorId,
      patientId: order.patientId,
      organizationId: order.organizationId,
      userId: actorUserId,
      fromStatus,
      toStatus,
      reason,
    })
  }

  private async generateOrderNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':radiology_order')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.radiologyOrder.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `RAD-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private async toResponse(order: RadiologyOrderWithRelations): Promise<RadiologyOrderWithDetails> {
    const radiologist = order.radiologistDoctorId
      ? await this.prisma.doctor.findUnique({
          where: { id: order.radiologistDoctorId },
          include: { user: { select: { firstName: true, lastName: true } } },
        })
      : null

    return {
      ...this.toPlainResponse(order),
      patient: {
        id: order.patient.id,
        fullName: `${order.patient.firstName} ${order.patient.lastName}`,
        uhid: order.patient.uhid,
      },
      doctor: {
        id: order.doctor.id,
        fullName: `${order.doctor.user.firstName} ${order.doctor.user.lastName}`,
        specialization: order.doctor.specialization,
      },
      radiologist: radiologist
        ? {
            id: radiologist.id,
            fullName: `${radiologist.user.firstName} ${radiologist.user.lastName}`,
            specialization: radiologist.specialization,
          }
        : null,
      reports: order.reports.map((r) => this.toReportResponse(r)),
      attachments: order.attachments.map((a) => this.toAttachmentResponse(a)),
    }
  }

  private toReportResponse(report: PrismaRadiologyReport): RadiologyReport {
    return {
      id: report.id,
      radiologyOrderId: report.radiologyOrderId,
      version: report.version,
      clinicalIndication: report.clinicalIndication,
      technique: report.technique,
      findings: report.findings,
      impression: report.impression,
      recommendations: report.recommendations,
      createdByUserId: report.createdByUserId,
      createdAt: report.createdAt,
    }
  }

  private toAttachmentResponse(attachment: PrismaRadiologyAttachment): RadiologyAttachment {
    return {
      id: attachment.id,
      radiologyOrderId: attachment.radiologyOrderId,
      organizationId: attachment.organizationId,
      type: attachment.type as unknown as RadiologyAttachmentType,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      mimeType: attachment.mimeType,
      fileSizeBytes: attachment.fileSizeBytes,
      metadata: attachment.metadata as Record<string, unknown> | null,
      uploadedByUserId: attachment.uploadedByUserId,
      uploadedAt: attachment.uploadedAt,
    }
  }

  private toPlainResponse(order: PrismaRadiologyOrder): RadiologyOrder {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      patientId: order.patientId,
      doctorId: order.doctorId,
      encounterId: order.encounterId,
      catalogItemId: order.catalogItemId,
      organizationId: order.organizationId,
      modality: order.modality,
      bodyPart: order.bodyPart,
      clinicalIndication: order.clinicalIndication,
      status: order.status as unknown as RadiologyStatus,
      priority: order.priority as unknown as Priority,
      scheduledAt: order.scheduledAt,
      room: order.room,
      machine: order.machine,
      technicianUserId: order.technicianUserId,
      radiologistDoctorId: order.radiologistDoctorId,
      durationMinutes: order.durationMinutes,
      technique: order.technique,
      findings: order.findings,
      impression: order.impression,
      recommendations: order.recommendations,
      reportFileUrl: order.reportFileUrl,
      reportedBy: order.reportedBy,
      reportedAt: order.reportedAt,
      verifiedByUserId: order.verifiedByUserId,
      verifiedAt: order.verifiedAt,
      releasedByUserId: order.releasedByUserId,
      releasedAt: order.releasedAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    }
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

function computeAge(dateOfBirth: Date): number {
  const diffMs = Date.now() - dateOfBirth.getTime()
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
}
