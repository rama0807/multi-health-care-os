import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationTemplate,
  NotificationType,
  RenderedTemplate,
  UpsertNotificationTemplateDto,
} from '@medicore/types'
import { Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, NotificationTemplate as PrismaNotificationTemplate } from '@prisma/client'

import { CacheService } from '../../common/redis/cache.service'
import { PrismaService } from '../../prisma/prisma.service'

import { DEFAULT_NOTIFICATION_TEMPLATES, DefaultNotificationTemplate } from './default-templates'

/** `{{ variableName }}` — whitespace tolerated, names limited to identifiers. */
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

export type TemplateVariables = Record<string, string | number | boolean | null | undefined>

const CACHE_NAMESPACE = 'notification-template'

/**
 * A ceiling, not the invalidation mechanism (Milestone 19.2) — publishing or
 * rolling back a version drops the entry immediately. The TTL only bounds how
 * long a stale entry could survive a Redis write that failed silently, and how
 * long a second API instance keeps its own copy of a template another instance
 * just changed.
 */
const CACHE_TTL_SECONDS = 300

/**
 * Notification templates (Checkpoint 18.1 / 18.6).
 *
 * Resolution order for a `(key, channel)` pair:
 *
 * 1. the organization's highest-version **active** override for that exact
 *    channel;
 * 2. otherwise the bundled default from `default-templates.ts`.
 *
 * Overrides are append-only and versioned, exactly like `AiPromptTemplate`:
 * editing a template changes what every future recipient reads, so the
 * previous wording stays recoverable rather than being overwritten. A
 * deactivated override falls back to the bundled default rather than
 * disabling the notification — silence would be the worse failure.
 */
@Injectable()
export class NotificationTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** One entry per (org, key, channel); dropped whenever a version changes. */
  private overrideCacheKey(organizationId: string, key: string, channel: NotificationChannel): string {
    return this.cache.key(organizationId, CACHE_NAMESPACE, `${key}:${channel}`)
  }

  /** Bundled default for a type. Always defined — the record is exhaustive. */
  getDefault(key: NotificationType): DefaultNotificationTemplate {
    return DEFAULT_NOTIFICATION_TEMPLATES[key]
  }

  /**
   * Resolves and renders in one step — the only method the dispatcher calls.
   * An override that fails to resolve is never an error: the bundled default
   * is used, because a template lookup must not be able to stop a clinical
   * notification from going out.
   */
  async render(
    organizationId: string,
    key: NotificationType,
    channel: NotificationChannel,
    variables: TemplateVariables,
  ): Promise<RenderedTemplate & { category: NotificationCategory; priority: NotificationPriority; icon: string }> {
    const override = await this.findActiveOverride(organizationId, key, channel)
    const fallback = this.getDefault(key)

    const subjectTemplate = override?.subjectTemplate ?? fallback.subject
    const bodyTemplate = override?.bodyTemplate ?? fallback.body
    const deepLinkTemplate = override?.deepLinkTemplate ?? fallback.deepLink

    const missing = new Set<string>()
    const subject = renderString(subjectTemplate, variables, missing)
    const body = renderString(bodyTemplate, variables, missing)
    const deepLink = deepLinkTemplate ? renderString(deepLinkTemplate, variables, missing) : null

    return {
      subject,
      body,
      // A deep link with an unresolved id would 404; dropping it lands the
      // user on their notification centre instead, which is always valid.
      deepLink: deepLink && !deepLink.includes('{{') ? deepLink : null,
      missingVariables: [...missing],
      category: (override?.category as NotificationCategory | undefined) ?? fallback.category,
      priority: (override?.priority as NotificationPriority | undefined) ?? fallback.priority,
      icon: fallback.icon,
    }
  }

  /** Preview for the admin editor — same code path as a real render. */
  async preview(
    organizationId: string,
    key: string,
    channel: NotificationChannel,
    variables: TemplateVariables,
  ): Promise<RenderedTemplate> {
    if (!isKnownType(key)) {
      const override = await this.findActiveOverride(organizationId, key, channel)
      if (!override) throw new NotFoundException(`No template found for "${key}" on ${channel}`)
      const missing = new Set<string>()
      return {
        subject: override.subjectTemplate ? renderString(override.subjectTemplate, variables, missing) : null,
        body: renderString(override.bodyTemplate, variables, missing),
        deepLink: override.deepLinkTemplate
          ? renderString(override.deepLinkTemplate, variables, missing)
          : null,
        missingVariables: [...missing],
      }
    }

    const rendered = await this.render(organizationId, key, channel, variables)
    return {
      subject: rendered.subject,
      body: rendered.body,
      deepLink: rendered.deepLink,
      missingVariables: rendered.missingVariables,
    }
  }

  /**
   * Every template an organization can see: its own overrides plus every
   * bundled default that has not been overridden, so the admin console shows
   * one complete catalogue rather than an empty list on a fresh tenant.
   */
  async list(organizationId: string, channel?: NotificationChannel): Promise<NotificationTemplate[]> {
    const rows = await this.prisma.notificationTemplate.findMany({
      where: { organizationId, ...(channel ? { channel } : {}) },
      orderBy: [{ key: 'asc' }, { channel: 'asc' }, { version: 'desc' }],
    })

    // Highest version wins per (key, channel) — the rest stay available
    // through `listVersions`.
    const latest = new Map<string, PrismaNotificationTemplate>()
    for (const row of rows) {
      const id = `${row.key}::${row.channel}`
      if (!latest.has(id)) latest.set(id, row)
    }

    const overrides = [...latest.values()].map((row) => this.toResponse(row))
    const overriddenKeys = new Set(overrides.map((o) => `${o.key}::${o.channel}`))

    const defaults: NotificationTemplate[] = []
    for (const template of Object.values(DEFAULT_NOTIFICATION_TEMPLATES)) {
      for (const ch of channelsFor(channel)) {
        if (overriddenKeys.has(`${template.key}::${ch}`)) continue
        defaults.push(this.defaultToResponse(template, ch))
      }
    }

    return [...overrides, ...defaults].sort(
      (a, b) => a.key.localeCompare(b.key) || a.channel.localeCompare(b.channel),
    )
  }

  /** Full version history for one `(key, channel)` pair. */
  async listVersions(
    organizationId: string,
    key: string,
    channel: NotificationChannel,
  ): Promise<NotificationTemplate[]> {
    const rows = await this.prisma.notificationTemplate.findMany({
      where: { organizationId, key, channel },
      orderBy: { version: 'desc' },
    })
    return rows.map((row) => this.toResponse(row))
  }

  /** Creates the next version. Never updates a row in place. */
  async upsert(
    organizationId: string,
    dto: UpsertNotificationTemplateDto,
    userId?: string,
  ): Promise<NotificationTemplate> {
    const latest = await this.prisma.notificationTemplate.findFirst({
      where: { organizationId, key: dto.key, channel: dto.channel },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const row = await this.prisma.notificationTemplate.create({
      data: {
        organizationId,
        key: dto.key,
        channel: dto.channel,
        version: (latest?.version ?? 0) + 1,
        name: dto.name,
        description: dto.description ?? null,
        category: dto.category,
        priority: dto.priority,
        subjectTemplate: dto.subjectTemplate ?? null,
        bodyTemplate: dto.bodyTemplate,
        deepLinkTemplate: dto.deepLinkTemplate ?? null,
        variables: declaredVariables(dto) as Prisma.InputJsonValue,
        isActive: dto.isActive,
        createdByUserId: userId ?? null,
      },
    })

    // A new active version must take effect on the next notification, not
    // whenever a TTL happens to lapse (Milestone 19.2).
    await this.cache.del(this.overrideCacheKey(organizationId, dto.key, dto.channel))

    return this.toResponse(row)
  }

  /**
   * Activates or deactivates one version. Deactivating the active version is
   * how an organization reverts to the bundled default; activating an older
   * version is how it rolls back.
   */
  async setActive(organizationId: string, id: string, isActive: boolean): Promise<NotificationTemplate> {
    const existing = await this.prisma.notificationTemplate.findFirst({ where: { id, organizationId } })
    if (!existing) throw new NotFoundException('Notification template not found')

    if (isActive) {
      // Exactly one active version per (key, channel), so resolution is
      // deterministic rather than "highest version that happens to be active".
      await this.prisma.notificationTemplate.updateMany({
        where: { organizationId, key: existing.key, channel: existing.channel, NOT: { id } },
        data: { isActive: false },
      })
    }

    const row = await this.prisma.notificationTemplate.update({ where: { id }, data: { isActive } })

    await this.cache.del(
      this.overrideCacheKey(organizationId, existing.key, existing.channel as NotificationChannel),
    )

    return this.toResponse(row)
  }

  /**
   * Cached (Milestone 19.2). This runs once **per channel per notification** —
   * a single lab-result alert to a doctor with three channels enabled is three
   * identical queries — while the answer only changes when an administrator
   * publishes or rolls back a version, which is exactly when it is dropped.
   *
   * Most organizations never override a template at all, so the common result
   * is `null`; caching that is the point, since a miss is otherwise the most
   * frequently repeated query in the notification path.
   */
  private async findActiveOverride(
    organizationId: string,
    key: string,
    channel: NotificationChannel,
  ): Promise<PrismaNotificationTemplate | null> {
    return this.cache.wrap(
      this.overrideCacheKey(organizationId, key, channel),
      CACHE_TTL_SECONDS,
      () =>
        this.prisma.notificationTemplate.findFirst({
          where: { organizationId, key, channel, isActive: true },
          orderBy: { version: 'desc' },
        }),
    )
  }

  private toResponse(row: PrismaNotificationTemplate): NotificationTemplate {
    return {
      id: row.id,
      organizationId: row.organizationId,
      key: row.key,
      channel: row.channel as NotificationChannel,
      version: row.version,
      name: row.name,
      description: row.description,
      category: row.category as NotificationCategory,
      priority: row.priority as NotificationPriority,
      subjectTemplate: row.subjectTemplate,
      bodyTemplate: row.bodyTemplate,
      deepLinkTemplate: row.deepLinkTemplate,
      variables: Array.isArray(row.variables) ? (row.variables as string[]) : [],
      isActive: row.isActive,
      isDefault: false,
      updatedAt: row.updatedAt.toISOString(),
    }
  }

  private defaultToResponse(
    template: DefaultNotificationTemplate,
    channel: NotificationChannel,
  ): NotificationTemplate {
    return {
      id: null,
      organizationId: null,
      key: template.key,
      channel,
      version: 0,
      name: template.name,
      description: null,
      category: template.category,
      priority: template.priority,
      subjectTemplate: template.subject,
      bodyTemplate: template.body,
      deepLinkTemplate: template.deepLink,
      variables: template.variables,
      isActive: true,
      isDefault: true,
      updatedAt: null,
    }
  }
}

/**
 * Substitutes `{{name}}` placeholders. A variable with no supplied value is
 * replaced with an empty string and recorded in `missing` — leaving the raw
 * `{{name}}` in a message a clinician reads would be worse than a gap, and
 * throwing would suppress the notification entirely.
 */
export function renderString(
  template: string,
  variables: TemplateVariables,
  missing?: Set<string>,
): string {
  return template
    .replace(VARIABLE_PATTERN, (_match, name: string) => {
      const value = variables[name]
      if (value === undefined || value === null || value === '') {
        missing?.add(name)
        return ''
      }
      return String(value)
    })
    // Collapse the double spaces an empty substitution leaves behind.
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** Variable names a template body actually references. */
export function extractVariables(...templates: Array<string | null | undefined>): string[] {
  const found = new Set<string>()
  for (const template of templates) {
    if (!template) continue
    for (const match of template.matchAll(VARIABLE_PATTERN)) found.add(match[1])
  }
  return [...found]
}

function declaredVariables(dto: UpsertNotificationTemplateDto): string[] {
  return extractVariables(dto.subjectTemplate, dto.bodyTemplate, dto.deepLinkTemplate)
}

function isKnownType(key: string): key is NotificationType {
  return key in DEFAULT_NOTIFICATION_TEMPLATES
}

function channelsFor(channel?: NotificationChannel): NotificationChannel[] {
  return channel ? [channel] : [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
}
