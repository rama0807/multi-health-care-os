import { randomBytes } from 'crypto'

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma, SystemRole, User } from '@prisma/client'
import * as argon2 from 'argon2'

import { BackgroundTaskService } from '../background/background-task.service'
import { EmailService } from '../email/email.service'
import { accountCreatedTemplate, roleGrantedTemplate } from '../email/email.templates'

export interface OnboardUserParams {
  organizationId: string
  hospitalId?: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  systemRole: SystemRole
}

export interface OnboardUserResult {
  user: User
  created: boolean
  temporaryPassword?: string
}

/**
 * Shared "User + Role" half of staff onboarding. Every professional-profile
 * module (Doctor today; Nurse/Pharmacist/Lab Technician/Receptionist/etc.
 * later) calls this from inside its own transaction before creating its
 * profile row, instead of reimplementing account creation per role.
 *
 * Deliberately knows nothing about Doctor/Nurse/etc. profile tables - the
 * caller is responsible for checking whether the returned user already has
 * its kind of profile.
 */
@Injectable()
export class StaffOnboardingService {
  constructor(
    private readonly background: BackgroundTaskService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async onboardUserInTransaction(
    tx: Prisma.TransactionClient,
    params: OnboardUserParams,
  ): Promise<OnboardUserResult> {
    const { organizationId, hospitalId, email, firstName, lastName, phone, systemRole } = params

    const existing = await tx.user.findUnique({ where: { email } })

    if (existing) {
      if (existing.organizationId !== organizationId) {
        throw new ConflictException('A user with this email already exists in a different organization')
      }

      const role = await this.requireRole(tx, organizationId, systemRole)
      const existingUserRole = await tx.userRole.findUnique({
        where: { userId_roleId: { userId: existing.id, roleId: role.id } },
      })
      if (!existingUserRole) {
        await tx.userRole.create({ data: { userId: existing.id, roleId: role.id, hospitalId } })
      }

      return { user: existing, created: false }
    }

    const role = await this.requireRole(tx, organizationId, systemRole)
    const temporaryPassword = randomBytes(9).toString('base64url')
    const passwordHash = await argon2.hash(temporaryPassword)

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        organizationId,
        status: 'ACTIVE',
        isEmailVerified: true,
        userRoles: { create: [{ roleId: role.id, hospitalId }] },
      },
    })

    return { user, created: true, temporaryPassword }
  }

  /**
   * Fire after the caller's transaction has committed - never inside it, so
   * a rollback can never leave a user holding an email that promised access
   * that doesn't exist.
   *
   * Returns synchronously since Milestone 19.3: the send itself is handed to
   * `BackgroundTaskService`, so onboarding a doctor no longer waits on a mail
   * provider to answer the administrator who created them.
   */
  sendOnboardingEmail(params: {
    user: User
    created: boolean
    temporaryPassword?: string
    roleName: string
  }): void {
    const loginUrl = `${this.configService.get<string>('app.frontendUrl')}/login`

    if (params.created && params.temporaryPassword) {
      const { subject, html } = accountCreatedTemplate(
        params.user.firstName,
        params.user.email,
        params.temporaryPassword,
        loginUrl,
      )
      this.background.run('onboarding.account_created_email', () =>
        this.emailService.send({ to: params.user.email, subject, html }),
      )
      return
    }

    const { subject, html } = roleGrantedTemplate(params.user.firstName, params.roleName, loginUrl)
    this.background.run('onboarding.role_granted_email', () =>
      this.emailService.send({ to: params.user.email, subject, html }),
    )
  }

  private async requireRole(tx: Prisma.TransactionClient, organizationId: string, systemRole: SystemRole) {
    const role = await tx.role.findFirst({ where: { organizationId, systemRole } })
    if (!role) {
      throw new NotFoundException(
        `No '${systemRole}' role is configured for this organization - an administrator must create it first`,
      )
    }
    return role
  }
}
