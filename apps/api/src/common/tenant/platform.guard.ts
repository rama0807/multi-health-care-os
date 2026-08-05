import { JwtPayload } from '@medicore/types'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

/**
 * Isolates the Platform Owner console (Checkpoint 16.2).
 *
 * This is an *additional* gate, never a replacement for `PermissionsGuard` —
 * every `/platform/*` route still carries `@RequirePermissions('platform.…')`
 * and both must pass. Membership of the platform tenant alone grants nothing,
 * and holding a `platform.*` permission inside a customer organization grants
 * nothing either. That deliberate belt-and-braces is why an organization admin
 * (whose seeded role holds every permission row in their own org, including
 * any future `platform.*` grant) still cannot reach these routes.
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: JwtPayload }>()
    const user = request.user

    if (!user?.isPlatform) {
      // Deliberately the same generic message a missing permission produces —
      // the console's existence isn't advertised to tenant users.
      throw new ForbiddenException('Access denied')
    }

    return true
  }
}
