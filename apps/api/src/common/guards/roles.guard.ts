import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FastifyRequest } from 'fastify'

import { JwtPayload, SystemRole } from '@medicore/types'

import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<SystemRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!requiredRoles?.length) return true

    const request = context.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>()
    const user = request.user

    if (!user) throw new ForbiddenException('Access denied')

    // SUPER_ADMIN bypasses all role checks
    if (user.roles.includes(SystemRole.SUPER_ADMIN)) return true

    const hasRole = requiredRoles.some((role) => user.roles.includes(role))
    if (!hasRole) {
      throw new ForbiddenException(`Required role: ${requiredRoles.join(' or ')}`)
    }

    return true
  }
}
