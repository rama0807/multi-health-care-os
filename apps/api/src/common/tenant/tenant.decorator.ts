import { JwtPayload, TenantContext } from '@medicore/types'
import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

import { resolveTenantContext } from './tenant.util'

/**
 * Resolves the platform / organization / hospital tenant triple for the
 * current request. Mirrors `@CurrentUser()`'s shape exactly - it reads the
 * same `request.user` payload that `JwtAuthGuard` already put there - and adds
 * no second authentication path.
 */
export const Tenant = createParamDecorator(
  (data: keyof TenantContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>()
    const tenant = resolveTenantContext(request.user)
    return data ? tenant[data] : tenant
  },
)
