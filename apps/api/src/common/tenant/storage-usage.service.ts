import { StorageUsageBreakdown } from '@medicore/types'
import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'

/**
 * Storage consumption per organization (Checkpoint 16.2).
 *
 * Summed from the `fileSizeBytes` column each upload path already writes -
 * it is *not* read back from the storage bucket, so it measures what MediCore
 * recorded rather than what the disk/S3 driver currently holds. Orphaned
 * objects left behind by a failed delete are therefore invisible here; see
 * TECH_DEBT TD-0047.
 *
 * Only these five models carry a size column today. A future module that adds
 * an upload path must be added here too - the same hand-maintained-list caveat
 * already recorded for `PATIENT_LINKED_MODELS` (TD-0043).
 */
@Injectable()
export class StorageUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getBreakdown(organizationId: string): Promise<StorageUsageBreakdown[]> {
    const [patientDocs, doctorDocs, staffDocs, encounterAttachments, radiologyAttachments] =
      await Promise.all([
        this.prisma.patientDocument.aggregate({
          where: { patient: { organizationId } },
          _sum: { fileSizeBytes: true },
          _count: true,
        }),
        this.prisma.doctorDocument.aggregate({
          where: { doctor: { organizationId } },
          _sum: { fileSizeBytes: true },
          _count: true,
        }),
        this.prisma.staffDocument.aggregate({
          where: { organizationId },
          _sum: { fileSizeBytes: true },
          _count: true,
        }),
        this.prisma.encounterAttachment.aggregate({
          where: { encounter: { organizationId } },
          _sum: { fileSizeBytes: true },
          _count: true,
        }),
        this.prisma.radiologyAttachment.aggregate({
          where: { radiologyOrder: { organizationId } },
          _sum: { fileSizeBytes: true },
          _count: true,
        }),
      ])

    return [
      {
        category: 'Patient documents',
        bytes: patientDocs._sum.fileSizeBytes ?? 0,
        files: patientDocs._count,
      },
      {
        category: 'Doctor documents',
        bytes: doctorDocs._sum.fileSizeBytes ?? 0,
        files: doctorDocs._count,
      },
      {
        category: 'Staff documents',
        bytes: staffDocs._sum.fileSizeBytes ?? 0,
        files: staffDocs._count,
      },
      {
        category: 'Encounter attachments',
        bytes: encounterAttachments._sum.fileSizeBytes ?? 0,
        files: encounterAttachments._count,
      },
      {
        category: 'Radiology attachments',
        bytes: radiologyAttachments._sum.fileSizeBytes ?? 0,
        files: radiologyAttachments._count,
      },
    ]
  }

  async getTotalBytes(organizationId: string): Promise<number> {
    const breakdown = await this.getBreakdown(organizationId)
    return breakdown.reduce((sum, row) => sum + row.bytes, 0)
  }

  /**
   * Cross-tenant totals for the platform console. `StaffDocument` carries
   * `organizationId` directly so it can be grouped in the database; the other
   * four reach their organization through a parent relation, which Prisma's
   * `groupBy` cannot traverse - those are rolled up in memory.
   */
  async getTotalBytesByOrganization(): Promise<Map<string, number>> {
    const totals = new Map<string, number>()
    const add = (orgId: string | null, bytes: number) => {
      if (!orgId) return
      totals.set(orgId, (totals.get(orgId) ?? 0) + bytes)
    }

    const [patients, doctors, staff, encounters, radiology] = await Promise.all([
      this.prisma.patient.findMany({
        select: { organizationId: true, documents: { select: { fileSizeBytes: true } } },
      }),
      this.prisma.doctor.findMany({
        select: { organizationId: true, documents: { select: { fileSizeBytes: true } } },
      }),
      this.prisma.staffDocument.groupBy({ by: ['organizationId'], _sum: { fileSizeBytes: true } }),
      this.prisma.encounter.findMany({
        select: { organizationId: true, attachments: { select: { fileSizeBytes: true } } },
      }),
      this.prisma.radiologyOrder.findMany({
        select: { organizationId: true, attachments: { select: { fileSizeBytes: true } } },
      }),
    ])

    for (const p of patients) add(p.organizationId, sumSizes(p.documents))
    for (const d of doctors) add(d.organizationId, sumSizes(d.documents))
    for (const s of staff) add(s.organizationId, s._sum.fileSizeBytes ?? 0)
    for (const e of encounters) add(e.organizationId, sumSizes(e.attachments))
    for (const r of radiology) add(r.organizationId, sumSizes(r.attachments))

    return totals
  }
}

function sumSizes(rows: Array<{ fileSizeBytes: number | null }>): number {
  return rows.reduce((sum, row) => sum + (row.fileSizeBytes ?? 0), 0)
}
