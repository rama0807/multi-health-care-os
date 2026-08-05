import { AiPromptTemplatesService } from './ai-prompt-templates.service'
import { DEFAULT_PROMPT_TEMPLATES } from './prompts/default-prompts'
import { renderPromptTemplate } from './prompts/render'

describe('AiPromptTemplatesService', () => {
  let prisma: { aiPromptTemplate: Record<string, jest.Mock>; $transaction: jest.Mock }
  let service: AiPromptTemplatesService

  beforeEach(() => {
    prisma = {
      aiPromptTemplate: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(prisma)),
    }
    service = new AiPromptTemplatesService(prisma as never)
  })

  it('falls back to the bundled default when the org has no override — an empty table still works', async () => {
    const resolved = await service.resolve('org_1', 'SOAP_NOTE')

    expect(resolved.isBuiltIn).toBe(true)
    expect(resolved.version).toBe(0)
    expect(resolved.systemPrompt).toBe(DEFAULT_PROMPT_TEMPLATES.SOAP_NOTE.systemPrompt)
  })

  it('prefers the highest active org override over the default', async () => {
    prisma.aiPromptTemplate.findFirst.mockResolvedValue({
      systemPrompt: 'org guardrails',
      userPromptTemplate: 'org template',
      description: null,
      version: 3,
    })

    const resolved = await service.resolve('org_1', 'SOAP_NOTE')
    expect(resolved).toMatchObject({ isBuiltIn: false, version: 3, systemPrompt: 'org guardrails' })
    expect(prisma.aiPromptTemplate.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org_1', feature: 'SOAP_NOTE', isActive: true },
      orderBy: { version: 'desc' },
    })
  })

  it('adds a new version and deactivates the previous one rather than editing in place', async () => {
    prisma.aiPromptTemplate.findFirst.mockResolvedValue({ version: 2 })
    prisma.aiPromptTemplate.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
      id: 't1',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }))

    const created = await service.createVersion('org_1', 'user_1', {
      feature: 'SOAP_NOTE',
      systemPrompt: 's',
      userPromptTemplate: 'u',
    })

    expect(prisma.aiPromptTemplate.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1', feature: 'SOAP_NOTE', isActive: true },
      data: { isActive: false },
    })
    expect(created.version).toBe(3)
    expect(created.isActive).toBe(true)
  })

  it('every bundled default carries the shared clinical guardrails', () => {
    for (const template of Object.values(DEFAULT_PROMPT_TEMPLATES)) {
      expect(template.systemPrompt).toContain('Use ONLY the information present in the supplied patient record context')
      expect(template.systemPrompt).toContain('Never invent findings')
    }
  })
})

describe('renderPromptTemplate', () => {
  it('substitutes placeholders literally', () => {
    expect(renderPromptTemplate('Hello {{name}}, re {{topic}}', { name: 'Dr Rao', topic: 'labs' })).toBe(
      'Hello Dr Rao, re labs',
    )
  })

  it('collapses an unsupplied placeholder rather than leaking the marker', () => {
    expect(renderPromptTemplate('A {{missing}} B', {})).toBe('A  B')
  })

  it('does not recursively expand placeholders present in a substituted value', () => {
    expect(renderPromptTemplate('{{a}}', { a: '{{b}}', b: 'nested' })).toBe('{{b}}')
  })
})
