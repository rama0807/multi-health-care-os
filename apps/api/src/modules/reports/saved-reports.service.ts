import {
  CreateSavedReportDto,
  PaginatedResponse,
  ReportFilterQuery,
  SavedReport,
  SavedReportQuery,
  UpdateSavedReportDto,
} from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, SavedReport as PrismaSavedReport } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { ReportRegistryService } from './report-registry.service'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * Saved reports (Milestone 17 Checkpoint 17.3) — a named set of filters
 * against one registry report. Nothing is cached: a saved report stores the
 * question, never the answer, so re-running it always reflects current data.
 *
 * Visibility: a saved report is private to its creator unless `isShared` is
 * set, in which case anyone in the organization holding `reports.read` can
 * run it. Editing and deleting stay with the creator.
 */
@Injectable()
export class SavedReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ReportRegistryService,
  ) {}

  async list(
    organizationId: string,
    userId: string,
    query: SavedReportQuery = {},
  ): Promise<PaginatedResponse<SavedReport>> {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT))

    const where: Prisma.SavedReportWhereInput = {
      organizationId,
      // Own reports plus everything shared with the organization.
      OR: [{ createdByUserId: userId }, { isShared: true }],
      ...(query.reportKey ? { reportKey: query.reportKey } : {}),
      ...(query.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' as const } },
                  { description: { contains: query.search, mode: 'insensitive' as const } },
                ],
              },
            ],
          }
        : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.savedReport.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.savedReport.count({ where }),
    ])

    const creators = await this.resolveCreators(rows)

    return {
      data: rows.map((row) => this.toResponse(row, creators.get(row.createdByUserId) ?? null)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  async getById(organizationId: string, userId: string, id: string): Promise<SavedReport> {
    const row = await this.prisma.savedReport.findFirst({
      where: { id, organizationId, OR: [{ createdByUserId: userId }, { isShared: true }] },
    })
    if (!row) throw new NotFoundException('Saved report not found')

    const creators = await this.resolveCreators([row])
    return this.toResponse(row, creators.get(row.createdByUserId) ?? null)
  }

  async create(organizationId: string, userId: string, dto: CreateSavedReportDto): Promise<SavedReport> {
    // Validates the key against the registry before persisting — a saved
    // report pointing at a report that does not exist is unrunnable, and
    // failing here names the problem instead of deferring it to run time.
    this.registry.getDefinition(dto.reportKey)

    try {
      const row = await this.prisma.savedReport.create({
        data: {
          organizationId,
          createdByUserId: userId,
          name: dto.name,
          description: dto.description ?? null,
          reportKey: dto.reportKey,
          filters: (dto.filters ?? {}) as Prisma.InputJsonValue,
          isShared: dto.isShared ?? false,
          scheduleEnabled: dto.scheduleEnabled ?? false,
          scheduleCron: dto.scheduleCron ?? null,
          scheduleRecipients: dto.scheduleRecipients ?? [],
        },
      })
      return this.toResponse(row, null)
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.name)
    }
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateSavedReportDto,
  ): Promise<SavedReport> {
    const existing = await this.prisma.savedReport.findFirst({ where: { id, organizationId } })
    // A shared report someone else owns is not yours to edit — reported as
    // "not found" rather than "forbidden" so the response never confirms the
    // existence of another user's private report.
    if (!existing || existing.createdByUserId !== userId) {
      throw new NotFoundException('Saved report not found')
    }
    if (dto.reportKey) this.registry.getDefinition(dto.reportKey)

    try {
      const row = await this.prisma.savedReport.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.reportKey !== undefined ? { reportKey: dto.reportKey } : {}),
          ...(dto.filters !== undefined ? { filters: dto.filters as Prisma.InputJsonValue } : {}),
          ...(dto.isShared !== undefined ? { isShared: dto.isShared } : {}),
          ...(dto.scheduleEnabled !== undefined ? { scheduleEnabled: dto.scheduleEnabled } : {}),
          ...(dto.scheduleCron !== undefined ? { scheduleCron: dto.scheduleCron } : {}),
          ...(dto.scheduleRecipients !== undefined ? { scheduleRecipients: dto.scheduleRecipients } : {}),
        },
      })
      return this.toResponse(row, null)
    } catch (error) {
      throw this.mapUniqueViolation(error, dto.name ?? existing.name)
    }
  }

  async remove(organizationId: string, userId: string, id: string): Promise<{ id: string }> {
    const existing = await this.prisma.savedReport.findFirst({ where: { id, organizationId } })
    if (!existing || existing.createdByUserId !== userId) {
      throw new NotFoundException('Saved report not found')
    }

    await this.prisma.savedReport.delete({ where: { id } })
    return { id }
  }

  /** Stamped after a successful run so the list can show recency. */
  async markRun(id: string): Promise<void> {
    await this.prisma.savedReport.updateMany({ where: { id }, data: { lastRunAt: new Date() } })
  }

  private async resolveCreators(
    rows: PrismaSavedReport[],
  ): Promise<Map<string, { firstName: string; lastName: string }>> {
    const ids = [...new Set(rows.map((r) => r.createdByUserId))]
    if (ids.length === 0) return new Map()

    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    })
    return new Map(users.map((u) => [u.id, { firstName: u.firstName, lastName: u.lastName }]))
  }

  private mapUniqueViolation(error: unknown, name: string): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException(`A saved report named "${name}" already exists in this organization`)
    }
    return error
  }

  private toResponse(
    row: PrismaSavedReport,
    creator: { firstName: string; lastName: string } | null,
  ): SavedReport {
    return {
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      description: row.description,
      reportKey: row.reportKey,
      filters: (row.filters ?? {}) as ReportFilterQuery,
      isShared: row.isShared,
      createdByUserId: row.createdByUserId,
      createdByName: creator ? `${creator.firstName} ${creator.lastName}` : null,
      scheduleEnabled: row.scheduleEnabled,
      scheduleCron: row.scheduleCron,
      scheduleRecipients: row.scheduleRecipients,
      lastRunAt: row.lastRunAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
