import {
  AiFeature,
  AiGenerationResult,
  AI_CLINICAL_DISCLAIMER,
  GenerateAiContentDto,
  JwtPayload,
} from '@medicore/types'
import { ForbiddenException, Injectable } from '@nestjs/common'

import { AiClientService, AiDispatchOutcome } from '../../common/ai/ai-client.service'
import { toProviderError } from '../../common/ai/ai-errors'
import { PermissionsService } from '../../common/permissions/permissions.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { DoctorRefService } from '../scheduling/doctor-ref.service'

import { AiPromptTemplatesService } from './ai-prompt-templates.service'
import { ClinicalContext, ClinicalContextService } from './context/clinical-context.service'
import { renderPromptTemplate } from './prompts/render'

interface PreparedGeneration {
  conversationId: string
  systemPrompt: string
  userPrompt: string
  context: ClinicalContext
}

/**
 * Orchestrates one generation: availability → context → own-scope → prompt →
 * conversation write → provider dispatch → usage log → audit. The provider
 * itself lives behind `AiClientService`, so nothing here knows or cares which
 * vendor served the request (ADR-0023).
 */
@Injectable()
export class AiGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiClient: AiClientService,
    private readonly contextService: ClinicalContextService,
    private readonly templates: AiPromptTemplatesService,
    private readonly permissionsService: PermissionsService,
    private readonly doctorRef: DoctorRefService,
    private readonly auditService: AuditService,
  ) {}

  async generate(organizationId: string, user: JwtPayload, dto: GenerateAiContentDto): Promise<AiGenerationResult> {
    const prepared = await this.prepare(organizationId, user, dto)

    let outcome: AiDispatchOutcome
    try {
      outcome = await this.aiClient.complete({
        feature: dto.feature,
        systemPrompt: prepared.systemPrompt,
        userPrompt: prepared.userPrompt,
      })
    } catch (error) {
      await this.recordFailure(organizationId, user, dto.feature, prepared.conversationId, error, false)
      throw this.aiClient.toHttpException(error)
    }

    return this.finalize(organizationId, user, dto.feature, prepared, outcome, false)
  }

  /**
   * Same pipeline, streamed. Deltas are yielded as they arrive; the
   * conversation/usage/audit writes happen once at the end, so a stream that
   * dies halfway records a failure rather than a half-written assistant turn.
   */
  async *generateStream(
    organizationId: string,
    user: JwtPayload,
    dto: GenerateAiContentDto,
  ): AsyncGenerator<{ type: 'delta'; text: string } | { type: 'result'; result: AiGenerationResult }> {
    const prepared = await this.prepare(organizationId, user, dto)

    let outcome: AiDispatchOutcome | null = null
    try {
      for await (const event of this.aiClient.stream({
        feature: dto.feature,
        systemPrompt: prepared.systemPrompt,
        userPrompt: prepared.userPrompt,
      })) {
        if (event.type === 'delta') {
          yield { type: 'delta', text: event.text }
        } else {
          outcome = event.outcome
        }
      }
    } catch (error) {
      await this.recordFailure(organizationId, user, dto.feature, prepared.conversationId, error, true)
      throw this.aiClient.toHttpException(error)
    }

    if (!outcome) {
      const error = new Error('The AI provider closed the stream without completing')
      await this.recordFailure(organizationId, user, dto.feature, prepared.conversationId, error, true)
      throw this.aiClient.toHttpException(error)
    }

    yield { type: 'result', result: await this.finalize(organizationId, user, dto.feature, prepared, outcome, true) }
  }

  // ─── Pipeline steps ──────────────────────────────────────────────────────

  private async prepare(
    organizationId: string,
    user: JwtPayload,
    dto: GenerateAiContentDto,
  ): Promise<PreparedGeneration> {
    // Deliberately first: a disabled or unconfigured feature must never read
    // patient data, because context assembly is itself a PHI read.
    this.aiClient.assertAvailable(dto.feature)

    const context = await this.contextService.build(organizationId, dto)
    await this.assertOwnScopeOk(organizationId, user, context)

    const template = await this.templates.resolve(organizationId, dto.feature)
    const userPrompt = renderPromptTemplate(template.userPromptTemplate, {
      context: context.text,
      additionalContext: dto.additionalContext ? `Additional instructions from the clinician:\n${dto.additionalContext}` : '',
      referredToSpecialty: dto.feature === 'REFERRAL_LETTER' ? dto.referredToSpecialty : undefined,
      referredToName: dto.feature === 'REFERRAL_LETTER' ? (dto.referredToName ?? 'Not specified') : undefined,
      reason: dto.feature === 'REFERRAL_LETTER' ? dto.reason : undefined,
    })

    const conversation = await this.prisma.aiConversation.create({
      data: {
        organizationId,
        feature: dto.feature,
        title: context.title,
        patientId: context.patientId,
        encounterId: context.encounterId,
        labTestId: context.labTestId,
        radiologyOrderId: context.radiologyOrderId,
        prescriptionId: context.prescriptionId,
        admissionId: context.admissionId,
        createdByUserId: user.sub,
        messages: {
          create: [
            { sequence: 0, role: 'SYSTEM', content: template.systemPrompt },
            { sequence: 1, role: 'USER', content: userPrompt },
          ],
        },
      },
    })

    return { conversationId: conversation.id, systemPrompt: template.systemPrompt, userPrompt, context }
  }

  private async finalize(
    organizationId: string,
    user: JwtPayload,
    feature: AiFeature,
    prepared: PreparedGeneration,
    outcome: AiDispatchOutcome,
    streamed: boolean,
  ): Promise<AiGenerationResult> {
    await this.prisma.$transaction([
      this.prisma.aiMessage.create({
        data: {
          conversationId: prepared.conversationId,
          sequence: 2,
          role: 'ASSISTANT',
          content: outcome.content,
          tokenCount: outcome.completionTokens,
        },
      }),
      this.prisma.aiUsageLog.create({
        data: {
          organizationId,
          conversationId: prepared.conversationId,
          userId: user.sub,
          feature,
          provider: outcome.provider,
          model: outcome.model,
          status: 'SUCCEEDED',
          streamed,
          promptTokens: outcome.promptTokens,
          completionTokens: outcome.completionTokens,
          totalTokens: outcome.totalTokens,
          tokensEstimated: outcome.tokensEstimated,
          estimatedCostUsd: outcome.estimatedCostUsd,
          latencyMs: outcome.latencyMs,
          attempts: outcome.attempts,
        },
      }),
    ])

    // The generated text is deliberately NOT written into the audit payload —
    // audit rows are widely readable, and the content already lives on the
    // conversation, which is `ai.read`-gated.
    await this.auditService.record({
      organizationId,
      userId: user.sub,
      action: 'generate',
      resource: 'AiConversation',
      resourceId: prepared.conversationId,
      after: {
        feature,
        provider: outcome.provider,
        model: outcome.model,
        streamed,
        patientId: prepared.context.patientId,
        doctorId: prepared.context.doctorId,
        encounterId: prepared.context.encounterId,
        totalTokens: outcome.totalTokens,
        tokensEstimated: outcome.tokensEstimated,
        attempts: outcome.attempts,
      },
    })

    return {
      conversationId: prepared.conversationId,
      feature,
      content: outcome.content,
      provider: outcome.provider,
      model: outcome.model,
      usage: {
        promptTokens: outcome.promptTokens,
        completionTokens: outcome.completionTokens,
        totalTokens: outcome.totalTokens,
        estimated: outcome.tokensEstimated,
        estimatedCostUsd: outcome.estimatedCostUsd,
      },
      latencyMs: outcome.latencyMs,
      attempts: outcome.attempts,
      disclaimer: AI_CLINICAL_DISCLAIMER,
    }
  }

  /** Failed dispatches are logged too — otherwise a provider outage is invisible in usage reporting. */
  private async recordFailure(
    organizationId: string,
    user: JwtPayload,
    feature: AiFeature,
    conversationId: string,
    error: unknown,
    streamed: boolean,
  ): Promise<void> {
    const providerError = toProviderError(error)
    const status = this.aiClient.getStatus()

    await this.prisma.aiUsageLog.create({
      data: {
        organizationId,
        conversationId,
        userId: user.sub,
        feature,
        provider: status.provider,
        model: status.model,
        status: 'FAILED',
        streamed,
        errorCode: providerError.code,
        errorMessage: providerError.message.slice(0, 1000),
      },
    })
  }

  /**
   * `ai.generate` can be held at `.own` scope — a doctor may only generate
   * against records where they are the treating doctor. Same idiom as
   * `PrescriptionsService.assertOwnScopeOk`; the treating doctor is resolved
   * by whichever context builder ran.
   */
  private async assertOwnScopeOk(organizationId: string, user: JwtPayload, context: ClinicalContext): Promise<void> {
    const scope = this.permissionsService.getScope(user, 'ai', 'generate')
    if (scope !== 'own') return

    const ownProfile = await this.doctorRef.findDoctorProfileForUser(organizationId, user.sub)
    if (!ownProfile || ownProfile.id !== context.doctorId) {
      throw new ForbiddenException('You can only generate AI content for your own patients')
    }
  }
}
