import { CreateUserDto, PaginatedResponse, UpdateUserDto, UserStatus } from '@medicore/types'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as argon2 from 'argon2'


import { EmailService } from '../../common/email/email.service'
import { verifyEmailTemplate } from '../../common/email/email.templates'
import { PrismaService } from '../../prisma/prisma.service'
import { TokensService } from '../auth/tokens.service'

export interface ListUsersQuery {
  page?: number
  limit?: number
  status?: UserStatus
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokensService: TokensService,
    private readonly emailService: EmailService,
  ) {}

  async list(organizationId: string, query: ListUsersQuery): Promise<PaginatedResponse<unknown>> {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20
    const where = { organizationId, ...(query.status ? { status: query.status } : {}) }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: { userRoles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ])

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    }
  }

  async getById(organizationId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, organizationId },
      include: { userRoles: { include: { role: true } } },
    })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  async create(organizationId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } })
    if (existing) throw new ConflictException('Email already registered')

    const roles = await this.prisma.role.findMany({
      where: { id: { in: dto.roleIds }, organizationId },
    })
    if (roles.length !== dto.roleIds.length) {
      throw new ConflictException('One or more role IDs are invalid for this organization')
    }

    const passwordHash = await argon2.hash(dto.password)

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        organizationId,
        status: UserStatus.PENDING_VERIFICATION,
        userRoles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
      },
      include: { userRoles: { include: { role: true } } },
    })

    const token = await this.tokensService.issueEmailVerificationToken(user.id)
    const verifyUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/verify-email?token=${token}`
    const { subject, html } = verifyEmailTemplate(user.firstName, verifyUrl)
    await this.emailService.send({ to: user.email, subject, html })

    return user
  }

  async update(organizationId: string, id: string, dto: UpdateUserDto) {
    await this.getById(organizationId, id)
    return this.prisma.user.update({ where: { id }, data: dto })
  }
}
