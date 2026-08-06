import {
  AiUsageByFeature,
  AiUsageLogEntry,
  AiUsageQuery,
  AiUsageSummary,
  AI_FEATURE_LABELS,
  PaginatedResponse,
} from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

/** Read side of `AiUsageLog` - the write side lives in `AiGenerationService`. */
@Injectable()
export class AiUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(organizationId: string, query: AiUsageQuery): Promise<AiUsageSummary> {
    const { from, to } = resolveWindow(query)
    const where: Prisma.AiUsageLogWhereInput = {
      organizationId,
      feature: query.feature,
      createdAt: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) },
    }

    const rows = await this.prisma.aiUsageLog.findMany({
      where,
      select: {
        feature: true,
        status: true,
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        tokensEstimated: true,
        estimatedCostUsd: true,
        latencyMs: true,
      },
    })

    const byFeature = new Map<string, AiUsageByFeature>()
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let estimatedCostUsd = 0
    let latencySum = 0
    let succeeded = 0
    let failed = 0
    let containsEstimatedTokens = false

    for (const row of rows) {
      const cost = Number(row.estimatedCostUsd)
      promptTokens += row.promptTokens
      completionTokens += row.completionTokens
      totalTokens += row.totalTokens
      estimatedCostUsd += cost
      latencySum += row.latencyMs
      if (row.status === 'SUCCEEDED') succeeded += 1
      if (row.status === 'FAILED') failed += 1
      if (row.tokensEstimated) containsEstimatedTokens = true

      const bucket = byFeature.get(row.feature) ?? {
        feature: row.feature,
        featureLabel: AI_FEATURE_LABELS[row.feature],
        requests: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      }
      bucket.requests += 1
      bucket.totalTokens += row.totalTokens
      bucket.estimatedCostUsd = round6(bucket.estimatedCostUsd + cost)
      byFeature.set(row.feature, bucket)
    }

    return {
      from,
      to,
      totalRequests: rows.length,
      succeededRequests: succeeded,
      failedRequests: failed,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd: round6(estimatedCostUsd),
      containsEstimatedTokens,
      averageLatencyMs: rows.length ? Math.round(latencySum / rows.length) : 0,
      byFeature: [...byFeature.values()].sort((a, b) => b.totalTokens - a.totalTokens),
    }
  }

  async list(organizationId: string, query: AiUsageQuery): Promise<PaginatedResponse<AiUsageLogEntry>> {
    const page = Math.max(query.page ?? 1, 1)
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100)
    const { from, to } = resolveWindow(query)

    const where: Prisma.AiUsageLogWhereInput = {
      organizationId,
      feature: query.feature,
      createdAt: { gte: new Date(`${from}T00:00:00.000Z`), lte: new Date(`${to}T23:59:59.999Z`) },
    }

    const [rows, total] = await Promise.all([
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.aiUsageLog.count({ where }),
    ])

    return {
      data: rows.map((row) => ({
        id: row.id,
        feature: row.feature,
        featureLabel: AI_FEATURE_LABELS[row.feature],
        provider: row.provider,
        model: row.model,
        status: row.status,
        streamed: row.streamed,
        promptTokens: row.promptTokens,
        completionTokens: row.completionTokens,
        totalTokens: row.totalTokens,
        tokensEstimated: row.tokensEstimated,
        estimatedCostUsd: Number(row.estimatedCostUsd),
        latencyMs: row.latencyMs,
        attempts: row.attempts,
        errorCode: row.errorCode,
        errorMessage: row.errorMessage,
        userId: row.userId,
        conversationId: row.conversationId,
        createdAt: row.createdAt,
      })),
      pagination: buildPagination(page, limit, total),
    }
  }
}

/** Defaults to the trailing 30 days when the caller supplies no window. */
function resolveWindow(query: AiUsageQuery): { from: string; to: string } {
  const to = query.to ?? new Date().toISOString().slice(0, 10)
  if (query.from) return { from: query.from, to }

  const start = new Date(`${to}T00:00:00.000Z`)
  start.setUTCDate(start.getUTCDate() - 29)
  return { from: start.toISOString().slice(0, 10), to }
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function buildPagination(page: number, limit: number, total: number) {
  const totalPages = Math.max(Math.ceil(total / limit), 1)
  return { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }
}
