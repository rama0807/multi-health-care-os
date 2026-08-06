import { createHash } from 'crypto'

import { SessionInfo } from '@medicore/types'
import { Injectable } from '@nestjs/common'
import { nanoid } from 'nanoid'


import { RedisService } from '../../common/redis/redis.service'

const REMEMBER_ME_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days
const DEFAULT_TTL_SECONDS = 24 * 60 * 60 // 1 day
const REUSE_TOMBSTONE_TTL_SECONDS = 60

interface RefreshRecord {
  userId: string
  sessionId: string
  organizationId: string
  userAgent: string
  ipAddress: string
  createdAt: string
  expiresAt: string
  rememberMe: boolean
}

interface SessionRecord {
  userAgent: string
  ipAddress: string
  createdAt: string
  lastUsedAt: string
  rememberMe: boolean
}

export interface CreatedSession {
  sessionId: string
  refreshToken: string
  ttlSeconds: number
}

export interface RotatedSession extends CreatedSession {
  userId: string
  organizationId: string
  rememberMe: boolean
}

export type RotationResult =
  | { outcome: 'rotated'; session: RotatedSession }
  | { outcome: 'reused'; userId: string; sessionId: string; organizationId: string }
  | { outcome: 'invalid' }

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function refreshKey(token: string): string {
  return `refresh:${hashToken(token)}`
}

function tombstoneKey(token: string): string {
  return `refresh:revoked:${hashToken(token)}`
}

function sessionKey(userId: string, sessionId: string): string {
  return `session:${userId}:${sessionId}`
}

function sessionSetKey(userId: string): string {
  return `sessions:${userId}`
}

@Injectable()
export class SessionsService {
  constructor(private readonly redis: RedisService) {}

  async createSession(
    userId: string,
    organizationId: string,
    userAgent: string,
    ipAddress: string,
    rememberMe: boolean,
  ): Promise<CreatedSession> {
    const sessionId = nanoid(21)
    const refreshToken = nanoid(64)
    const ttlSeconds = rememberMe ? REMEMBER_ME_TTL_SECONDS : DEFAULT_TTL_SECONDS
    const now = new Date()

    const refreshRecord: RefreshRecord = {
      userId,
      sessionId,
      organizationId,
      userAgent,
      ipAddress,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      rememberMe,
    }
    const sessionRecord: SessionRecord = {
      userAgent,
      ipAddress,
      createdAt: now.toISOString(),
      lastUsedAt: now.toISOString(),
      rememberMe,
    }

    await this.redis.set(refreshKey(refreshToken), JSON.stringify(refreshRecord), ttlSeconds)
    await this.redis.set(sessionKey(userId, sessionId), JSON.stringify(sessionRecord), ttlSeconds)
    await this.redis.sAdd(sessionSetKey(userId), sessionId)

    return { sessionId, refreshToken, ttlSeconds }
  }

  /**
   * Rotates a refresh token. Detects reuse of an already-rotated token via a
   * short-lived tombstone left behind at the old key - see ADR-006.
   */
  async rotateSession(
    presentedToken: string,
    userAgent: string,
    ipAddress: string,
  ): Promise<RotationResult> {
    const raw = await this.redis.get(refreshKey(presentedToken))

    if (!raw) {
      const tombstoned = await this.redis.get(tombstoneKey(presentedToken))
      if (tombstoned) {
        const record = JSON.parse(tombstoned) as RefreshRecord
        await this.revokeSession(record.userId, record.sessionId)
        return {
          outcome: 'reused',
          userId: record.userId,
          sessionId: record.sessionId,
          organizationId: record.organizationId,
        }
      }
      return { outcome: 'invalid' }
    }

    const record = JSON.parse(raw) as RefreshRecord

    const stillActive = await this.redis.exists(sessionKey(record.userId, record.sessionId))
    if (!stillActive) {
      await this.redis.del(refreshKey(presentedToken))
      return { outcome: 'invalid' }
    }

    // Tombstone the old token briefly so a concurrent/replayed use is detectable as theft.
    await this.redis.set(tombstoneKey(presentedToken), raw, REUSE_TOMBSTONE_TTL_SECONDS)
    await this.redis.del(refreshKey(presentedToken))

    const ttlSeconds = record.rememberMe ? REMEMBER_ME_TTL_SECONDS : DEFAULT_TTL_SECONDS
    const newToken = nanoid(64)
    const now = new Date()

    const updatedRefresh: RefreshRecord = {
      ...record,
      userAgent,
      ipAddress,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
    }
    const updatedSession: SessionRecord = {
      userAgent,
      ipAddress,
      createdAt: record.createdAt,
      lastUsedAt: now.toISOString(),
      rememberMe: record.rememberMe,
    }

    await this.redis.set(refreshKey(newToken), JSON.stringify(updatedRefresh), ttlSeconds)
    await this.redis.set(
      sessionKey(record.userId, record.sessionId),
      JSON.stringify(updatedSession),
      ttlSeconds,
    )

    return {
      outcome: 'rotated',
      session: {
        sessionId: record.sessionId,
        refreshToken: newToken,
        ttlSeconds,
        userId: record.userId,
        organizationId: record.organizationId,
        rememberMe: record.rememberMe,
      },
    }
  }

  async listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
    const memberIds = await this.redis.sMembers(sessionSetKey(userId))
    const sessions: SessionInfo[] = []

    for (const sessionId of memberIds) {
      const raw = await this.redis.get(sessionKey(userId, sessionId))
      if (!raw) {
        await this.redis.sRem(sessionSetKey(userId), sessionId)
        continue
      }
      const record = JSON.parse(raw) as SessionRecord
      sessions.push({
        sessionId,
        userId,
        userAgent: record.userAgent,
        ipAddress: record.ipAddress,
        createdAt: new Date(record.createdAt),
        lastUsedAt: new Date(record.lastUsedAt),
        isCurrent: sessionId === currentSessionId,
      })
    }

    return sessions.sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime())
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(sessionKey(userId, sessionId))
    await this.redis.sRem(sessionSetKey(userId), sessionId)
  }

  async revokeAllSessions(userId: string): Promise<void> {
    const memberIds = await this.redis.sMembers(sessionSetKey(userId))
    await Promise.all(memberIds.map((sessionId) => this.redis.del(sessionKey(userId, sessionId))))
    await this.redis.del(sessionSetKey(userId))
  }

  async revokeAllSessionsExcept(userId: string, keepSessionId: string): Promise<void> {
    const memberIds = await this.redis.sMembers(sessionSetKey(userId))
    await Promise.all(
      memberIds
        .filter((sessionId) => sessionId !== keepSessionId)
        .map(async (sessionId) => {
          await this.redis.del(sessionKey(userId, sessionId))
          await this.redis.sRem(sessionSetKey(userId), sessionId)
        }),
    )
  }
}
