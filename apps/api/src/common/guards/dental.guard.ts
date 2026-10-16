import { JwtPayload, OrganizationType } from '@medicore/types'
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

/**
 * Route-level guard that rejects requests from organizations whose type is not
 * `DENTAL`. Applied to all `/dental/*` controllers.
 *
 * This is defense-in-depth — the primary isolation boundary is still the
 * `organizationId` filter present in every service query. Removing this guard
 * alone would not expose data across organizations; it would only allow
 * hospital users to see Dental-shaped API responses for their own records,
 * which are intentionally empty.
 */
@Injectable()
export class DentalGuard implements CanActivate {

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: JwtPayload }>()
    const user = request.user

    if (!user) {
      throw new ForbiddenException('Authentication required')
    }

    if (user.orgType !== OrganizationType.DENTAL) {
      throw new ForbiddenException(
        'This endpoint is only accessible to Dental Clinic organizations',
      )
    }

    return true
  }
}
