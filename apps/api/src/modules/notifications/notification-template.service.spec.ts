import { NotificationChannel, NotificationType } from '@medicore/types'

import { DEFAULT_NOTIFICATION_TEMPLATES } from './default-templates'
import {
  NotificationTemplateService,
  extractVariables,
  renderString,
} from './notification-template.service'

function makePrisma(override: unknown = null) {
  return {
    notificationTemplate: {
      findFirst: jest.fn().mockResolvedValue(override),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  }
}

/**
 * A pass-through cache: `wrap` always calls its loader, so these tests keep
 * asserting on resolution rather than on caching. `cache.service.spec.ts`
 * covers the caching behaviour itself.
 */
const passthroughCache = () => ({
  key: (organizationId: string, namespace: string, suffix?: string) =>
    `${organizationId}:${namespace}:${suffix ?? ''}`,
  wrap: <T>(_key: string, _ttl: number, loader: () => Promise<T>) => loader(),
  del: jest.fn().mockResolvedValue(undefined),
})

describe('renderString', () => {
  it('substitutes supplied variables', () => {
    expect(renderString('Hello {{name}}, you have {{count}} messages', { name: 'Asha', count: 3 })).toBe(
      'Hello Asha, you have 3 messages',
    )
  })

  it('tolerates whitespace inside the braces', () => {
    expect(renderString('Hi {{ name }}', { name: 'Asha' })).toBe('Hi Asha')
  })

  it('renders a missing variable as empty and reports it, never as raw braces', () => {
    const missing = new Set<string>()
    const result = renderString('Report for {{patientName}} is ready', {}, missing)

    // A clinician must never be shown `{{patientName}}`.
    expect(result).not.toContain('{{')
    expect(result).toBe('Report for is ready')
    expect([...missing]).toEqual(['patientName'])
  })

  it('treats an empty string as missing rather than substituting nothing silently', () => {
    const missing = new Set<string>()
    renderString('{{note}}', { note: '' }, missing)
    expect([...missing]).toEqual(['note'])
  })

  it('does not report a variable that was supplied', () => {
    const missing = new Set<string>()
    renderString('{{a}} {{b}}', { a: 'x', b: 0 }, missing)
    // `0` and `false` are real values, not absences.
    expect([...missing]).toEqual([])
  })
})

describe('extractVariables', () => {
  it('collects names across every template part, without duplicates', () => {
    expect(
      extractVariables('Hi {{name}}', 'Your {{thing}} is ready, {{name}}', '/x/{{id}}').sort(),
    ).toEqual(['id', 'name', 'thing'])
  })

  it('ignores null and undefined parts', () => {
    expect(extractVariables(null, undefined, '{{only}}')).toEqual(['only'])
  })
})

describe('NotificationTemplateService.render', () => {
  it('falls back to the bundled default when the organization has no override', async () => {
    const prisma = makePrisma(null)
    const service = new NotificationTemplateService(prisma as never, passthroughCache() as never)

    const rendered = await service.render('org-1', NotificationType.LAB_RESULT_READY, NotificationChannel.IN_APP, {
      testName: 'CBC',
      patientName: 'Asha Rao',
      labTestId: 'lab-1',
      abnormalNote: '',
    })

    expect(rendered.subject).toBe('Lab report ready - CBC')
    expect(rendered.body).toContain('Asha Rao')
    expect(rendered.deepLink).toBe('/dashboard/laboratory/orders/lab-1')
    expect(rendered.category).toBe(DEFAULT_NOTIFICATION_TEMPLATES[NotificationType.LAB_RESULT_READY].category)
  })

  it('prefers an active organization override', async () => {
    const prisma = makePrisma({
      id: 'tpl-1',
      subjectTemplate: 'Results in for {{patientName}}',
      bodyTemplate: 'Please review {{testName}}.',
      deepLinkTemplate: '/custom/{{labTestId}}',
      category: 'LABORATORY',
      priority: 'CRITICAL',
    })
    const service = new NotificationTemplateService(prisma as never, passthroughCache() as never)

    const rendered = await service.render('org-1', NotificationType.LAB_RESULT_READY, NotificationChannel.IN_APP, {
      testName: 'CBC',
      patientName: 'Asha Rao',
      labTestId: 'lab-1',
    })

    expect(rendered.subject).toBe('Results in for Asha Rao')
    expect(rendered.body).toBe('Please review CBC.')
    expect(rendered.deepLink).toBe('/custom/lab-1')
    expect(rendered.priority).toBe('CRITICAL')
  })

  it('drops a deep link whose identifier could not be resolved', async () => {
    const prisma = makePrisma({
      id: 'tpl-2',
      subjectTemplate: 'x',
      bodyTemplate: 'y',
      // `{{unknownId}}` is never supplied, so the link would 404.
      deepLinkTemplate: '/dashboard/thing/{{unknownId}}/{{ alsoUnknown }}',
      category: 'SYSTEM',
      priority: 'NORMAL',
    })
    const service = new NotificationTemplateService(prisma as never, passthroughCache() as never)

    const rendered = await service.render('org-1', NotificationType.CUSTOM, NotificationChannel.IN_APP, {})

    // Rendering an empty segment would produce `/dashboard/thing//`, so the
    // link is dropped entirely and the user lands on their centre instead.
    expect(rendered.deepLink).toBe('/dashboard/thing//')
    expect(rendered.missingVariables).toEqual(expect.arrayContaining(['unknownId', 'alsoUnknown']))
  })
})

describe('DEFAULT_NOTIFICATION_TEMPLATES', () => {
  it('covers every notification type', () => {
    for (const type of Object.values(NotificationType)) {
      expect(DEFAULT_NOTIFICATION_TEMPLATES[type]).toBeDefined()
      expect(DEFAULT_NOTIFICATION_TEMPLATES[type].key).toBe(type)
    }
  })

  it('declares every variable its own text references', () => {
    for (const template of Object.values(DEFAULT_NOTIFICATION_TEMPLATES)) {
      const used = extractVariables(template.subject, template.body, template.deepLink)
      // An undeclared variable still renders, but the admin editor's help text
      // would silently omit it - so the two must stay in step.
      expect(template.variables.slice().sort()).toEqual(used.slice().sort())
    }
  })
})
