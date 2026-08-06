import { AiStatus, AiStreamEvent, GenerateAiContentDto, JwtPayload } from '@medicore/types'
import { Body, Controller, Get, HttpCode, HttpException, Post, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'

import { AiClientService } from '../../common/ai/ai-client.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { RequirePermissions } from '../../common/decorators/permissions.decorator'

import { AiGenerationService } from './ai-generation.service'
import { GenerateAiContentValidationPipe } from './dto/ai.dto'

/** Swagger can't render a discriminated union body, so the shape is described instead. */
const GENERATE_BODY_DESCRIPTION = [
  'Discriminated on `feature`:',
  '`SOAP_NOTE` / `CLINICAL_NOTE_SUMMARY` → `{ encounterId }`;',
  '`LAB_RESULT_SUMMARY` → `{ labTestId }`;',
  '`RADIOLOGY_REPORT_SUMMARY` → `{ radiologyOrderId }`;',
  '`PRESCRIPTION_EXPLANATION` → `{ prescriptionId }`;',
  '`DISCHARGE_SUMMARY` → `{ admissionId }`;',
  '`REFERRAL_LETTER` → `{ encounterId, referredToSpecialty, reason, referredToName? }`.',
  'All accept an optional `additionalContext` string.',
].join(' ')

@ApiTags('ai')
@ApiBearerAuth()
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(
    private readonly generationService: AiGenerationService,
    private readonly aiClient: AiClientService,
  ) {}

  /**
   * Lets the UI decide whether to offer an AI action at all, and show *why*
   * it can't when it can't - rather than surfacing a 503 after the click.
   */
  @Get('status')
  @RequirePermissions('ai.read')
  @ApiOperation({ summary: 'Whether AI is enabled, configured, and which features are on' })
  getStatus(): AiStatus {
    return this.aiClient.getStatus()
  }

  @Post('generate')
  @HttpCode(200)
  @RequirePermissions('ai.generate')
  @ApiOperation({ summary: 'Generate clinical content from an existing record (non-streaming)' })
  @ApiBody({ description: GENERATE_BODY_DESCRIPTION })
  generate(@CurrentUser() user: JwtPayload, @Body(GenerateAiContentValidationPipe) dto: GenerateAiContentDto) {
    return this.generationService.generate(user.orgId, user, dto)
  }

  /**
   * SSE over POST rather than Nest's `@Sse()`, which implies GET: the request
   * body carries patient record identifiers that don't belong in a query
   * string (ADR-0023). Writing to the raw reply deliberately bypasses
   * `ResponseTransformInterceptor` - a stream has no envelope to wrap.
   */
  @Post('generate/stream')
  @RequirePermissions('ai.generate')
  @ApiOperation({ summary: 'Generate clinical content, streamed as server-sent events' })
  @ApiBody({ description: GENERATE_BODY_DESCRIPTION })
  async generateStream(
    @CurrentUser() user: JwtPayload,
    @Body(GenerateAiContentValidationPipe) dto: GenerateAiContentDto,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (event: AiStreamEvent): void => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    }

    try {
      for await (const event of this.generationService.generateStream(user.orgId, user, dto)) {
        if (event.type === 'delta') {
          send({ type: 'chunk', delta: event.text })
        } else {
          send({ type: 'done', result: event.result })
        }
      }
    } catch (error) {
      // Headers are already flushed, so the status code can't be changed -
      // the failure is delivered as a terminal SSE event instead, carrying the
      // status the equivalent non-streaming call would have returned.
      const statusCode = error instanceof HttpException ? error.getStatus() : 500
      const message =
        error instanceof HttpException ? extractMessage(error) : 'The AI request failed. No content was generated.'
      send({ type: 'error', message, statusCode })
    } finally {
      reply.raw.end()
    }
  }
}

function extractMessage(error: HttpException): string {
  const response = error.getResponse()
  if (typeof response === 'string') return response
  const message = (response as { message?: string | string[] }).message
  if (Array.isArray(message)) return message.join(', ')
  return message ?? error.message
}
