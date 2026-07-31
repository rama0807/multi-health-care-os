import { ConflictException, NotFoundException } from '@nestjs/common'

import { StaffOnboardingService } from './staff-onboarding.service'

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed') }))

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user_1',
    email: 'doctor@example.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    organizationId: 'org_1',
    ...overrides,
  }
}

describe('StaffOnboardingService', () => {
  let tx: {
    user: Record<string, jest.Mock>
    role: Record<string, jest.Mock>
    userRole: Record<string, jest.Mock>
  }
  let emailService: { send: jest.Mock }
  let configService: { get: jest.Mock }
  let service: StaffOnboardingService

  const params = {
    organizationId: 'org_1',
    hospitalId: 'hospital_1',
    email: 'doctor@example.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    phone: '9876543210',
    systemRole: 'DOCTOR' as const,
  }

  beforeEach(() => {
    tx = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      role: { findFirst: jest.fn().mockResolvedValue({ id: 'role_1', name: 'Doctor' }) },
      userRole: { findUnique: jest.fn(), create: jest.fn() },
    }
    emailService = { send: jest.fn().mockResolvedValue(undefined) }
    configService = { get: jest.fn().mockReturnValue('http://localhost:3000') }
    service = new StaffOnboardingService(emailService as never, configService as never)
  })

  afterEach(() => jest.clearAllMocks())

  describe('onboardUserInTransaction', () => {
    it('creates a new user + role assignment when no account exists', async () => {
      tx.user.findUnique.mockResolvedValue(null)
      tx.user.create.mockResolvedValue(buildUser())

      const result = await service.onboardUserInTransaction(tx as never, params)

      expect(result.created).toBe(true)
      expect(result.temporaryPassword).toBeDefined()
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: params.email,
            status: 'ACTIVE',
            isEmailVerified: true,
            userRoles: { create: [{ roleId: 'role_1', hospitalId: 'hospital_1' }] },
          }),
        }),
      )
    })

    it('throws NotFoundException when the organization has no role for that systemRole', async () => {
      tx.user.findUnique.mockResolvedValue(null)
      tx.role.findFirst.mockResolvedValue(null)

      await expect(service.onboardUserInTransaction(tx as never, params)).rejects.toThrow(NotFoundException)
    })

    it('links an existing same-organization user instead of creating a new one', async () => {
      tx.user.findUnique.mockResolvedValue(buildUser())
      tx.userRole.findUnique.mockResolvedValue(null)

      const result = await service.onboardUserInTransaction(tx as never, params)

      expect(result.created).toBe(false)
      expect(result.temporaryPassword).toBeUndefined()
      expect(tx.user.create).not.toHaveBeenCalled()
      expect(tx.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'user_1', roleId: 'role_1', hospitalId: 'hospital_1' },
      })
    })

    it('does not duplicate the role assignment when the user already holds it', async () => {
      tx.user.findUnique.mockResolvedValue(buildUser())
      tx.userRole.findUnique.mockResolvedValue({ userId: 'user_1', roleId: 'role_1' })

      const result = await service.onboardUserInTransaction(tx as never, params)

      expect(result.created).toBe(false)
      expect(tx.userRole.create).not.toHaveBeenCalled()
    })

    it('rejects when the email belongs to a user in a different organization', async () => {
      tx.user.findUnique.mockResolvedValue(buildUser({ organizationId: 'other_org' }))

      await expect(service.onboardUserInTransaction(tx as never, params)).rejects.toThrow(ConflictException)
    })
  })

  describe('sendOnboardingEmail', () => {
    it('sends the account-created template when the user was newly created', async () => {
      await service.sendOnboardingEmail({
        user: buildUser() as never,
        created: true,
        temporaryPassword: 'Temp1234',
        roleName: 'Doctor',
      })

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'doctor@example.com', subject: expect.stringContaining('created') }),
      )
    })

    it('sends the role-granted template when linking an existing user', async () => {
      await service.sendOnboardingEmail({
        user: buildUser() as never,
        created: false,
        roleName: 'Doctor',
      })

      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'doctor@example.com', subject: expect.stringContaining('Doctor') }),
      )
    })
  })
})
