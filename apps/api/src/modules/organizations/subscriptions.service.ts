import { SubscriptionStatus, SubscriptionSummary, UpsertSubscriptionDto } from '@medicore/types'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Subscription } from '@prisma/client'

import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

/**
 * Subscription management (Checkpoint 16.1 read / 16.2 write).
 *
 * Deliberately split by direction: an organization admin may **read** their
 * own subscription from the Organization Dashboard, but only the Platform
 * Owner may change a plan or a limit. That mirrors `billing.manage`'s
 * requester/approver separation — a tenant cannot grant itself a bigger quota.
 *
 * There is no payment-gateway integration anywhere in this repo, so a plan
 * change here records the commercial agreement; it does not charge anyone.
 * See TECH_DEBT TD-0048.
 */
@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findForOrganization(organizationId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { organizationId } })
  }

  /**
   * Falls back to the organization's pre-existing `subscriptionTier` column
   * when no `Subscription` row exists yet, so organizations created before this
   * milestone still report a truthful plan instead of an empty panel.
   */
  async getSummary(organizationId: string): Promise<SubscriptionSummary> {
    const [subscription, org] = await Promise.all([
      this.findForOrganization(organizationId),
      this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { subscriptionTier: true, subscriptionExpiresAt: true, createdAt: true },
      }),
    ])

    if (!org) throw new NotFoundException('Organization not found')

    if (!subscription) {
      const expired = !!org.subscriptionExpiresAt && org.subscriptionExpiresAt < new Date()
      return {
        // Prisma's enums are string-literal unions; `@medicore/types` declares
        // them as TypeScript enums. Structurally identical, nominally
        // distinct — cast at the Prisma boundary, this repo's existing idiom.
        plan: org.subscriptionTier as unknown as SubscriptionSummary['plan'],
        status: expired ? SubscriptionStatus.EXPIRED : SubscriptionStatus.ACTIVE,
        startsAt: org.createdAt,
        endsAt: org.subscriptionExpiresAt,
        maxHospitals: null,
        maxUsers: null,
        maxPatients: null,
        storageQuotaMb: null,
        monthlyPrice: null,
        currency: 'INR',
        notes: null,
      }
    }

    return toSummary(subscription)
  }

  /**
   * Creates or replaces the organization's subscription. Platform-owner only.
   * `Organization.subscriptionTier`/`subscriptionExpiresAt` are kept in sync so
   * the pre-existing columns earlier milestones may read never disagree with
   * the new table.
   */
  async upsert(
    organizationId: string,
    dto: UpsertSubscriptionDto,
    actorUserId: string,
  ): Promise<SubscriptionSummary> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } })
    if (!org) throw new NotFoundException('Organization not found')

    const startsAt = dto.startsAt ?? new Date()
    if (dto.endsAt && dto.endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt')
    }

    const before = await this.findForOrganization(organizationId)

    const data = {
      plan: dto.plan,
      status: dto.status ?? SubscriptionStatus.ACTIVE,
      startsAt,
      endsAt: dto.endsAt ?? null,
      maxHospitals: dto.maxHospitals ?? null,
      maxUsers: dto.maxUsers ?? null,
      maxPatients: dto.maxPatients ?? null,
      storageQuotaMb: dto.storageQuotaMb ?? null,
      monthlyPrice: dto.monthlyPrice ?? null,
      currency: dto.currency ?? 'INR',
      notes: dto.notes ?? null,
    }

    const subscription = await this.prisma.$transaction(async (tx) => {
      const row = await tx.subscription.upsert({
        where: { organizationId },
        create: { organizationId, ...data },
        update: data,
      })

      await tx.organization.update({
        where: { id: organizationId },
        data: { subscriptionTier: data.plan, subscriptionExpiresAt: data.endsAt },
      })

      return row
    })

    await this.auditService.record({
      organizationId,
      userId: actorUserId,
      action: before ? 'subscription.updated' : 'subscription.created',
      resource: 'Subscription',
      resourceId: subscription.id,
      before: before ? toSummary(before) : undefined,
      after: toSummary(subscription),
    })

    return toSummary(subscription)
  }
}

function toSummary(subscription: Subscription): SubscriptionSummary {
  return {
    plan: subscription.plan as unknown as SubscriptionSummary['plan'],
    status: subscription.status as unknown as SubscriptionSummary['status'],
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    maxHospitals: subscription.maxHospitals,
    maxUsers: subscription.maxUsers,
    maxPatients: subscription.maxPatients,
    storageQuotaMb: subscription.storageQuotaMb,
    monthlyPrice: subscription.monthlyPrice ? subscription.monthlyPrice.toString() : null,
    currency: subscription.currency,
    notes: subscription.notes,
  }
}
