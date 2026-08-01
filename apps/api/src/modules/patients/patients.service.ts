import {
  BloodGroup,
  CreatePatientDto,
  DuplicateCheckDto,
  DuplicateMatch,
  Gender,
  Patient,
  PatientSearchQuery,
  PatientSummaryCounts,
  PatientTimelineEntry,
  PatientWithSummary,
  UpdatePatientDto,
} from '@medicore/types'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { DocumentType, Gender as PrismaGender, Patient as PrismaPatient, Prisma } from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { OrganizationsService } from '../organizations/organizations.service'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly organizationsService: OrganizationsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async list(organizationId: string, query: PatientSearchQuery) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const sortBy = query.sortBy ?? 'createdAt'
    const sortOrder = query.sortOrder ?? 'desc'

    const where: Prisma.PatientWhereInput = {
      organizationId,
      deletedAt: query.isActive === false ? { not: null } : null,
    }

    if (query.uhid) where.uhid = { contains: query.uhid, mode: 'insensitive' }
    if (query.phone) where.phone = { contains: query.phone }
    if (query.dob) where.dateOfBirth = new Date(query.dob)
    if (query.gender) where.gender = query.gender as unknown as PrismaGender
    if (query.q) {
      where.OR = [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        { uhid: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.patient.count({ where }),
    ])

    return {
      data: data.map((patient) => this.toResponse(patient)),
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

  async getById(organizationId: string, id: string): Promise<PatientWithSummary> {
    const patient = await this.requireActive(organizationId, id)
    const summary = await this.getSummaryCounts(organizationId, id)
    return { ...this.toResponse(patient), summary }
  }

  async create(organizationId: string, dto: CreatePatientDto, actorUserId?: string): Promise<Patient> {
    const conflict = await this.prisma.patient.findUnique({
      where: { phone_organizationId: { phone: dto.phone, organizationId } },
    })
    if (conflict) {
      throw conflict.deletedAt
        ? new ConflictException(
            'A previously deleted patient with this phone number exists — restore that record instead of registering a new one',
          )
        : new ConflictException('A patient with this phone number already exists')
    }

    const org = await this.organizationsService.getCurrent(organizationId)
    const settings = (org.settings ?? {}) as Record<string, unknown>

    const patient = await this.prisma.$transaction(async (tx) => {
      const uhid = await this.generateUhid(tx, organizationId, settings)
      return tx.patient.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          bloodGroup: dto.bloodGroup,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
          organizationId,
          uhid,
        },
      })
    })

    this.eventEmitter.emit('patient.registered', {
      patientId: patient.id,
      organizationId,
      userId: actorUserId,
    })

    return this.toResponse(patient)
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdatePatientDto,
    actorUserId?: string,
  ): Promise<Patient> {
    await this.requireActive(organizationId, id)

    if (dto.phone) {
      const conflict = await this.prisma.patient.findUnique({
        where: { phone_organizationId: { phone: dto.phone, organizationId } },
      })
      if (conflict && conflict.id !== id) {
        throw new ConflictException('A patient with this phone number already exists')
      }
    }

    const patient = await this.prisma.patient.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    })

    this.eventEmitter.emit('patient.updated', { patientId: id, organizationId, userId: actorUserId })

    return this.toResponse(patient)
  }

  async softDelete(organizationId: string, id: string, actorUserId?: string): Promise<Patient> {
    await this.requireActive(organizationId, id)

    const patient = await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    })

    this.eventEmitter.emit('patient.deleted', { patientId: id, organizationId, userId: actorUserId })

    return this.toResponse(patient)
  }

  async restore(organizationId: string, id: string, actorUserId?: string): Promise<Patient> {
    const patient = await this.prisma.patient.findFirst({
      where: { id, organizationId, deletedAt: { not: null } },
    })
    if (!patient) throw new NotFoundException('Deleted patient not found')

    const restored = await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    })

    this.eventEmitter.emit('patient.restored', { patientId: id, organizationId, userId: actorUserId })

    return this.toResponse(restored)
  }

  async checkDuplicates(organizationId: string, dto: DuplicateCheckDto): Promise<DuplicateMatch[]> {
    if (!dto.phone && !dto.dateOfBirth && !(dto.firstName && dto.lastName)) return []

    const orConditions: Prisma.PatientWhereInput[] = []
    if (dto.phone) orConditions.push({ phone: dto.phone })
    if (dto.dateOfBirth) orConditions.push({ dateOfBirth: new Date(dto.dateOfBirth) })
    if (dto.firstName && dto.lastName) {
      orConditions.push({
        firstName: { equals: dto.firstName, mode: 'insensitive' },
        lastName: { equals: dto.lastName, mode: 'insensitive' },
      })
    }

    const candidates = await this.prisma.patient.findMany({
      where: { organizationId, deletedAt: null, OR: orConditions },
      take: 25,
    })

    return candidates
      .map((candidate) => this.scoreDuplicate(candidate, dto))
      .filter((match): match is DuplicateMatch => match !== null)
      .sort((a, b) => b.confidence - a.confidence)
  }

  async countRegisteredToday(organizationId: string): Promise<number> {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    return this.prisma.patient.count({ where: { organizationId, createdAt: { gte: startOfDay } } })
  }

  /**
   * Dashboard "duplicate alerts" widget: re-runs duplicate detection across
   * the most recently registered active patients (bounded scan, not the
   * whole table) and surfaces any pair scoring at or above the same
   * confidence threshold the registration form warns on.
   */
  async listRecentDuplicateAlerts(organizationId: string, limit = 10): Promise<DuplicateMatch[]> {
    const recent = await this.prisma.patient.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const seenPairs = new Set<string>()
    const alerts: DuplicateMatch[] = []

    for (const candidate of recent) {
      if (alerts.length >= limit) break

      const matches = await this.checkDuplicates(organizationId, {
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        phone: candidate.phone,
        dateOfBirth: candidate.dateOfBirth.toISOString().slice(0, 10),
      })

      for (const match of matches) {
        if (match.patient.id === candidate.id || match.confidence < 50) continue
        const pairKey = [candidate.id, match.patient.id].sort().join(':')
        if (seenPairs.has(pairKey)) continue
        seenPairs.add(pairKey)
        alerts.push(match)
      }
    }

    return alerts.slice(0, limit)
  }

  async getTimeline(organizationId: string, patientId: string, limit = 100): Promise<PatientTimelineEntry[]> {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, organizationId } })
    if (!patient) throw new NotFoundException('Patient not found')

    const [appointments, admissions, labTests, radiologyOrders, prescriptions, invoices, auditLogs] =
      await Promise.all([
        this.prisma.appointment.findMany({
          where: { patientId, organizationId },
          orderBy: { scheduledAt: 'desc' },
          take: limit,
        }),
        this.prisma.admission.findMany({
          where: { patientId, organizationId },
          orderBy: { admittedAt: 'desc' },
          take: limit,
        }),
        this.prisma.labTest.findMany({
          where: { patientId, organizationId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        this.prisma.radiologyOrder.findMany({
          where: { patientId, organizationId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        this.prisma.prescription.findMany({
          where: { patientId, organizationId },
          orderBy: { prescribedAt: 'desc' },
          take: limit,
        }),
        this.prisma.invoice.findMany({
          where: { patientId, organizationId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
        this.prisma.auditLog.findMany({
          where: { organizationId, resource: 'Patient', resourceId: patientId },
          orderBy: { createdAt: 'desc' },
          take: limit,
        }),
      ])

    const entries: PatientTimelineEntry[] = [
      {
        id: `registration-${patient.id}`,
        type: 'REGISTRATION',
        title: 'Patient registered',
        description: `UHID ${patient.uhid} assigned`,
        occurredAt: patient.createdAt,
      },
      ...appointments.map((a) => ({
        id: a.id,
        type: 'APPOINTMENT' as const,
        title: `${a.type} appointment — ${a.status}`,
        description: a.chiefComplaint ?? undefined,
        occurredAt: a.scheduledAt,
        metadata: { appointmentNumber: a.appointmentNumber, status: a.status },
      })),
      ...admissions.map((a) => ({
        id: a.id,
        type: 'ADMISSION' as const,
        title: `Admission — ${a.status}`,
        description: a.admissionReason,
        occurredAt: a.admittedAt,
        metadata: { admissionNumber: a.admissionNumber },
      })),
      ...labTests.map((l) => ({
        id: l.id,
        type: 'LAB_TEST' as const,
        title: `Lab order — ${l.status}`,
        occurredAt: l.createdAt,
        metadata: { labOrderNumber: l.labOrderNumber },
      })),
      ...radiologyOrders.map((r) => ({
        id: r.id,
        type: 'RADIOLOGY' as const,
        title: `${r.modality} — ${r.bodyPart} (${r.status})`,
        occurredAt: r.createdAt,
        metadata: { orderNumber: r.orderNumber },
      })),
      ...prescriptions.map((p) => ({
        id: p.id,
        type: 'PRESCRIPTION' as const,
        title: `Prescription ${p.prescriptionNumber}`,
        occurredAt: p.prescribedAt,
      })),
      ...invoices.map((i) => ({
        id: i.id,
        type: 'INVOICE' as const,
        title: `Invoice ${i.invoiceNumber} — ${i.status}`,
        description: `₹${i.totalAmount.toString()}`,
        occurredAt: i.createdAt,
      })),
      ...auditLogs.map((log) => ({
        id: log.id,
        type: 'AUDIT' as const,
        title: log.action.replace(/[._]/g, ' '),
        occurredAt: log.createdAt,
      })),
    ]

    return entries.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, limit)
  }

  async listDocuments(organizationId: string, patientId: string) {
    await this.requireActive(organizationId, patientId)
    return this.prisma.patientDocument.findMany({
      where: { patientId, organizationId },
      orderBy: { uploadedAt: 'desc' },
    })
  }

  async uploadDocument(
    organizationId: string,
    patientId: string,
    documentType: DocumentType,
    file: UploadedFileInput,
    actorUserId?: string,
  ) {
    await this.requireActive(organizationId, patientId)

    if (!ALLOWED_DOCUMENT_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type — allowed: PNG, JPEG, WEBP, PDF')
    }
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `patients/${organizationId}/${patientId}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const document = await this.prisma.patientDocument.create({
      data: {
        patientId,
        organizationId,
        documentType,
        fileName: file.fileName,
        fileUrl,
        mimeType: file.mimeType,
        fileSizeBytes: file.size,
      },
    })

    this.eventEmitter.emit('patient.document_uploaded', {
      patientId,
      organizationId,
      userId: actorUserId,
      documentId: document.id,
    })

    return document
  }

  async deleteDocument(organizationId: string, patientId: string, documentId: string): Promise<void> {
    const document = await this.prisma.patientDocument.findFirst({
      where: { id: documentId, patientId, organizationId },
    })
    if (!document) throw new NotFoundException('Document not found')

    const key = this.extractStorageKey(document.fileUrl)
    if (key) await this.storageService.delete(key).catch(() => undefined)

    await this.prisma.patientDocument.delete({ where: { id: documentId } })
  }

  private async requireActive(organizationId: string, id: string): Promise<PrismaPatient> {
    const patient = await this.prisma.patient.findFirst({ where: { id, organizationId, deletedAt: null } })
    if (!patient) throw new NotFoundException('Patient not found')
    return patient
  }

  private async getSummaryCounts(organizationId: string, patientId: string): Promise<PatientSummaryCounts> {
    const [
      appointments,
      admissions,
      labTests,
      radiologyOrders,
      invoices,
      medicalRecords,
      prescriptions,
      insuranceClaims,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: { patientId, organizationId } }),
      this.prisma.admission.count({ where: { patientId, organizationId } }),
      this.prisma.labTest.count({ where: { patientId, organizationId } }),
      this.prisma.radiologyOrder.count({ where: { patientId, organizationId } }),
      this.prisma.invoice.count({ where: { patientId, organizationId } }),
      this.prisma.encounter.count({ where: { patientId, organizationId } }),
      this.prisma.prescription.count({ where: { patientId, organizationId } }),
      this.prisma.insuranceClaim.count({ where: { patientId, organizationId } }),
    ])

    return {
      appointments,
      admissions,
      labTests,
      radiologyOrders,
      invoices,
      medicalRecords,
      prescriptions,
      insuranceClaims,
    }
  }

  /**
   * Generation is serialized per-organization with a transaction-scoped
   * Postgres advisory lock (auto-released at commit/rollback) so two
   * concurrent registrations in the same org can never read the same
   * "count so far" and mint duplicate UHIDs.
   */
  private async generateUhid(
    tx: Prisma.TransactionClient,
    organizationId: string,
    settings: Record<string, unknown>,
  ): Promise<string> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId})::bigint)`

    const year = new Date().getFullYear()
    const yearStart = new Date(Date.UTC(year, 0, 1))

    const count = await tx.patient.count({
      where: { organizationId, createdAt: { gte: yearStart } },
    })

    const prefix = typeof settings.uhidPrefix === 'string' ? settings.uhidPrefix : 'MED'
    return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`
  }

  private scoreDuplicate(candidate: PrismaPatient, dto: DuplicateCheckDto): DuplicateMatch | null {
    const matchedFields: DuplicateMatch['matchedFields'] = []
    let confidence = 0

    if (dto.phone && candidate.phone === dto.phone) {
      matchedFields.push('phone')
      confidence += 55
    }
    if (dto.dateOfBirth && candidate.dateOfBirth.toISOString().slice(0, 10) === dto.dateOfBirth) {
      matchedFields.push('dateOfBirth')
      confidence += 25
    }
    if (dto.firstName && candidate.firstName.toLowerCase() === dto.firstName.toLowerCase()) {
      matchedFields.push('firstName')
      confidence += 10
    }
    if (dto.lastName && candidate.lastName.toLowerCase() === dto.lastName.toLowerCase()) {
      matchedFields.push('lastName')
      confidence += 10
    }

    if (matchedFields.length === 0) return null

    return { patient: this.toResponse(candidate), confidence: Math.min(confidence, 100), matchedFields }
  }

  // Storage keys aren't persisted separately from the public fileUrl, so
  // deletion re-derives the key by stripping the currently-configured base
  // URL. Safe in practice: the base URL for a given provider doesn't change
  // during a document's lifetime within one deployment.
  private extractStorageKey(fileUrl: string): string | null {
    const provider = this.configService.get<string>('storage.provider')
    const base =
      provider === 's3'
        ? this.configService.get<string>('storage.s3.publicUrl')
        : this.configService.get<string>('storage.local.publicUrl', 'http://localhost:4000/uploads')

    if (base && fileUrl.startsWith(`${base}/`)) return fileUrl.slice(base.length + 1)
    return null
  }

  // Prisma's generated Gender/BloodGroup enums and @medicore/types' are the
  // same string values by construction (types/enums.ts mirrors schema.prisma)
  // but are nominally distinct TS types, hence the cast.
  private toResponse(patient: PrismaPatient): Patient {
    return {
      ...patient,
      gender: patient.gender as unknown as Gender,
      bloodGroup: patient.bloodGroup as unknown as BloodGroup | null,
      fullName: `${patient.firstName} ${patient.lastName}`,
      age: computeAge(patient.dateOfBirth),
    }
  }
}

function computeAge(dateOfBirth: Date): number {
  const diffMs = Date.now() - dateOfBirth.getTime()
  return Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000))
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}
