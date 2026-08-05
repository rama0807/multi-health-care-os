import { UserStatus } from '@medicore/types'
import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import * as argon2 from 'argon2'


import { AuthService } from './auth.service'

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn(),
}))

const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' }

function buildUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user_1',
    email: 'doctor@example.com',
    firstName: 'Test',
    lastName: 'User',
    avatar: null,
    passwordHash: 'hashed-password',
    status: UserStatus.ACTIVE,
    failedLoginAttempts: 0,
    lockedUntil: null,
    organizationId: 'org_1',
    organization: { id: 'org_1', slug: 'org-1', isActive: true },
    ...overrides,
  }
}

describe('AuthService', () => {
  let prisma: {
    organization: Record<string, jest.Mock>
    user: Record<string, jest.Mock>
  }
  let jwtService: { sign: jest.Mock }
  let eventEmitter: { emit: jest.Mock }
  let rolesService: { resolveAuthContext: jest.Mock; createDefaultOrgAdminRole: jest.Mock }
  let sessionsService: {
    createSession: jest.Mock
    rotateSession: jest.Mock
    revokeSession: jest.Mock
    revokeAllSessions: jest.Mock
    revokeAllSessionsExcept: jest.Mock
    listSessions: jest.Mock
  }
  let tokensService: Record<string, jest.Mock>
  let emailService: { send: jest.Mock }
  let authService: AuthService

  beforeEach(() => {
    prisma = {
      organization: { findUnique: jest.fn(), create: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    }
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') }
    eventEmitter = { emit: jest.fn() }
    rolesService = {
      resolveAuthContext: jest.fn().mockResolvedValue({ roles: [], permissions: [], hospitalIds: [] }),
      createDefaultOrgAdminRole: jest.fn().mockResolvedValue({ id: 'role_1' }),
    }
    sessionsService = {
      createSession: jest
        .fn()
        .mockResolvedValue({ sessionId: 'sess_1', refreshToken: 'refresh-token', ttlSeconds: 86400 }),
      rotateSession: jest.fn(),
      revokeSession: jest.fn(),
      revokeAllSessions: jest.fn(),
      revokeAllSessionsExcept: jest.fn(),
      listSessions: jest.fn(),
    }
    tokensService = {
      issueEmailVerificationToken: jest.fn().mockResolvedValue('verify-token'),
      issuePasswordResetToken: jest.fn().mockResolvedValue('reset-token'),
      consumePasswordResetToken: jest.fn(),
      consumeEmailVerificationToken: jest.fn(),
    }
    emailService = { send: jest.fn().mockResolvedValue(undefined) }

    // Runs the scheduled work inline, so these tests still observe the send.
    const background = { run: (_job: string, work: () => Promise<unknown>) => void work() }

    authService = new AuthService(
      prisma as never,
      background as never,
      jwtService as never,
      eventEmitter as never,
      rolesService as never,
      sessionsService as never,
      tokensService as never,
      emailService as never,
    )
  })

  afterEach(() => jest.clearAllMocks())

  describe('login', () => {
    it('signs a token and emits auth.login on success', async () => {
      const user = buildUser()
      prisma.user.findUnique.mockResolvedValue(user)
      ;(argon2.verify as jest.Mock).mockResolvedValue(true)

      const result = await authService.login({ email: user.email, password: 'correct' } as never, meta)

      expect(result.accessToken).toBe('signed.jwt.token')
      expect(result.refreshToken).toBe('refresh-token')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.login',
        expect.objectContaining({ userId: 'user_1' }),
      )
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ failedLoginAttempts: 0 }) }),
      )
    })

    it('rejects unknown emails without leaking existence', async () => {
      prisma.user.findUnique.mockResolvedValue(null)

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'x' } as never, meta),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('rejects and records a failed attempt on wrong password', async () => {
      const user = buildUser({ failedLoginAttempts: 1 })
      prisma.user.findUnique.mockResolvedValue(user)
      prisma.user.update.mockResolvedValue({ failedLoginAttempts: 2 })
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)

      await expect(
        authService.login({ email: user.email, password: 'wrong' } as never, meta),
      ).rejects.toThrow(UnauthorizedException)

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.failed_login',
        expect.objectContaining({ userId: 'user_1' }),
      )
    })

    it('locks the account after reaching the failed-attempt threshold', async () => {
      const user = buildUser({ failedLoginAttempts: 4 })
      prisma.user.findUnique.mockResolvedValue(user)
      prisma.user.update.mockResolvedValue({ failedLoginAttempts: 5 })
      ;(argon2.verify as jest.Mock).mockResolvedValue(false)

      await expect(
        authService.login({ email: user.email, password: 'wrong' } as never, meta),
      ).rejects.toThrow(UnauthorizedException)

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.account_locked',
        expect.objectContaining({ userId: 'user_1' }),
      )
    })

    it('rejects a login while the account is locked, without checking the password', async () => {
      const user = buildUser({ lockedUntil: new Date(Date.now() + 60_000) })
      prisma.user.findUnique.mockResolvedValue(user)

      await expect(
        authService.login({ email: user.email, password: 'correct' } as never, meta),
      ).rejects.toThrow(ForbiddenException)

      expect(argon2.verify).not.toHaveBeenCalled()
    })

    it('rejects a suspended account even with the correct password', async () => {
      const user = buildUser({ status: UserStatus.SUSPENDED })
      prisma.user.findUnique.mockResolvedValue(user)

      await expect(
        authService.login({ email: user.email, password: 'correct' } as never, meta),
      ).rejects.toThrow(ForbiddenException)
    })
  })

  describe('register', () => {
    it('creates an organization, default admin role, and user, then issues a session', async () => {
      prisma.organization.findUnique.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.organization.create.mockResolvedValue({ id: 'org_1', slug: 'new-org' })
      prisma.user.create.mockResolvedValue(buildUser({ id: 'user_2' }))

      const dto = {
        organizationName: 'New Org',
        organizationSlug: 'new-org',
        adminFirstName: 'Ada',
        adminLastName: 'Lovelace',
        adminEmail: 'ada@example.com',
        adminPassword: 'Passw0rd1',
        phone: '9876543210',
      }

      const result = await authService.register(dto as never, meta)

      expect(rolesService.createDefaultOrgAdminRole).toHaveBeenCalledWith('org_1')
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.register',
        expect.objectContaining({ orgId: 'org_1' }),
      )
      expect(emailService.send).toHaveBeenCalled()
      expect(result.accessToken).toBe('signed.jwt.token')
    })

    it('rejects a taken organization slug', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'existing-org' })

      await expect(
        authService.register({ organizationSlug: 'taken' } as never, meta),
      ).rejects.toThrow('Organization slug already taken')
    })
  })

  describe('refresh', () => {
    it('rejects reused (already-rotated) refresh tokens', async () => {
      sessionsService.rotateSession.mockResolvedValue({
        outcome: 'reused',
        userId: 'user_1',
        sessionId: 'sess_1',
        organizationId: 'org_1',
      })

      await expect(authService.refresh('stolen-token', meta)).rejects.toThrow(UnauthorizedException)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'auth.token_reuse_detected',
        expect.objectContaining({ userId: 'user_1' }),
      )
    })

    it('rejects invalid/expired refresh tokens', async () => {
      sessionsService.rotateSession.mockResolvedValue({ outcome: 'invalid' })

      await expect(authService.refresh('garbage', meta)).rejects.toThrow(UnauthorizedException)
    })

    it('rejects when no refresh token is presented at all', async () => {
      await expect(authService.refresh(undefined, meta)).rejects.toThrow(UnauthorizedException)
      expect(sessionsService.rotateSession).not.toHaveBeenCalled()
    })
  })
})
