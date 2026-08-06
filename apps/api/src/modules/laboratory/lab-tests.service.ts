import {
  CreateLabOrderDto,
  CreateLabOrderItemDto,
  EnterLabResultsDto,
  JwtPayload,
  LabTest,
  LabTestItem,
  LabTestQuery,
  LabTestStatus,
  LabTestWithItems,
  Priority,
  RecordSampleCollectionDto,
  UpdateLabTestStatusDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  AbnormalType as PrismaAbnormalType,
  LabTest as PrismaLabTest,
  LabTestItem as PrismaLabTestItem,
  LabTestStatus as PrismaLabTestStatus,
  Priority as PrismaPriority,
  Prisma,
} from '@prisma/client'

import { PermissionsService } from '../../common/permissions/permissions.service'
import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { EncountersService } from '../medical-records/encounters.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { computeAbnormalFlag } from './abnormal-flagging'
import { LabCatalogService } from './lab-catalog.service'
import { generateLabReportPdf } from './lab-report-pdf'

export interface UploadedReportFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_REPORT_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
const MAX_REPORT_SIZE_BYTES = 10 * 1024 * 1024

/**
 * `ORDERED` is the only entry state. Sample collection, result entry, and
 * report upload are each dedicated actions (not this generic map) because
 * they carry required side effects (`sampleCollectedBy/At`, per-item
 * results, `reportFileUrl`/`reportedAt`) beyond a bare status flip - this
 * map is consulted by those actions internally, and is exposed directly on
 * the generic `PATCH .../status` route only for `CANCELLED`, which has no
 * side effects of its own and is reachable from any non-terminal state.
 */
const ALLOWED_TRANSITIONS: Record<LabTestStatus, LabTestStatus[]> = {
  [LabTestStatus.ORDERED]: [LabTestStatus.SAMPLE_COLLECTED, LabTestStatus.CANCELLED],
  [LabTestStatus.SAMPLE_COLLECTED]: [LabTestStatus.IN_PROGRESS, LabTestStatus.CANCELLED],
  [LabTestStatus.IN_PROGRESS]: [LabTestStatus.COMPLETED, LabTestStatus.CANCELLED],
  [LabTestStatus.COMPLETED]: [LabTestStatus.REPORTED],
  [LabTestStatus.REPORTED]: [],
  [LabTestStatus.CANCELLED]: [],
}

type LabTestWithRelations = PrismaLabTest & {
  items: PrismaLabTestItem[]
  patient: { id: string; firstName: string; lastName: string; uhid: string }
  doctor: { id: string; specialization: string; user: { firstName: string; lastName: string } }
}

const LAB_TEST_WITH_RELATIONS_INCLUDE = {
  items: true,
  patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
  doctor: { select: { id: true, specialization: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.LabTestInclude

@Injectable()
export class LabTestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encountersService: EncountersService,
    private readonly catalogService: LabCatalogService,
    private readonly doctorRef: DoctorRefService,
    private readonly permissionsService: PermissionsService,
    private readonly storageService: StorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(organizationId: string, query: LabTestQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20

    const where: Prisma.LabTestWhereInput = { organizationId }
    if (query.patientId) where.patientId = query.patientId
    if (query.doctorId) where.doctorId = query.doctorId
    if (query.encounterId) where.encounterId = query.encounterId
    if (query.status) where.status = query.status as unknown as PrismaLabTestStatus
    if (query.priority) where.priority = query.priority as unknown as PrismaPriority

    const [data, total] = await Promise.all([
      this.prisma.labTest.findMany({
        where,
        include: LAB_TEST_WITH_RELATIONS_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.labTest.count({ where }),
    ])

    return {
      data: data.map((t) => this.toResponse(t)),
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

  async getById(organizationId: string, id: string): Promise<LabTestWithItems> {
    const labTest = await this.requireLabTestWithRelations(organizationId, id)
    return this.toResponse(labTest)
  }

  async create(organizationId: string, dto: CreateLabOrderDto, actorUserId?: string): Promise<LabTest> {
    const encounter = await this.encountersService.requireEncounter(organizationId, dto.encounterId)

    const resolvedItems = await Promise.all(
      dto.items.map((item) => this.resolveOrderItem(organizationId, item)),
    )

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const settings = (org.settings ?? {}) as Record<string, unknown>
    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'

    const labTest = await this.prisma.$transaction(async (tx) => {
      const labOrderNumber = await this.generateLabOrderNumber(tx, organizationId, prefix)
      return tx.labTest.create({
        data: {
          labOrderNumber,
          patientId: encounter.patientId,
          doctorId: encounter.doctorId,
          encounterId: dto.encounterId,
          organizationId,
          priority: dto.priority as unknown as PrismaPriority,
          notes: dto.notes,
          items: { create: resolvedItems },
        },
      })
    })

    this.eventEmitter.emit('lab_test.ordered', {
      labTestId: labTest.id,
      doctorId: encounter.doctorId,
      patientId: encounter.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.toPlainResponse(labTest)
  }

  async collectSample(
    organizationId: string,
    id: string,
    _dto: RecordSampleCollectionDto,
    actorUserId?: string,
  ): Promise<LabTest> {
    const labTest = await this.requireLabTest(organizationId, id)
    this.assertTransition(labTest.status as unknown as LabTestStatus, LabTestStatus.SAMPLE_COLLECTED)

    const updated = await this.prisma.labTest.update({
      where: { id },
      data: {
        status: PrismaLabTestStatus.SAMPLE_COLLECTED,
        sampleCollectedBy: actorUserId,
        sampleCollectedAt: new Date(),
      },
    })

    this.emitStatusChanged(updated, labTest.status as unknown as LabTestStatus, LabTestStatus.SAMPLE_COLLECTED, actorUserId)
    return this.toPlainResponse(updated)
  }

  /**
   * Structured, per-item result entry. Only reachable once a sample has
   * been collected. Numeric results are always auto-flagged (ignoring any
   * client-supplied `isAbnormalOverride`); a non-numeric ("qualitative")
   * result is never auto-flagged and instead uses the caller's override -
   * see `abnormal-flagging.ts`. The order transitions to IN_PROGRESS while
   * some items still lack a result, or COMPLETED once every item has one.
   * Once COMPLETED, results can no longer be re-entered here (a corrected
   * report would need a new order) - a deliberate finality guard, not an
   * oversight.
   */
  async enterResults(
    organizationId: string,
    id: string,
    dto: EnterLabResultsDto,
    actorUserId?: string,
  ): Promise<LabTestWithItems> {
    const labTest = await this.requireLabTestWithRelations(organizationId, id)
    const currentStatus = labTest.status as unknown as LabTestStatus
    if (currentStatus !== LabTestStatus.SAMPLE_COLLECTED && currentStatus !== LabTestStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot enter results while the order is ${currentStatus} - collect a sample first`,
      )
    }

    const itemsById = new Map(labTest.items.map((item) => [item.id, item]))
    for (const resultDto of dto.items) {
      if (!itemsById.has(resultDto.itemId)) {
        throw new NotFoundException(`Lab test item ${resultDto.itemId} not found on this order`)
      }
    }

    await this.prisma.$transaction(
      dto.items.map((resultDto) => {
        const item = itemsById.get(resultDto.itemId)!
        const parsed = Number(resultDto.result)
        const isNumeric = resultDto.result.trim() !== '' && Number.isFinite(parsed)
        const flag = computeAbnormalFlag({
          result: resultDto.result,
          referenceRangeLow: item.referenceRangeLow,
          referenceRangeHigh: item.referenceRangeHigh,
          criticalLow: item.criticalLow,
          criticalHigh: item.criticalHigh,
        })

        return this.prisma.labTestItem.update({
          where: { id: resultDto.itemId },
          data: {
            result: resultDto.result,
            interpretation: resultDto.interpretation,
            isAbnormal: isNumeric ? flag.isAbnormal : (resultDto.isAbnormalOverride ?? false),
            abnormalType: isNumeric ? (flag.abnormalType as unknown as PrismaAbnormalType | null) : null,
          },
        })
      }),
    )

    const refreshed = await this.requireLabTestWithRelations(organizationId, id)
    const allResulted = refreshed.items.every((item) => item.result !== null && item.result !== '')
    const nextStatus = allResulted ? LabTestStatus.COMPLETED : LabTestStatus.IN_PROGRESS

    if (nextStatus !== currentStatus) {
      const updated = await this.prisma.labTest.update({
        where: { id },
        data: { status: nextStatus as unknown as PrismaLabTestStatus },
      })
      this.emitStatusChanged(updated, currentStatus, nextStatus, actorUserId)
    }

    this.eventEmitter.emit('lab_test.results_entered', {
      labTestId: id,
      doctorId: labTest.doctorId,
      patientId: labTest.patientId,
      organizationId,
      userId: actorUserId,
    })

    return this.getById(organizationId, id)
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdateLabTestStatusDto,
    actorUserId?: string,
  ): Promise<LabTest> {
    if (dto.status !== LabTestStatus.CANCELLED) {
      throw new BadRequestException(
        'Use the dedicated sample-collection, result-entry, or report actions for this transition',
      )
    }

    const labTest = await this.requireLabTest(organizationId, id)
    const currentStatus = labTest.status as unknown as LabTestStatus
    this.assertTransition(currentStatus, LabTestStatus.CANCELLED)

    const updated = await this.prisma.labTest.update({
      where: { id },
      data: { status: PrismaLabTestStatus.CANCELLED },
    })

    this.emitStatusChanged(updated, currentStatus, LabTestStatus.CANCELLED, actorUserId)
    return this.toPlainResponse(updated)
  }

  /**
   * External report file upload (e.g. a scanned report from an outside
   * lab) - distinct from `generateReportPdf`'s structured, system-generated
   * PDF. Requires results to already be complete (`COMPLETED`); marks the
   * order `REPORTED`.
   */
  async uploadReportFile(
    organizationId: string,
    id: string,
    file: UploadedReportFileInput,
    actorUserId?: string,
  ): Promise<LabTest> {
    const labTest = await this.requireLabTest(organizationId, id)
    const currentStatus = labTest.status as unknown as LabTestStatus
    this.assertTransition(currentStatus, LabTestStatus.REPORTED)

    if (!ALLOWED_REPORT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type - allowed: PDF, PNG, JPEG, WEBP')
    }
    if (file.size > MAX_REPORT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `lab-reports/${organizationId}/${id}/${Date.now()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const updated = await this.prisma.labTest.update({
      where: { id },
      data: { status: PrismaLabTestStatus.REPORTED, reportFileUrl: fileUrl, reportedAt: new Date() },
    })

    this.emitStatusChanged(updated, currentStatus, LabTestStatus.REPORTED, actorUserId)
    return this.toPlainResponse(updated)
  }

  /**
   * Structured, system-generated PDF built from the order's own
   * `LabTestItem` rows - independent of whether an external report file
   * was ever uploaded via `uploadReportFile`.
   */
  async generateReportPdf(organizationId: string, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const labTest = await this.requireLabTestWithRelations(organizationId, id)
    const currentStatus = labTest.status as unknown as LabTestStatus
    if (currentStatus === LabTestStatus.ORDERED || currentStatus === LabTestStatus.SAMPLE_COLLECTED) {
      throw new BadRequestException('Results are not yet available for this order')
    }

    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })
    const patient = await this.prisma.patient.findUniqueOrThrow({ where: { id: labTest.patientId } })

    const buffer = await generateLabReportPdf({
      labOrderNumber: labTest.labOrderNumber,
      reportedAt: labTest.reportedAt,
      priority: labTest.priority,
      organization: { name: org.name, address: org.address, phone: org.phone, email: org.email },
      doctor: {
        fullName: `${labTest.doctor.user.firstName} ${labTest.doctor.user.lastName}`,
        specialization: labTest.doctor.specialization,
      },
      patient: {
        fullName: `${labTest.patient.firstName} ${labTest.patient.lastName}`,
        uhid: labTest.patient.uhid,
        age: computeAge(patient.dateOfBirth),
        gender: patient.gender,
      },
      items: labTest.items.map((item) => ({
        testName: item.testName,
        testCode: item.testCode,
        category: item.category,
        result: item.result,
        unit: item.unit,
        referenceRange: item.referenceRange,
        isAbnormal: item.isAbnormal,
        abnormalType: item.abnormalType,
        interpretation: item.interpretation,
      })),
      notes: labTest.notes,
    })

    return { buffer, fileName: `${labTest.labOrderNumber}.pdf` }
  }

  /**
   * `laboratory.*` can be held at `.own` scope (a doctor managing only lab
   * orders they placed) - same idiom as `PrescriptionsService`/
   * `EncountersService.assertOwnScopeOk`. See ADR-0012 for why this is
   * `.own` for the Doctor role but `.all` for Lab Technician/Nurse (they
   * process/view every order regardless of the ordering doctor).
   */
  async assertOwnScopeOk(organizationId: string, id: string, user: JwtPayload, action: string): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'laboratory', action)
    if (scope !== 'own') return

    const labTest = await this.requireLabTest(organizationId, id)
    const ownProfile = await this.doctorRef.findDoctorProfileForUser(organizationId, user.sub)
    if (!ownProfile || ownProfile.id !== labTest.doctorId) {
      throw new ForbiddenException('You can only access your own lab orders')
    }
  }

  async requireLabTest(organizationId: string, id: string): Promise<PrismaLabTest> {
    const labTest = await this.prisma.labTest.findFirst({ where: { id, organizationId } })
    if (!labTest) throw new NotFoundException('Lab order not found')
    return labTest
  }

  private async requireLabTestWithRelations(organizationId: string, id: string): Promise<LabTestWithRelations> {
    const labTest = await this.prisma.labTest.findFirst({
      where: { id, organizationId },
      include: LAB_TEST_WITH_RELATIONS_INCLUDE,
    })
    if (!labTest) throw new NotFoundException('Lab order not found')
    return labTest as LabTestWithRelations
  }

  private assertTransition(current: LabTestStatus, next: LabTestStatus): void {
    if (current === next) throw new ConflictException(`Lab order is already ${next}`)
    const allowed = ALLOWED_TRANSITIONS[current] ?? []
    if (!allowed.includes(next)) {
      throw new BadRequestException(`Cannot transition a lab order from ${current} to ${next}`)
    }
  }

  private emitStatusChanged(
    labTest: PrismaLabTest,
    fromStatus: LabTestStatus,
    toStatus: LabTestStatus,
    actorUserId?: string,
  ): void {
    this.eventEmitter.emit('lab_test.status_changed', {
      labTestId: labTest.id,
      doctorId: labTest.doctorId,
      patientId: labTest.patientId,
      organizationId: labTest.organizationId,
      userId: actorUserId,
      fromStatus,
      toStatus,
    })
  }

  private async resolveOrderItem(
    organizationId: string,
    item: CreateLabOrderItemDto,
  ): Promise<Prisma.LabTestItemCreateWithoutLabTestInput> {
    if (item.catalogItemId) {
      const catalogItem = await this.catalogService.requireCatalogItem(organizationId, item.catalogItemId)
      return {
        catalogItem: { connect: { id: catalogItem.id } },
        testName: catalogItem.testName,
        testCode: catalogItem.testCode,
        category: catalogItem.category,
        unit: catalogItem.unit,
        referenceRange: catalogItem.referenceRangeText,
        referenceRangeLow: catalogItem.referenceRangeLow,
        referenceRangeHigh: catalogItem.referenceRangeHigh,
        criticalLow: catalogItem.criticalLow,
        criticalHigh: catalogItem.criticalHigh,
      }
    }

    return {
      testName: item.testName!,
      testCode: item.testCode ?? '',
      category: item.category ?? 'General',
      unit: item.unit,
      referenceRange: item.referenceRange,
      referenceRangeLow: item.referenceRangeLow,
      referenceRangeHigh: item.referenceRangeHigh,
      criticalLow: item.criticalLow,
      criticalHigh: item.criticalHigh,
    }
  }

  private async generateLabOrderNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    prefix: string,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId} || ':lab_test')::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const count = await tx.labTest.count({ where: { organizationId, createdAt: { gte: yearStart } } })

    return `LAB-${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private toResponse(labTest: LabTestWithRelations): LabTestWithItems {
    return {
      ...this.toPlainResponse(labTest),
      items: labTest.items.map((item) => this.toItemResponse(item)),
      patient: {
        id: labTest.patient.id,
        fullName: `${labTest.patient.firstName} ${labTest.patient.lastName}`,
        uhid: labTest.patient.uhid,
      },
      doctor: {
        id: labTest.doctor.id,
        fullName: `${labTest.doctor.user.firstName} ${labTest.doctor.user.lastName}`,
        specialization: labTest.doctor.specialization,
      },
    }
  }

  private toItemResponse(item: PrismaLabTestItem): LabTestItem {
    return {
      id: item.id,
      labTestId: item.labTestId,
      catalogItemId: item.catalogItemId,
      testName: item.testName,
      testCode: item.testCode,
      category: item.category,
      result: item.result,
      unit: item.unit,
      referenceRange: item.referenceRange,
      referenceRangeLow: item.referenceRangeLow,
      referenceRangeHigh: item.referenceRangeHigh,
      criticalLow: item.criticalLow,
      criticalHigh: item.criticalHigh,
      isAbnormal: item.isAbnormal,
      abnormalType: item.abnormalType as unknown as LabTestItem['abnormalType'],
      interpretation: item.interpretation,
      createdAt: item.createdAt,
    }
  }

  private toPlainResponse(labTest: PrismaLabTest): LabTest {
    return {
      id: labTest.id,
      labOrderNumber: labTest.labOrderNumber,
      patientId: labTest.patientId,
      doctorId: labTest.doctorId,
      appointmentId: labTest.appointmentId,
      encounterId: labTest.encounterId,
      organizationId: labTest.organizationId,
      status: labTest.status as unknown as LabTestStatus,
      priority: labTest.priority as unknown as Priority,
      sampleCollectedBy: labTest.sampleCollectedBy,
      sampleCollectedAt: labTest.sampleCollectedAt,
      reportedAt: labTest.reportedAt,
      reportFileUrl: labTest.reportFileUrl,
      notes: labTest.notes,
      createdAt: labTest.createdAt,
      updatedAt: labTest.updatedAt,
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
