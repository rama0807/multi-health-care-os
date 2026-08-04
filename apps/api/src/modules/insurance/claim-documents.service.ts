import { ClaimDocument, ClaimDocumentType } from '@medicore/types'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { LabTestStatus, RadiologyStatus } from '@prisma/client'
import { nanoid } from 'nanoid'

import { StorageService } from '../../common/storage/storage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { InvoicesService } from '../billing/invoices.service'
import { LabTestsService } from '../laboratory/lab-tests.service'
import { PrescriptionsService } from '../prescriptions/prescriptions.service'
import { RadiologyOrdersService } from '../radiology/radiology-orders.service'

import { generateEncounterSummaryPdf } from './insurance-encounter-summary-pdf'

export interface UploadedFileInput {
  buffer: Buffer
  fileName: string
  mimeType: string
  size: number
}

const ALLOWED_UPLOAD_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024

/**
 * A claim's supporting documents — auto-attached at claim-creation time
 * from every clinical/billing module's existing (or, for the encounter
 * summary, purpose-built) PDF generator, plus manual uploads reusing the
 * existing `StorageService` — see ADR-0016. Auto-attach failures are
 * logged and skipped rather than failing claim creation: a missing report
 * shouldn't block filing the claim itself, and the claim's document list
 * always shows exactly what did attach.
 */
@Injectable()
export class ClaimDocumentsService {
  private readonly logger = new Logger(ClaimDocumentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly invoicesService: InvoicesService,
    private readonly prescriptionsService: PrescriptionsService,
    private readonly labTestsService: LabTestsService,
    private readonly radiologyOrdersService: RadiologyOrdersService,
  ) {}

  async list(organizationId: string, claimId: string): Promise<ClaimDocument[]> {
    const docs = await this.prisma.claimDocument.findMany({
      where: { claimId, organizationId },
      orderBy: { createdAt: 'asc' },
    })
    return docs.map((d) => this.toResponse(d))
  }

  async autoAttachForClaim(organizationId: string, claimId: string, encounterId: string, invoiceId: string): Promise<void> {
    await this.attachOne(organizationId, claimId, ClaimDocumentType.INVOICE, () =>
      this.invoicesService.generatePdf(organizationId, invoiceId),
    )

    const prescriptions = await this.prisma.prescription.findMany({ where: { organizationId, encounterId } })
    for (const prescription of prescriptions) {
      await this.attachOne(organizationId, claimId, ClaimDocumentType.PRESCRIPTION, () =>
        this.prescriptionsService.generatePdf(organizationId, prescription.id),
      )
    }

    const labTests = await this.prisma.labTest.findMany({
      where: { organizationId, encounterId, status: LabTestStatus.REPORTED },
    })
    for (const labTest of labTests) {
      await this.attachOne(organizationId, claimId, ClaimDocumentType.LAB_REPORT, () =>
        this.labTestsService.generateReportPdf(organizationId, labTest.id),
      )
    }

    const radiologyOrders = await this.prisma.radiologyOrder.findMany({
      where: { organizationId, encounterId, status: RadiologyStatus.REPORTED },
    })
    for (const order of radiologyOrders) {
      await this.attachOne(organizationId, claimId, ClaimDocumentType.RADIOLOGY_REPORT, () =>
        this.radiologyOrdersService.generateReportPdf(organizationId, order.id),
      )
    }

    await this.attachOne(organizationId, claimId, ClaimDocumentType.ENCOUNTER_SUMMARY, () =>
      this.generateEncounterSummary(organizationId, encounterId),
    )
  }

  async uploadManual(
    organizationId: string,
    claimId: string,
    type: ClaimDocumentType,
    file: UploadedFileInput,
    actorUserId: string,
  ): Promise<ClaimDocument> {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimeType)) {
      throw new BadRequestException('Unsupported file type — allowed: PNG, JPEG, WEBP, PDF')
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException('File exceeds the 10MB upload limit')
    }

    const key = `insurance/claims/${organizationId}/${claimId}/${nanoid()}-${sanitizeFileName(file.fileName)}`
    const fileUrl = await this.storageService.upload({ key, buffer: file.buffer, mimeType: file.mimeType })

    const doc = await this.prisma.claimDocument.create({
      data: {
        claimId,
        organizationId,
        type,
        fileName: file.fileName,
        fileUrl,
        autoAttached: false,
        uploadedByUserId: actorUserId,
      },
    })
    return this.toResponse(doc)
  }

  private async attachOne(
    organizationId: string,
    claimId: string,
    type: ClaimDocumentType,
    generate: () => Promise<{ buffer: Buffer; fileName: string }>,
  ): Promise<void> {
    try {
      const { buffer, fileName } = await generate()
      const key = `insurance/claims/${organizationId}/${claimId}/${nanoid()}-${sanitizeFileName(fileName)}`
      const fileUrl = await this.storageService.upload({ key, buffer, mimeType: 'application/pdf' })
      await this.prisma.claimDocument.create({
        data: { claimId, organizationId, type, fileName, fileUrl, autoAttached: true },
      })
    } catch (error) {
      this.logger.warn(`Auto-attach skipped for claim ${claimId} (${type}): ${(error as Error).message}`)
    }
  }

  private async generateEncounterSummary(organizationId: string, encounterId: string): Promise<{ buffer: Buffer; fileName: string }> {
    const encounter = await this.prisma.encounter.findFirstOrThrow({
      where: { id: encounterId, organizationId },
      include: {
        patient: { select: { firstName: true, lastName: true, uhid: true } },
        doctor: { select: { specialization: true, user: { select: { firstName: true, lastName: true } } } },
        organization: { select: { name: true, address: true, phone: true, email: true } },
        clinicalNotes: { orderBy: { createdAt: 'asc' } },
        diagnoses: { orderBy: { createdAt: 'asc' } },
        vitals: { orderBy: { recordedAt: 'asc' } },
        procedures: { orderBy: { performedAt: 'asc' } },
      },
    })

    const buffer = await generateEncounterSummaryPdf({
      encounterNumber: encounter.id,
      type: encounter.type,
      status: encounter.status,
      createdAt: encounter.createdAt,
      organization: encounter.organization,
      doctor: {
        fullName: `${encounter.doctor.user.firstName} ${encounter.doctor.user.lastName}`,
        specialization: encounter.doctor.specialization,
      },
      patient: { fullName: `${encounter.patient.firstName} ${encounter.patient.lastName}`, uhid: encounter.patient.uhid },
      clinicalNotes: encounter.clinicalNotes,
      diagnoses: encounter.diagnoses,
      vitals: encounter.vitals,
      procedures: encounter.procedures,
    })
    return { buffer, fileName: `encounter-summary-${encounter.id}.pdf` }
  }

  private toResponse(doc: {
    id: string
    claimId: string
    organizationId: string
    type: string
    fileName: string
    fileUrl: string
    autoAttached: boolean
    uploadedByUserId: string | null
    createdAt: Date
  }): ClaimDocument {
    return {
      id: doc.id,
      claimId: doc.claimId,
      organizationId: doc.organizationId,
      type: doc.type as unknown as ClaimDocumentType,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      autoAttached: doc.autoAttached,
      uploadedByUserId: doc.uploadedByUserId,
      createdAt: doc.createdAt,
    }
  }
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9_.-]/g, '_')
}
