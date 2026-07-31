import { JwtPayload } from '@medicore/types'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { FastifyRequest } from 'fastify'


import { PERMISSIONS_KEY } from '../decorators/permissions.decorator'

/**
 * Pure DB-driven authorization: the caller's permission set was resolved from
 * Role -> RolePermission -> Permission at login/refresh time and embedded in
 * the JWT as "resource.action.scope" strings. There is no hardcoded
 * role-based bypass here (including for SUPER_ADMIN) — a SUPER_ADMIN account
 * only has access because its seeded role holds every permission row.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!required?.length) return true

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: JwtPayload }>()
    const user = request.user

    if (!user) throw new ForbiddenException('Access denied')

    const granted = new Set(user.permissions ?? [])
    const hasAccess = required.some(
      (permission) => granted.has(`${permission}.all`) || granted.has(`${permission}.own`),
    )

    if (!hasAccess) {
      throw new ForbiddenException(`Missing required permission: ${required.join(' or ')}`)
    }

    return true
  }
}
