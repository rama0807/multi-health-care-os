import { JwtPayload, UserStatus } from '@medicore/types'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'


import { RedisService } from '../../../common/redis/redis.service'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.publicKey'),
      algorithms: ['RS256'],
    })
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { status: true, organization: { select: { isActive: true } } },
    })

    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException('User not found or inactive')
    }

    if (!user.organization.isActive) {
      throw new UnauthorizedException('Organization is inactive')
    }

    // Ensures a logged-out access token stops working immediately rather than
    // riding out its remaining 15-minute expiry window.
    const sessionAlive = await this.redis.exists(`session:${payload.sub}:${payload.sessionId}`)
    if (!sessionAlive) {
      throw new UnauthorizedException('Session has been revoked')
    }

    return payload
  }
}
