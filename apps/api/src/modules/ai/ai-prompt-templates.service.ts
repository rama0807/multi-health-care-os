import {
  AiFeature,
  AiPromptTemplate,
  AI_FEATURES,
  AI_FEATURE_LABELS,
  CreateAiPromptTemplateDto,
} from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'
import { AiPromptTemplate as PrismaAiPromptTemplate } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { DEFAULT_PROMPT_TEMPLATES, PromptTemplateDefinition } from './prompts/default-prompts'

export interface ResolvedPromptTemplate extends PromptTemplateDefinition {
  version: number
  isBuiltIn: boolean
}

/**
 * Bundled defaults are the source of truth; a stored `AiPromptTemplate` row
 * overrides one per organization when it is the highest active version for
 * that (organization, feature). This means an empty database is a working
 * database, and an org can roll back simply by deactivating its override
 * (ADR-0023). Editing is version-add-only - rows are never mutated in place,
 * mirroring `ClinicalNote`/`RadiologyReport`'s append-only precedent.
 */
@Injectable()
export class AiPromptTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(organizationId: string, feature: AiFeature): Promise<ResolvedPromptTemplate> {
    const override = await this.prisma.aiPromptTemplate.findFirst({
      where: { organizationId, feature, isActive: true },
      orderBy: { version: 'desc' },
    })

    if (override) {
      return {
        systemPrompt: override.systemPrompt,
        userPromptTemplate: override.userPromptTemplate,
        description: override.description ?? DEFAULT_PROMPT_TEMPLATES[feature].description,
        version: override.version,
        isBuiltIn: false,
      }
    }

    return { ...DEFAULT_PROMPT_TEMPLATES[feature], version: 0, isBuiltIn: true }
  }

  /** Every feature's effective template - an override where one exists, otherwise the default. */
  async listEffective(organizationId: string): Promise<AiPromptTemplate[]> {
    return Promise.all(
      AI_FEATURES.map(async (feature) => {
        const overrideRow = await this.prisma.aiPromptTemplate.findFirst({
          where: { organizationId, feature, isActive: true },
          orderBy: { version: 'desc' },
        })
        if (overrideRow) return this.toResponse(overrideRow)

        const builtIn = DEFAULT_PROMPT_TEMPLATES[feature]
        return {
          id: null,
          organizationId: null,
          feature,
          featureLabel: AI_FEATURE_LABELS[feature],
          version: 0,
          systemPrompt: builtIn.systemPrompt,
          userPromptTemplate: builtIn.userPromptTemplate,
          description: builtIn.description,
          isActive: true,
          isBuiltIn: true,
          createdAt: null,
          updatedAt: null,
        }
      }),
    )
  }

  async listVersions(organizationId: string, feature: AiFeature): Promise<AiPromptTemplate[]> {
    const rows = await this.prisma.aiPromptTemplate.findMany({
      where: { organizationId, feature },
      orderBy: { version: 'desc' },
    })
    return rows.map((row) => this.toResponse(row))
  }

  async createVersion(
    organizationId: string,
    userId: string,
    dto: CreateAiPromptTemplateDto,
  ): Promise<AiPromptTemplate> {
    const latest = await this.prisma.aiPromptTemplate.findFirst({
      where: { organizationId, feature: dto.feature },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    // Only one version may be active at a time, so a new version supersedes
    // the previous one rather than racing it in the `orderBy` above.
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.aiPromptTemplate.updateMany({
        where: { organizationId, feature: dto.feature, isActive: true },
        data: { isActive: false },
      })
      return tx.aiPromptTemplate.create({
        data: {
          organizationId,
          feature: dto.feature,
          version: (latest?.version ?? 0) + 1,
          systemPrompt: dto.systemPrompt,
          userPromptTemplate: dto.userPromptTemplate,
          description: dto.description,
          isActive: true,
          createdByUserId: userId,
        },
      })
    })

    return this.toResponse(created)
  }

  /** Deactivating every override for a feature falls the org back to the bundled default. */
  async setActive(organizationId: string, id: string, isActive: boolean): Promise<AiPromptTemplate> {
    const existing = await this.prisma.aiPromptTemplate.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Prompt template not found')

    const updated = await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.aiPromptTemplate.updateMany({
          where: { organizationId, feature: existing.feature, isActive: true, id: { not: id } },
          data: { isActive: false },
        })
      }
      return tx.aiPromptTemplate.update({ where: { id }, data: { isActive } })
    })

    return this.toResponse(updated)
  }

  private toResponse(row: PrismaAiPromptTemplate): AiPromptTemplate {
    return {
      id: row.id,
      organizationId: row.organizationId,
      feature: row.feature,
      featureLabel: AI_FEATURE_LABELS[row.feature],
      version: row.version,
      systemPrompt: row.systemPrompt,
      userPromptTemplate: row.userPromptTemplate,
      description: row.description,
      isActive: row.isActive,
      isBuiltIn: false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }
}
