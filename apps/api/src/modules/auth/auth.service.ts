import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { JwtService } from '@nestjs/jwt'
import { User } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'

import { AuthTokens, JwtPayload, LoginDto, RegisterOrganizationDto, SystemRole } from '@medicore/types'

import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterOrganizationDto): Promise<AuthTokens> {
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: dto.organizationSlug },
    })
    if (existingOrg) {
      throw new ConflictException('Organization slug already taken')
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.adminEmail },
    })
    if (existingUser) {
      throw new ConflictException('Email already registered')
    }

    const passwordHash = await bcrypt.hash(dto.adminPassword, 12)

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

    const adminPermissions = await this.prisma.permission.findMany()
    const adminRole = await this.prisma.role.create({
      data: {
        name: 'Admin',
        systemRole: SystemRole.ORG_ADMIN,
        organizationId: org.id,
        description: 'Organization administrator',
        rolePermissions: {
          create: adminPermissions.map((p) => ({ permissionId: p.id })),
        },
      },
    })

    const user = await this.prisma.user.create({
      data: {
        email: dto.adminEmail,
        passwordHash,
        firstName: dto.adminFirstName,
        lastName: dto.adminLastName,
        organizationId: org.id,
        userRoles: { create: [{ roleId: adminRole.id }] },
      },
    })

    this.eventEmitter.emit('auth.register', { userId: user.id, orgId: org.id })
    return this.generateTokens(user, org.id, org.slug, [SystemRole.ORG_ADMIN])
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        organization: true,
        userRoles: { include: { role: true } },
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const passwordValid = await bcrypt.compare(dto.loginPassword, user.passwordHash)
    if (!passwordValid) {
      this.eventEmitter.emit('auth.failed_login', { email: dto.email })
      throw new UnauthorizedException('Invalid credentials')
    }

    if (!user.organization.isActive) {
      throw new UnauthorizedException('Organization is inactive')
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const roles = user.userRoles
      .map((ur) => ur.role.systemRole)
      .filter(Boolean) as SystemRole[]

    this.eventEmitter.emit('auth.login', { userId: user.id, orgId: user.organizationId })
    return this.generateTokens(user, user.organizationId, user.organization.slug, roles)
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken)
    const stored = await this.prisma.$queryRaw<
      Array<{ user_id: string; expires_at: Date; is_revoked: boolean }>
    >`
      SELECT user_id, expires_at, is_revoked
      FROM refresh_tokens_store
      WHERE token_hash = ${tokenHash}
    `

    // For now, we use a simple DB approach — Redis in production
    if (!stored.length || stored[0].is_revoked || stored[0].expires_at < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    const user = await this.prisma.user.findUnique({
      where: { id: stored[0].user_id },
      include: {
        organization: true,
        userRoles: { include: { role: true } },
      },
    })

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive')
    }

    const roles = user.userRoles
      .map((ur) => ur.role.systemRole)
      .filter(Boolean) as SystemRole[]

    return this.generateTokens(user, user.organizationId, user.organization.slug, roles)
  }

  private async generateTokens(
    user: User,
    orgId: string,
    orgSlug: string,
    roles: SystemRole[],
  ): Promise<AuthTokens> {
    const sessionId = nanoid(20)

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      orgId,
      orgSlug,
      roles,
      sessionId,
    }

    const accessToken = this.jwtService.sign(payload)
    const refreshToken = nanoid(64)

    const expiresIn = 15 * 60 // 15 minutes in seconds

    return { accessToken, refreshToken, expiresIn }
  }

  private hashToken(token: string): string {
    const { createHash } = require('crypto') as typeof import('crypto')
    return createHash('sha256').update(token).digest('hex')
  }
}
