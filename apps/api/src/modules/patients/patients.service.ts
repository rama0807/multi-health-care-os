import {
  BloodGroup,
  CreatePatientDto,
  CreatePatientSchema,
  CsvImportResult,
  CsvImportRowResult,
  DuplicateCheckDto,
  DuplicateMatch,
  FamilyGroup,
  Gender,
  Patient,
  PatientMergeResult,
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

import { parseCsv } from './csv-parser.util'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_DOCUMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024
const MAX_CSV_IMPORT_ROWS = 500

// Every other model with a direct (unenforced or FK) `patientId` column —
// reassigned in `mergePatients` from the merged record to the survivor.
// `payment`/`charge` carry a bare `patientId` string with no Prisma
// relation to Patient (deliberate — see their own schema comments), but
// the column itself is real and still needs reassigning.
const PATIENT_LINKED_MODELS = [
  'patientDocument',
  'appointment',
  'encounter',
  'prescription',
  'labTest',
  'radiologyOrder',
  'admission',
  'invoice',
  'payment',
  'insuranceClaim',
  'patientInsurance',
  'preAuthorization',
  'charge',
  'dispenseOrder',
  'notification',
  'aiConversation',
] as const

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
    if (patient.mergedIntoId) {
      throw new BadRequestException(
        'This patient was merged into another record and cannot be independently restored',
      )
    }

    const restored = await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: null, isActive: true },
    })

    this.eventEmitter.emit('patient.restored', { patientId: id, organizationId, userId: actorUserId })

    return this.toResponse(restored)
  }

  /**
   * Links `patientId` under `headOfFamilyId` as a dependent. The family
   * graph is kept one level deep by construction: a head of family can't
   * itself be someone else's dependent, and a patient who is already a
   * head (has their own dependents) can't be re-linked under someone else
   * — both would otherwise require walking a variable-depth chain on every
   * read. Reparenting an existing family isn't supported (disclosed, not
   * silently handled) — unlink every member first.
   */
  async linkFamilyMember(
    organizationId: string,
    patientId: string,
    headOfFamilyId: string,
    actorUserId?: string,
  ): Promise<Patient> {
    if (patientId === headOfFamilyId) {
      throw new BadRequestException('A patient cannot be their own head of family')
    }

    const [, head] = await Promise.all([
      this.requireActive(organizationId, patientId),
      this.requireActive(organizationId, headOfFamilyId),
    ])

    if (head.headOfFamilyId) {
      throw new BadRequestException(
        'The selected patient is already a member of another family — link to their head of family instead',
      )
    }

    const existingMemberCount = await this.prisma.patient.count({ where: { headOfFamilyId: patientId } })
    if (existingMemberCount > 0) {
      throw new BadRequestException(
        'This patient is already head of a family — unlink their members before joining another family',
      )
    }

    const updated = await this.prisma.patient.update({
      where: { id: patientId },
      data: { headOfFamilyId },
    })

    this.eventEmitter.emit('patient.family_linked', {
      patientId,
      organizationId,
      userId: actorUserId,
      metadata: { headOfFamilyId },
    })

    return this.toResponse(updated)
  }

  async unlinkFamilyMember(organizationId: string, patientId: string, actorUserId?: string): Promise<Patient> {
    const patient = await this.requireActive(organizationId, patientId)
    if (!patient.headOfFamilyId) {
      throw new BadRequestException('This patient has no head of family set')
    }

    const previousHeadOfFamilyId = patient.headOfFamilyId
    const updated = await this.prisma.patient.update({
      where: { id: patientId },
      data: { headOfFamilyId: null },
    })

    this.eventEmitter.emit('patient.family_unlinked', {
      patientId,
      organizationId,
      userId: actorUserId,
      metadata: { previousHeadOfFamilyId },
    })

    return this.toResponse(updated)
  }

  async listFamilyMembers(organizationId: string, patientId: string): Promise<FamilyGroup> {
    const patient = await this.requireActive(organizationId, patientId)
    const headId = patient.headOfFamilyId ?? patient.id

    const head = patient.headOfFamilyId
      ? await this.prisma.patient.findFirst({ where: { id: headId, organizationId, deletedAt: null } })
      : patient
    if (!head) throw new NotFoundException('Head of family not found')

    const members = await this.prisma.patient.findMany({
      where: { headOfFamilyId: headId, organizationId, deletedAt: null },
      orderBy: { firstName: 'asc' },
    })

    return {
      headOfFamily: this.toResponse(head),
      members: members.map((m) => this.toResponse(m)),
    }
  }

  /**
   * Merges `sourcePatientId` into `targetPatientId`: every other module's
   * `patientId` column (see `PATIENT_LINKED_MODELS`) and any dependents the
   * source was head of family for are reassigned to the target inside one
   * transaction, then the source is soft-deleted with `mergedIntoId` set —
   * reusing the existing soft-delete plumbing rather than a new "merged"
   * status. `restore()` refuses a merged record (see above) since its data
   * has already moved to the survivor.
   */
  async mergePatients(
    organizationId: string,
    sourcePatientId: string,
    targetPatientId: string,
    actorUserId?: string,
  ): Promise<PatientMergeResult> {
    if (sourcePatientId === targetPatientId) {
      throw new BadRequestException('Cannot merge a patient into themselves')
    }

    await this.requireActive(organizationId, sourcePatientId)
    await this.requireActive(organizationId, targetPatientId)

    const reassignedCounts: Record<string, number> = {}

    await this.prisma.$transaction(async (tx) => {
      for (const model of PATIENT_LINKED_MODELS) {
        const delegate = tx[model] as { updateMany: (args: unknown) => Promise<{ count: number }> }
        const result = await delegate.updateMany({
          where: { patientId: sourcePatientId },
          data: { patientId: targetPatientId },
        })
        reassignedCounts[model] = result.count
      }

      const familyResult = await tx.patient.updateMany({
        where: { headOfFamilyId: sourcePatientId },
        data: { headOfFamilyId: targetPatientId },
      })
      reassignedCounts.familyMembers = familyResult.count

      await tx.patient.update({
        where: { id: sourcePatientId },
        data: { mergedIntoId: targetPatientId, isActive: false, deletedAt: new Date() },
      })
    })

    this.eventEmitter.emit('patient.merged', {
      patientId: sourcePatientId,
      organizationId,
      userId: actorUserId,
      metadata: { mergedIntoId: targetPatientId, reassignedCounts },
    })

    return { survivorPatientId: targetPatientId, mergedPatientId: sourcePatientId, reassignedCounts }
  }

  /**
   * Bulk-registers patients from a CSV upload, one row at a time through
   * the same `create()` path a manual registration uses — so UHID
   * generation, phone-conflict detection, and validation are identical,
   * not a parallel bulk-insert code path. Rows are processed sequentially
   * (not in parallel) since UHID generation counts existing patients per
   * organization; a bounded 500-row cap keeps a bad upload from running
   * for minutes. A failing row is recorded and processing continues — one
   * bad row never aborts the rest of the file.
   */
  async importFromCsv(organizationId: string, buffer: Buffer, actorUserId?: string): Promise<CsvImportResult> {
    const text = buffer.toString('utf-8').replace(/^\uFEFF/, '')
    const rows = parseCsv(text)
    if (rows.length === 0) throw new BadRequestException('CSV file is empty')

    const header = rows[0].map((h) => h.trim())
    const dataRows = rows.slice(1)
    if (dataRows.length === 0) throw new BadRequestException('CSV has a header row but no data rows')
    if (dataRows.length > MAX_CSV_IMPORT_ROWS) {
      throw new BadRequestException(`CSV import is limited to ${MAX_CSV_IMPORT_ROWS} rows per file`)
    }

    const results: CsvImportRowResult[] = []
    let created = 0

    for (let index = 0; index < dataRows.length; index++) {
      const rowNumber = index + 2 // +1 for the header row, +1 for 1-indexing
      const cols = dataRows[index]
      const record: Record<string, string> = {}
      header.forEach((key, colIndex) => {
        record[key] = (cols[colIndex] ?? '').trim()
      })

      const candidate = {
        firstName: record.firstName,
        lastName: record.lastName,
        email: record.email || undefined,
        phone: record.phone,
        dateOfBirth: record.dateOfBirth,
        gender: record.gender,
        bloodGroup: record.bloodGroup || undefined,
        address: record.address || undefined,
        city: record.city || undefined,
        state: record.state || undefined,
        pincode: record.pincode || undefined,
        emergencyContactName: record.emergencyContactName || undefined,
        emergencyContactPhone: record.emergencyContactPhone || undefined,
      }

      const parsed = CreatePatientSchema.safeParse(candidate)
      if (!parsed.success) {
        results.push({
          row: rowNumber,
          success: false,
          error: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
        })
        continue
      }

      try {
        const patient = await this.create(organizationId, parsed.data, actorUserId)
        results.push({ row: rowNumber, success: true, patientId: patient.id, uhid: patient.uhid })
        created++
      } catch (error) {
        results.push({
          row: rowNumber,
          success: false,
          error: error instanceof ConflictException ? error.message : 'Failed to create patient',
        })
      }
    }

    this.eventEmitter.emit('patient.import_completed', {
      organizationId,
      userId: actorUserId,
      total: dataRows.length,
      created,
      failed: dataRows.length - created,
    })

    return { total: dataRows.length, created, failed: dataRows.length - created, results }
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
