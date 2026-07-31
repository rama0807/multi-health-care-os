import { createHash } from 'crypto'

import { Injectable } from '@nestjs/common'
import { nanoid } from 'nanoid'

import { RedisService } from '../../common/redis/redis.service'

const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60 // 24h
const PASSWORD_RESET_TTL_SECONDS = 60 * 60 // 1h

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Single-use, Redis-backed tokens for email verification and password reset. */
@Injectable()
export class TokensService {
  constructor(private readonly redis: RedisService) {}

  async issueEmailVerificationToken(userId: string): Promise<string> {
    const token = nanoid(48)
    await this.redis.set(`email_verify:${hashToken(token)}`, userId, EMAIL_VERIFY_TTL_SECONDS)
    return token
  }

  async consumeEmailVerificationToken(token: string): Promise<string | null> {
    return this.redis.getdel(`email_verify:${hashToken(token)}`)
  }

  async issuePasswordResetToken(userId: string): Promise<string> {
    const token = nanoid(48)
    await this.redis.set(`pwd_reset:${hashToken(token)}`, userId, PASSWORD_RESET_TTL_SECONDS)
    return token
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    return this.redis.getdel(`pwd_reset:${hashToken(token)}`)
  }
}
