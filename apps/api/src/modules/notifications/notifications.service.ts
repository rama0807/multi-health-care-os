import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  SendNotificationDto,
} from '@medicore/types'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { Prisma, SystemRole } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'

import { NotificationQueueService } from './notification-queue.service'
import { NotificationTemplateService, TemplateVariables } from './notification-template.service'

/**
 * Default channel set per priority. Every notification is written to the
 * in-app centre — that is the durable record — and the louder transports are
 * added as priority rises. A caller may override this per send, but the
 * default deliberately does not email at `NORMAL`: an inbox that fills with
 * routine operational traffic gets muted wholesale, which loses the critical
 * messages too.
 */
const DEFAULT_CHANNELS: Record<NotificationPriority, NotificationChannel[]> = {
  [NotificationPriority.CRITICAL]: [
    NotificationChannel.IN_APP,
    NotificationChannel.PUSH,
    NotificationChannel.EMAIL,
  ],
  [NotificationPriority.HIGH]: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
  [NotificationPriority.NORMAL]: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
  [NotificationPriority.LOW]: [NotificationChannel.IN_APP],
  [NotificationPriority.SILENT]: [NotificationChannel.IN_APP],
}

/** What an event listener hands over. Everything else is derived. */
export interface NotifyInput {
  organizationId: string
  hospitalId?: string | null
  type: NotificationType
  /** Staff recipients. Duplicates are collapsed; empty is not an error. */
  recipientIds?: string[]
  /**
   * Resolve additional recipients by role. Matched against `Role.systemRole`
   * first and `Role.name` second, so both `'DOCTOR'` and a custom role name
   * work.
   */
  roles?: string[]
  patientId?: string | null
  /** Substituted into the template. Missing values render as empty, not `{{x}}`. */
  variables?: TemplateVariables
  channels?: NotificationChannel[]
  priority?: NotificationPriority
  category?: NotificationCategory
  /** Future-dated dispatch; the scheduler releases it when it comes due. */
  scheduleAt?: Date | null
  /**
   * Idempotency handle, scoped per recipient. Two events describing the same
   * fact produce one notification.
   */
  eventKey?: string
  /** Overrides the template's rendered deep link. */
  deepLink?: string | null
  imageUrl?: string | null
  /** Overrides the rendered title/body — used by the admin broadcast path. */
  title?: string
  body?: string
}

export interface NotifyResult {
  created: number
  /** Notifications skipped because an identical `eventKey` already existed. */
  duplicates: number
  notificationIds: string[]
}

/**
 * The one entry point every module uses to notify someone (Milestone 18 /
 * ADR-0027).
 *
 * Callers describe *what happened and to whom*; this service resolves
 * recipients, renders the template, writes the notification, and enqueues one
 * delivery per channel. Nothing is sent inline — dispatch is always the
 * worker's job, so an event listener can never be slowed down (or made to
 * fail) by a provider outage.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: NotificationTemplateService,
    private readonly queue: NotificationQueueService,
  ) {}

  /**
   * Fans one event out to every resolved recipient. Never throws on a
   * per-recipient problem — a notification failure must not roll back the
   * clinical or billing action that triggered it.
   */
  async notify(input: NotifyInput): Promise<NotifyResult> {
    const recipientIds = await this.resolveRecipients(input)
    const result: NotifyResult = { created: 0, duplicates: 0, notificationIds: [] }

    if (recipientIds.length === 0 && !input.patientId) {
      this.logger.debug(`No recipients resolved for ${input.type}; nothing to notify`)
      return result
    }

    const template = this.templates.getDefault(input.type)
    const category = input.category ?? template.category
    const priority = input.priority ?? template.priority
    const channels = this.resolveChannels(priority, input.channels)
    const scheduleAt = input.scheduleAt ?? null
    const availableAt = scheduleAt ?? new Date()

    // Rendered once per organization, not once per recipient: the template is
    // org-scoped and the variables are the same for everyone on this event.
    const rendered = await this.templates.render(
      input.organizationId,
      input.type,
      NotificationChannel.IN_APP,
      input.variables ?? {},
    )

    // A patient-addressed message has no user row; it is represented by one
    // notification with `recipientId: null`.
    const targets: Array<string | null> = recipientIds.length > 0 ? recipientIds : [null]

    for (const recipientId of targets) {
      const created = await this.createOne({
        input,
        recipientId,
        category,
        priority,
        title: input.title ?? rendered.subject ?? template.name,
        body: input.body ?? rendered.body,
        deepLink: input.deepLink ?? rendered.deepLink,
        icon: rendered.icon,
        scheduleAt,
      })

      if (!created) {
        result.duplicates += 1
        continue
      }

      await this.queue.enqueue(created.id, input.organizationId, channels, availableAt)
      result.created += 1
      result.notificationIds.push(created.id)
    }

    return result
  }

  /**
   * The human-composed broadcast path (Checkpoint 18.6). Unlike `notify`, this
   * one *does* throw — an admin who addressed nobody deserves an error rather
   * than a silent success.
   */
  async send(
    organizationId: string,
    dto: SendNotificationDto,
    actorUserId?: string,
  ): Promise<NotifyResult> {
    const scheduleAt = dto.scheduleAt ? new Date(dto.scheduleAt) : null
    if (scheduleAt && scheduleAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('scheduleAt is in the past')
    }

    const result = await this.notify({
      organizationId,
      hospitalId: dto.hospitalId ?? null,
      type: NotificationType.CUSTOM,
      recipientIds: dto.recipientIds,
      roles: dto.roleSlugs,
      category: dto.category,
      priority: dto.priority,
      channels: dto.channels,
      scheduleAt,
      deepLink: dto.deepLink ?? null,
      imageUrl: dto.imageUrl ?? null,
      title: dto.title,
      body: dto.body,
      variables: { title: dto.title, body: dto.body, ...(dto.payload as TemplateVariables) },
      eventKey: undefined,
    })

    if (result.created === 0) {
      throw new BadRequestException(
        'No recipients matched — check the selected users and roles belong to this organization',
      )
    }

    this.logger.log(
      `User ${actorUserId ?? 'system'} sent a ${dto.priority} notification to ${result.created} recipient(s)`,
    )
    return result
  }

  /** Cancels a scheduled notification before it is released. */
  async cancelScheduled(organizationId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, organizationId },
      select: { id: true, deliveryStatus: true },
    })
    if (!notification) throw new BadRequestException('Notification not found')
    if (notification.deliveryStatus !== NotificationStatus.SCHEDULED) {
      throw new BadRequestException('Only a scheduled notification can be cancelled')
    }

    await this.queue.cancel(notification.id)
    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { deliveryStatus: NotificationStatus.CANCELLED, scheduleAt: null },
    })
  }

  private async createOne(args: {
    input: NotifyInput
    recipientId: string | null
    category: NotificationCategory
    priority: NotificationPriority
    title: string
    body: string
    deepLink: string | null
    icon: string
    scheduleAt: Date | null
  }): Promise<{ id: string } | null> {
    const { input, recipientId, scheduleAt } = args

    const data: Prisma.NotificationUncheckedCreateInput = {
      organizationId: input.organizationId,
      hospitalId: input.hospitalId ?? null,
      recipientId,
      patientId: input.patientId ?? null,
      type: input.type,
      category: args.category,
      priority: args.priority,
      title: args.title,
      body: args.body,
      icon: args.icon,
      imageUrl: input.imageUrl ?? null,
      deepLink: args.deepLink,
      payload: (input.variables ?? {}) as Prisma.InputJsonValue,
      scheduleAt,
      deliveryStatus: scheduleAt ? NotificationStatus.SCHEDULED : NotificationStatus.PENDING,
      // `eventKey` is unique per recipient. Only set it when a recipient
      // exists — a null recipient would make every patient-addressed
      // notification for the same event collide.
      eventKey: recipientId && input.eventKey ? input.eventKey : null,
    }

    try {
      return await this.prisma.notification.create({ data, select: { id: true } })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        input.eventKey
      ) {
        // Exactly what the idempotency key is for — the event fired twice.
        return null
      }
      throw error
    }
  }

  private resolveChannels(
    priority: NotificationPriority,
    requested?: NotificationChannel[],
  ): NotificationChannel[] {
    const channels = requested?.length ? [...new Set(requested)] : DEFAULT_CHANNELS[priority]
    // The in-app record is not optional: it is what the notification centre
    // reads, and a notification nobody can find later is not a notification.
    return channels.includes(NotificationChannel.IN_APP)
      ? channels
      : [NotificationChannel.IN_APP, ...channels]
  }

  /** Union of explicit recipients and role-resolved ones, tenant-scoped. */
  private async resolveRecipients(input: NotifyInput): Promise<string[]> {
    const ids = new Set<string>()

    if (input.recipientIds?.length) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: [...new Set(input.recipientIds)] }, organizationId: input.organizationId },
        select: { id: true },
      })
      for (const user of users) ids.add(user.id)
    }

    if (input.roles?.length) {
      const wanted = input.roles.map((role) => role.trim()).filter(Boolean)
      // Only genuine `SystemRole` members may reach the enum filter — an
      // arbitrary string there is a Prisma validation error, not a no-match.
      const systemRoles = wanted.filter((role): role is SystemRole => role.toUpperCase() in SystemRole)
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          role: {
            organizationId: input.organizationId,
            OR: [
              ...(systemRoles.length
                ? [{ systemRole: { in: systemRoles.map((r) => r.toUpperCase() as SystemRole) } }]
                : []),
              { name: { in: wanted, mode: 'insensitive' as const } },
            ],
          },
          // Restrict a hospital-specific event to that hospital's staff when
          // the role assignment names one; org-wide assignments always match.
          ...(input.hospitalId ? { OR: [{ hospitalId: input.hospitalId }, { hospitalId: null }] } : {}),
        },
        select: { userId: true },
      })
      for (const userRole of userRoles) ids.add(userRole.userId)
    }

    // Never notify a deactivated account.
    if (ids.size === 0) return []
    const active = await this.prisma.user.findMany({
      where: { id: { in: [...ids] }, status: { not: 'INACTIVE' } },
      select: { id: true },
    })
    return active.map((user) => user.id)
  }
}
