import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common'

import { AiProviderError } from '../../common/ai/ai-errors'

import { AiGenerationService } from './ai-generation.service'

describe('AiGenerationService', () => {
  const user = { sub: 'user_1', orgId: 'org_1', permissions: [] } as never

  let prisma: {
    aiConversation: { create: jest.Mock }
    aiMessage: { create: jest.Mock }
    aiUsageLog: { create: jest.Mock }
    $transaction: jest.Mock
  }
  let aiClient: {
    assertAvailable: jest.Mock
    complete: jest.Mock
    stream: jest.Mock
    getStatus: jest.Mock
    toHttpException: jest.Mock
  }
  let contextService: { build: jest.Mock }
  let templates: { resolve: jest.Mock }
  let permissionsService: { getScope: jest.Mock }
  let doctorRef: { findDoctorProfileForUser: jest.Mock }
  let auditService: { record: jest.Mock }
  let service: AiGenerationService

  const context = {
    text: '## PATIENT\nName: Ramesh Gupta',
    title: 'OPD encounter - Ramesh Gupta (MED-1)',
    doctorId: 'doctor_1',
    patientId: 'patient_1',
    encounterId: 'enc_1',
  }

  beforeEach(() => {
    prisma = {
      aiConversation: { create: jest.fn().mockResolvedValue({ id: 'conv_1' }) },
      aiMessage: { create: jest.fn() },
      aiUsageLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    }
    aiClient = {
      assertAvailable: jest.fn(),
      complete: jest.fn().mockResolvedValue({
        content: 'SUBJECTIVE: ...',
        provider: 'OPENAI',
        model: 'gpt-4o-mini',
        promptTokens: 100,
        completionTokens: 30,
        totalTokens: 130,
        tokensEstimated: false,
        estimatedCostUsd: 0,
        latencyMs: 900,
        attempts: 1,
      }),
      stream: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ provider: 'OPENAI', model: 'gpt-4o-mini' }),
      toHttpException: jest.fn().mockReturnValue(new ServiceUnavailableException('AI unavailable')),
    }
    contextService = { build: jest.fn().mockResolvedValue(context) }
    templates = {
      resolve: jest.fn().mockResolvedValue({
        systemPrompt: 'guardrails',
        userPromptTemplate: 'Draft:\n\n{{context}}\n\n{{additionalContext}}',
        description: '',
        version: 0,
        isBuiltIn: true,
      }),
    }
    permissionsService = { getScope: jest.fn().mockReturnValue('all') }
    doctorRef = { findDoctorProfileForUser: jest.fn() }
    auditService = { record: jest.fn().mockResolvedValue(undefined) }

    service = new AiGenerationService(
      prisma as never,
      aiClient as never,
      contextService as never,
      templates as never,
      permissionsService as never,
      doctorRef as never,
      auditService as never,
    )
  })

  const dto = { feature: 'SOAP_NOTE', encounterId: 'enc_1' } as never

  it('checks the feature flag before assembling context - a disabled feature must not read PHI', async () => {
    aiClient.assertAvailable.mockImplementation(() => {
      throw new ServiceUnavailableException('AI features are disabled for this deployment')
    })

    await expect(service.generate('org_1', user, dto)).rejects.toThrow(ServiceUnavailableException)
    expect(contextService.build).not.toHaveBeenCalled()
    expect(prisma.aiConversation.create).not.toHaveBeenCalled()
  })

  it('renders the prompt and opens a conversation with the system and user turns', async () => {
    await service.generate('org_1', user, dto)

    const created = prisma.aiConversation.create.mock.calls[0][0].data
    expect(created).toMatchObject({
      organizationId: 'org_1',
      feature: 'SOAP_NOTE',
      patientId: 'patient_1',
      encounterId: 'enc_1',
      createdByUserId: 'user_1',
    })
    const messages = created.messages.create
    expect(messages[0]).toMatchObject({ sequence: 0, role: 'SYSTEM', content: 'guardrails' })
    expect(messages[1].role).toBe('USER')
    expect(messages[1].content).toContain('## PATIENT')
  })

  it('returns the generated draft with usage, attempts and the clinical disclaimer', async () => {
    const result = await service.generate('org_1', user, dto)

    expect(result).toMatchObject({
      conversationId: 'conv_1',
      feature: 'SOAP_NOTE',
      content: 'SUBJECTIVE: ...',
      provider: 'OPENAI',
      attempts: 1,
    })
    expect(result.usage).toEqual({
      promptTokens: 100,
      completionTokens: 30,
      totalTokens: 130,
      estimated: false,
      estimatedCostUsd: 0,
    })
    expect(result.disclaimer).toContain('Review and edit before use')
  })

  it('audits the generation without copying the generated clinical text into the audit row', async () => {
    await service.generate('org_1', user, dto)

    const entry = auditService.record.mock.calls[0][0]
    expect(entry).toMatchObject({ action: 'generate', resource: 'AiConversation', resourceId: 'conv_1' })
    expect(JSON.stringify(entry.after)).not.toContain('SUBJECTIVE')
    expect(entry.after).toMatchObject({ feature: 'SOAP_NOTE', provider: 'OPENAI', totalTokens: 130 })
  })

  it('blocks an own-scoped doctor from generating against another doctor’s encounter', async () => {
    permissionsService.getScope.mockReturnValue('own')
    doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_2' })

    await expect(service.generate('org_1', user, dto)).rejects.toThrow(ForbiddenException)
    expect(aiClient.complete).not.toHaveBeenCalled()
  })

  it('allows an own-scoped doctor on their own encounter', async () => {
    permissionsService.getScope.mockReturnValue('own')
    doctorRef.findDoctorProfileForUser.mockResolvedValue({ id: 'doctor_1' })

    await expect(service.generate('org_1', user, dto)).resolves.toBeDefined()
  })

  it('records a FAILED usage row when the provider fails, so outages stay visible in reporting', async () => {
    aiClient.complete.mockRejectedValue(new AiProviderError('down', 'provider_unavailable', true))

    await expect(service.generate('org_1', user, dto)).rejects.toThrow(ServiceUnavailableException)

    const logged = prisma.aiUsageLog.create.mock.calls[0][0].data
    expect(logged).toMatchObject({
      status: 'FAILED',
      errorCode: 'provider_unavailable',
      conversationId: 'conv_1',
      feature: 'SOAP_NOTE',
    })
  })

  it('passes referral-letter fields into the rendered prompt', async () => {
    templates.resolve.mockResolvedValue({
      systemPrompt: 'guardrails',
      userPromptTemplate: 'To: {{referredToSpecialty}} / {{referredToName}}\nWhy: {{reason}}\n{{context}}',
      description: '',
      version: 0,
      isBuiltIn: true,
    })

    await service.generate('org_1', user, {
      feature: 'REFERRAL_LETTER',
      encounterId: 'enc_1',
      referredToSpecialty: 'Cardiology',
      reason: 'Persistent chest pain',
    } as never)

    const userMessage = prisma.aiConversation.create.mock.calls[0][0].data.messages.create[1].content
    expect(userMessage).toContain('To: Cardiology / Not specified')
    expect(userMessage).toContain('Why: Persistent chest pain')
  })

  it('streams deltas and only then writes the assistant turn and usage row', async () => {
    aiClient.stream.mockImplementation(function* () {
      yield { type: 'delta', text: 'SUB' }
      yield { type: 'delta', text: 'JECTIVE' }
      yield {
        type: 'outcome',
        outcome: {
          content: 'SUBJECTIVE',
          provider: 'OPENAI',
          model: 'gpt-4o-mini',
          promptTokens: 10,
          completionTokens: 3,
          totalTokens: 13,
          tokensEstimated: true,
          estimatedCostUsd: 0,
          latencyMs: 100,
          attempts: 1,
        },
      }
    })

    const events = []
    for await (const event of service.generateStream('org_1', user, dto)) {
      if (event.type === 'delta') expect(prisma.$transaction).not.toHaveBeenCalled()
      events.push(event)
    }

    expect(events.map((e) => e.type)).toEqual(['delta', 'delta', 'result'])
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  })
})
