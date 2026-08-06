import { SubscriptionStatus, SubscriptionTier } from '@medicore/types'
import { BadRequestException, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

import { SubscriptionsService } from './subscriptions.service'

function buildService(overrides: {
  subscription?: unknown
  organization?: unknown
  upsertResult?: unknown
}) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) }

  const prisma = {
    subscription: {
      findUnique: jest.fn().mockResolvedValue(overrides.subscription ?? null),
    },
    organization: {
      findUnique: jest.fn().mockResolvedValue(overrides.organization ?? null),
      update: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({
        subscription: { upsert: jest.fn().mockResolvedValue(overrides.upsertResult ?? null) },
        organization: { update: jest.fn().mockResolvedValue(undefined) },
      }),
    ),
  }

  const service = new SubscriptionsService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
  )

  return { service, prisma, auditService }
}

const SUBSCRIPTION_ROW = {
  id: 'sub_1',
  organizationId: 'org_1',
  plan: 'PROFESSIONAL',
  status: 'ACTIVE',
  startsAt: new Date('2026-01-01T00:00:00.000Z'),
  endsAt: new Date('2027-01-01T00:00:00.000Z'),
  maxHospitals: 5,
  maxUsers: 100,
  maxPatients: null,
  storageQuotaMb: 10_240,
  monthlyPrice: { toString: () => '4999.00' },
  currency: 'INR',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('SubscriptionsService.getSummary', () => {
  it('returns the subscription row when one exists', async () => {
    const { service } = buildService({
      subscription: SUBSCRIPTION_ROW,
      organization: {
        subscriptionTier: 'FREE',
        subscriptionExpiresAt: null,
        createdAt: new Date(),
      },
    })

    const summary = await service.getSummary('org_1')

    expect(summary.plan).toBe(SubscriptionTier.PROFESSIONAL)
    expect(summary.maxUsers).toBe(100)
    // Decimal is serialised as a string so no precision is lost over JSON.
    expect(summary.monthlyPrice).toBe('4999.00')
  })

  it('falls back to the organization tier for a pre-Milestone-16 organization', async () => {
    const { service } = buildService({
      subscription: null,
      organization: {
        subscriptionTier: 'STARTER',
        subscriptionExpiresAt: null,
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    })

    const summary = await service.getSummary('org_1')

    expect(summary.plan).toBe(SubscriptionTier.STARTER)
    expect(summary.status).toBe(SubscriptionStatus.ACTIVE)
    // No row means no negotiated limits - reported as unlimited, not as zero.
    expect(summary.maxUsers).toBeNull()
    expect(summary.storageQuotaMb).toBeNull()
  })

  it('reports EXPIRED when the fallback expiry is in the past', async () => {
    const { service } = buildService({
      subscription: null,
      organization: {
        subscriptionTier: 'STARTER',
        subscriptionExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
        createdAt: new Date('2019-01-01T00:00:00.000Z'),
      },
    })

    expect((await service.getSummary('org_1')).status).toBe(SubscriptionStatus.EXPIRED)
  })

  it('throws when the organization does not exist', async () => {
    const { service } = buildService({ subscription: null, organization: null })
    await expect(service.getSummary('missing')).rejects.toThrow(NotFoundException)
  })
})

describe('SubscriptionsService.upsert', () => {
  it('rejects an end date that is not after the start date', async () => {
    const { service } = buildService({ organization: { id: 'org_1' }, subscription: null })

    await expect(
      service.upsert(
        'org_1',
        {
          plan: SubscriptionTier.PROFESSIONAL,
          startsAt: new Date('2026-06-01T00:00:00.000Z'),
          endsAt: new Date('2026-05-01T00:00:00.000Z'),
        },
        'actor_1',
      ),
    ).rejects.toThrow(BadRequestException)
  })

  it('writes an audit entry against the target organization', async () => {
    const { service, auditService } = buildService({
      organization: { id: 'org_1' },
      subscription: null,
      upsertResult: SUBSCRIPTION_ROW,
    })

    await service.upsert('org_1', { plan: SubscriptionTier.PROFESSIONAL }, 'actor_1')

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'actor_1',
        action: 'subscription.created',
        resource: 'Subscription',
      }),
    )
  })

  it('records an update rather than a creation when a row already existed', async () => {
    const { service, auditService } = buildService({
      organization: { id: 'org_1' },
      subscription: SUBSCRIPTION_ROW,
      upsertResult: SUBSCRIPTION_ROW,
    })

    await service.upsert('org_1', { plan: SubscriptionTier.ENTERPRISE }, 'actor_1')

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'subscription.updated' }),
    )
  })

  it('throws when the organization does not exist', async () => {
    const { service } = buildService({ organization: null })

    await expect(
      service.upsert('missing', { plan: SubscriptionTier.FREE }, 'actor_1'),
    ).rejects.toThrow(NotFoundException)
  })
})
