import { ExecutionContext, createParamDecorator } from '@nestjs/common'
import { FastifyRequest } from 'fastify'

import { JwtPayload } from '@medicore/types'

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: JwtPayload }>()
    const user = request.user
    return data ? user[data] : user
  },
)
