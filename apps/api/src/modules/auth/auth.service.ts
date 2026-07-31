import {
  AuthenticatedUser,
  JwtPayload,
  LoginDto,
  RegisterOrganizationDto,
  UserStatus,
} from '@medicore/types'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { Prisma } from '@prisma/client'
import * as argon2 from 'argon2'



import { EmailService } from '../../common/email/email.service'
import { passwordResetTemplate, verifyEmailTemplate } from '../../common/email/email.templates'
import { PrismaService } from '../../prisma/prisma.service'
import { RolesService } from '../roles/roles.service'

import { RotationResult, SessionsService } from './sessions.service'
import { TokensService } from './tokens.service'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MINUTES = 15

export interface RequestMeta {
  userAgent: string
  ipAddress: string
}

export interface AuthSessionResult {
  accessToken: string
  expiresIn: number
  refreshToken: string
  refreshTokenTtlSeconds: number
  rememberMe: boolean
  user: AuthenticatedUser
}

const userWithOrg = Prisma.validator<Prisma.UserDefaultArgs>()({
  include: { organization: { select: { id: true, slug: true, name: true, isActive: true } } },
})
type UserWithOrg = Prisma.UserGetPayload<typeof userWithOrg>

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly rolesService: RolesService,
    private readonly sessionsService: SessionsService,
    private readonly tokensService: TokensService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterOrganizationDto, meta: RequestMeta): Promise<AuthSessionResult> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    })
    if (existingOrg) throw new ConflictException('Organization slug already taken')

    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.adminEmail } })
    if (existingUser) throw new ConflictException('Email already registered')

    const passwordHash = await argon2.hash(dto.adminPassword)

    const org = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug: dto.organizationSlug,
        email: dto.adminEmail,
        phone: dto.phone,
        settings: {
          uhidPrefix: dto.organizationSlug.toUpperCase().slice(0, 4),
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          currencySymbol: '₹',
          dateFormat: 'DD/MM/YYYY',
          timeFormat: '12h',
          gstRate: 18,
          defaultAppointmentDuration: 15,
          workingDays: [1, 2, 3, 4, 5, 6],
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00',
        },
      },
    })

    const adminRole = await this.rolesService.createDefaultOrgAdminRole(org.id)

    const user = await this.prisma.user.create({
      data: {
        email: dto.adminEmail,
        passwordHash,
        firstName: dto.adminFirstName,
        lastName: dto.adminLastName,
        organizationId: org.id,
        status: UserStatus.PENDING_VERIFICATION,
        userRoles: { create: [{ roleId: adminRole.id }] },
      },
    })

    this.eventEmitter.emit('auth.register', { userId: user.id, orgId: org.id })

    await this.sendVerificationEmail(user.id, user.email, user.firstName)

    return this.issueSession(
      { ...user, organization: org },
      meta,
      false,
    )
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthSessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: { select: { id: true, slug: true, name: true, isActive: true } } },
    })

    if (!user) throw new UnauthorizedException('Invalid credentials')

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException('Account temporarily locked due to too many failed attempts')
    }

    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException('This account is no longer active')
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password)
    if (!passwordValid) {
      await this.registerFailedAttempt(user.id)
      this.eventEmitter.emit('auth.failed_login', {
        email: dto.email,
        userId: user.id,
        orgId: user.organizationId,
      })
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!user.organization.isActive) {
      throw new ForbiddenException('Organization is inactive')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    })

    this.eventEmitter.emit('auth.login', { userId: user.id, orgId: user.organizationId })

    return this.issueSession(user, meta, dto.rememberMe ?? false)
  }

  async refresh(presentedToken: string | undefined, meta: RequestMeta): Promise<AuthSessionResult> {
    if (!presentedToken) throw new UnauthorizedException('No refresh token provided')

    const result: RotationResult = await this.sessionsService.rotateSession(
      presentedToken,
      meta.userAgent,
      meta.ipAddress,
    )

    if (result.outcome === 'reused') {
      this.eventEmitter.emit('auth.token_reuse_detected', {
        userId: result.userId,
        sessionId: result.sessionId,
        orgId: result.organizationId,
      })
      throw new UnauthorizedException('Session revoked — refresh token was already used')
    }

    if (result.outcome === 'invalid') {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: result.session.userId },
      include: { organization: { select: { id: true, slug: true, name: true, isActive: true } } },
    })

    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('User not found or inactive')
    }
    if (!user.organization.isActive) {
      throw new UnauthorizedException('Organization is inactive')
    }

    const authContext = await this.rolesService.resolveAuthContext(user.id)
    const accessToken = this.signAccessToken(user, authContext, result.session.sessionId)

    return {
      accessToken,
      expiresIn: this.accessTokenExpirySeconds(),
      refreshToken: result.session.refreshToken,
      refreshTokenTtlSeconds: result.session.ttlSeconds,
      rememberMe: result.session.rememberMe,
      user: this.toAuthenticatedUser(user, authContext),
    }
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessionsService.revokeSession(userId, sessionId)
    this.eventEmitter.emit('auth.logout', { userId, sessionId })
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionsService.revokeAllSessions(userId)
    this.eventEmitter.emit('auth.logout_all', { userId })
  }

  async getSessions(userId: string, currentSessionId: string) {
    return this.sessionsService.listSessions(userId, currentSessionId)
  }

  async me(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { organization: { select: { id: true, slug: true, name: true, isActive: true } } },
    })
    if (!user) throw new UnauthorizedException('User not found')

    const authContext = await this.rolesService.resolveAuthContext(user.id)
    return this.toAuthenticatedUser(user, authContext)
  }

  /** Always resolves — never reveals whether an email address exists. */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) return

    const token = await this.tokensService.issuePasswordResetToken(user.id)
    const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/reset-password?token=${token}`
    const { subject, html } = passwordResetTemplate(user.firstName, resetUrl)
    await this.emailService.send({ to: user.email, subject, html })
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await this.tokensService.consumePasswordResetToken(token)
    if (!userId) throw new BadRequestException('Invalid or expired reset token')

    const passwordHash = await argon2.hash(newPassword)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    })

    await this.sessionsService.revokeAllSessions(userId)
    this.eventEmitter.emit('auth.password_reset', { userId })
  }

  async changePassword(
    userId: string,
    currentSessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException('User not found')

    const valid = await argon2.verify(user.passwordHash, currentPassword)
    if (!valid) throw new BadRequestException('Current password is incorrect')

    const passwordHash = await argon2.hash(newPassword)
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } })

    await this.sessionsService.revokeAllSessionsExcept(userId, currentSessionId)
  }

  async verifyEmail(token: string): Promise<void> {
    const userId = await this.tokensService.consumeEmailVerificationToken(token)
    if (!userId) throw new BadRequestException('Invalid or expired verification token')

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new BadRequestException('Invalid or expired verification token')

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        status: user.status === UserStatus.PENDING_VERIFICATION ? UserStatus.ACTIVE : user.status,
      },
    })

    this.eventEmitter.emit('auth.email_verified', { userId })
  }

  async resendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user || user.isEmailVerified) return
    await this.sendVerificationEmail(user.id, user.email, user.firstName)
  }

  async sendVerificationEmail(userId: string, email: string, firstName: string): Promise<void> {
    const token = await this.tokensService.issueEmailVerificationToken(userId)
    const verifyUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/verify-email?token=${token}`
    const { subject, html } = verifyEmailTemplate(firstName, verifyUrl)
    await this.emailService.send({ to: email, subject, html })
  }

  accessTokenExpirySeconds(): number {
    return 15 * 60
  }

  private async registerFailedAttempt(userId: string): Promise<void> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    })

    if (updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000) },
      })
      this.eventEmitter.emit('auth.account_locked', { userId })
    }
  }

  private async issueSession(
    user: UserWithOrg,
    meta: RequestMeta,
    rememberMe: boolean,
  ): Promise<AuthSessionResult> {
    const authContext = await this.rolesService.resolveAuthContext(user.id)
    const session = await this.sessionsService.createSession(
      user.id,
      user.organizationId,
      meta.userAgent,
      meta.ipAddress,
      rememberMe,
    )

    const accessToken = this.signAccessToken(user, authContext, session.sessionId)

    return {
      accessToken,
      expiresIn: this.accessTokenExpirySeconds(),
      refreshToken: session.refreshToken,
      refreshTokenTtlSeconds: session.ttlSeconds,
      rememberMe,
      user: this.toAuthenticatedUser(user, authContext),
    }
  }

  private signAccessToken(
    user: UserWithOrg,
    authContext: { roles: JwtPayload['roles']; permissions: string[]; hospitalIds: string[] },
    sessionId: string,
  ): string {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      orgId: user.organizationId,
      orgSlug: user.organization.slug,
      roles: authContext.roles,
      permissions: authContext.permissions,
      hospitalIds: authContext.hospitalIds,
      sessionId,
    }

    return this.jwtService.sign(payload)
  }

  private toAuthenticatedUser(
    user: UserWithOrg,
    authContext: { roles: JwtPayload['roles']; permissions: string[]; hospitalIds: string[] },
  ): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      organizationId: user.organizationId,
      organizationSlug: user.organization.slug,
      organizationName: user.organization.name,
      roles: authContext.roles,
      permissions: authContext.permissions,
      hospitalIds: authContext.hospitalIds,
    }
  }
}
