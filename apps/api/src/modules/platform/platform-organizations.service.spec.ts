import { OrganizationStatus } from '@medicore/types'
import { BadRequestException, NotFoundException } from '@nestjs/common'

import { StorageUsageService } from '../../common/tenant/storage-usage.service'
import { PrismaService } from '../../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

import { PlatformOrganizationsService } from './platform-organizations.service'

function buildService(organization: unknown) {
  const auditService = { record: jest.fn().mockResolvedValue(undefined) }
  const storageUsage = { getTotalBytes: jest.fn().mockResolvedValue(0) }

  const prisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue(organization),
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
        ...(organization as Record<string, unknown>),
        ...data,
      })),
    },
  }

  const service = new PlatformOrganizationsService(
    prisma as unknown as PrismaService,
    auditService as unknown as AuditService,
    storageUsage as unknown as StorageUsageService,
  )

  return { service, prisma, auditService }
}

const CUSTOMER_ORG = {
  id: 'org_1',
  isPlatform: false,
  isActive: true,
  status: OrganizationStatus.ACTIVE,
  suspensionReason: null,
}

describe('PlatformOrganizationsService.suspend', () => {
  it('disables logins by clearing isActive, the switch auth already enforces', async () => {
    const { service, prisma } = buildService(CUSTOMER_ORG)

    await service.suspend('org_1', 'Non-payment', 'platform_user')

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrganizationStatus.SUSPENDED,
          isActive: false,
          suspensionReason: 'Non-payment',
        }),
      }),
    )
  })

  it('audits against the suspended tenant, not the platform tenant', async () => {
    const { service, auditService } = buildService(CUSTOMER_ORG)

    await service.suspend('org_1', 'Non-payment', 'platform_user')

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'platform_user',
        action: 'platform.organization_suspended',
      }),
    )
  })

  it('refuses to suspend the platform tenant itself', async () => {
    const { service } = buildService({ ...CUSTOMER_ORG, isPlatform: true })

    await expect(service.suspend('org_platform', 'oops', 'platform_user')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('throws when the organization does not exist', async () => {
    const { service } = buildService(null)

    await expect(service.suspend('missing', 'reason', 'platform_user')).rejects.toThrow(
      NotFoundException,
    )
  })
})

describe('PlatformOrganizationsService.reinstate', () => {
  it('clears the suspension and re-enables logins', async () => {
    const { service, prisma } = buildService({
      ...CUSTOMER_ORG,
      isActive: false,
      status: OrganizationStatus.SUSPENDED,
      suspensionReason: 'Non-payment',
    })

    await service.reinstate('org_1', 'platform_user')

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrganizationStatus.ACTIVE,
          isActive: true,
          suspendedAt: null,
          suspensionReason: null,
        }),
      }),
    )
  })
})

describe('PlatformOrganizationsService.setEnabled', () => {
  it('refuses to re-enable a suspended organization, so the reason is never lost', async () => {
    const { service } = buildService({
      ...CUSTOMER_ORG,
      isActive: false,
      status: OrganizationStatus.SUSPENDED,
      suspensionReason: 'Non-payment',
    })

    await expect(service.setEnabled('org_1', true, 'platform_user')).rejects.toThrow(
      BadRequestException,
    )
  })

  it('is a no-op when the flag already matches', async () => {
    const { service, prisma, auditService } = buildService(CUSTOMER_ORG)

    await service.setEnabled('org_1', true, 'platform_user')

    expect(prisma.organization.update).not.toHaveBeenCalled()
    expect(auditService.record).not.toHaveBeenCalled()
  })

  it('disables an active organization without recording it as a suspension', async () => {
    const { service, prisma, auditService } = buildService(CUSTOMER_ORG)

    await service.setEnabled('org_1', false, 'platform_user')

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    )
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'platform.organization_disabled' }),
    )
  })

  it('refuses to disable the platform tenant', async () => {
    const { service } = buildService({ ...CUSTOMER_ORG, isPlatform: true })

    await expect(service.setEnabled('org_platform', false, 'platform_user')).rejects.toThrow(
      BadRequestException,
    )
  })
})
