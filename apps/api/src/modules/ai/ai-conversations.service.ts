import {
  AiConversationDetail,
  AiConversationQuery,
  AiConversationSummary,
  AI_FEATURE_LABELS,
  JwtPayload,
  PaginatedResponse,
} from '@medicore/types'
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PermissionsService } from '../../common/permissions/permissions.service'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AiConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async list(
    organizationId: string,
    user: JwtPayload,
    query: AiConversationQuery,
  ): Promise<PaginatedResponse<AiConversationSummary>> {
    const page = Math.max(query.page ?? 1, 1)
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)

    const where: Prisma.AiConversationWhereInput = {
      organizationId,
      feature: query.feature,
      patientId: query.patientId,
      encounterId: query.encounterId,
      // An `.own`-scoped reader sees only the conversations they created. The
      // treating-doctor check that gates *generation* isn't reusable here: a
      // conversation stores its context refs, not a denormalized doctorId.
      ...(this.permissionsService.getScope(user, 'ai', 'read') === 'own' ? { createdByUserId: user.sub } : {}),
    }

    const [rows, total] = await Promise.all([
      this.prisma.aiConversation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: { select: { firstName: true, lastName: true } },
          _count: { select: { messages: true } },
          usageLogs: { select: { totalTokens: true } },
        },
      }),
      this.prisma.aiConversation.count({ where }),
    ])

    return {
      data: rows.map((row) => ({
        id: row.id,
        feature: row.feature,
        featureLabel: AI_FEATURE_LABELS[row.feature],
        title: row.title,
        patientId: row.patientId,
        patientName: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : null,
        encounterId: row.encounterId,
        createdByUserId: row.createdByUserId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        messageCount: row._count.messages,
        totalTokens: row.usageLogs.reduce((sum, log) => sum + log.totalTokens, 0),
      })),
      pagination: buildPagination(page, limit, total),
    }
  }

  async getById(organizationId: string, user: JwtPayload, id: string): Promise<AiConversationDetail> {
    const row = await this.prisma.aiConversation.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        messages: { orderBy: { sequence: 'asc' } },
        usageLogs: { select: { totalTokens: true } },
      },
    })
    if (!row) throw new NotFoundException('AI conversation not found')

    if (this.permissionsService.getScope(user, 'ai', 'read') === 'own' && row.createdByUserId !== user.sub) {
      throw new ForbiddenException('You can only view AI conversations you created')
    }

    return {
      id: row.id,
      feature: row.feature,
      featureLabel: AI_FEATURE_LABELS[row.feature],
      title: row.title,
      patientId: row.patientId,
      patientName: row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : null,
      encounterId: row.encounterId,
      labTestId: row.labTestId,
      radiologyOrderId: row.radiologyOrderId,
      prescriptionId: row.prescriptionId,
      admissionId: row.admissionId,
      createdByUserId: row.createdByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messageCount: row.messages.length,
      totalTokens: row.usageLogs.reduce((sum, log) => sum + log.totalTokens, 0),
      messages: row.messages.map((message) => ({
        id: message.id,
        sequence: message.sequence,
        role: message.role,
        content: message.content,
        tokenCount: message.tokenCount,
        createdAt: message.createdAt,
      })),
    }
  }
}

function buildPagination(page: number, limit: number, total: number) {
  const totalPages = Math.max(Math.ceil(total / limit), 1)
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
}
