import { createSign } from 'node:crypto'

import { NotificationChannel, NotificationPriority } from '@medicore/types'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import {
  ChannelSendRequest,
  ChannelSendResult,
  NotificationChannelProvider,
} from './channel-provider.interface'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
/** Refresh a little before the hour Google grants, so no send races expiry. */
const TOKEN_SAFETY_WINDOW_MS = 60_000

interface FcmError {
  error?: { status?: string; message?: string; details?: Array<{ errorCode?: string }> }
}

/**
 * Firebase Cloud Messaging over the HTTP v1 API (Checkpoint 18.2).
 *
 * Written directly against the REST API with `node:crypto` for the
 * service-account JWT rather than pulling in `firebase-admin`: the repo
 * already talks to four AI vendors this way (`common/ai/providers/`), the
 * dependency footprint stays flat, and the same code path serves web and — via
 * `UserDevice.platform` — any future mobile client, since an FCM token is
 * opaque to the sender.
 *
 * With no service account configured, every send fails with an explicit
 * reason and nothing is recorded as delivered (TD line held since TD-0015).
 */
@Injectable()
export class FcmPushProvider implements NotificationChannelProvider {
  readonly channel = NotificationChannel.PUSH
  readonly providerName = 'fcm'

  private readonly logger = new Logger(FcmPushProvider.name)
  private cachedToken: { value: string; expiresAt: number } | null = null

  constructor(private readonly config: ConfigService) {}

  private get credentials() {
    return {
      projectId: this.config.get<string>('notifications.fcm.projectId'),
      clientEmail: this.config.get<string>('notifications.fcm.clientEmail'),
      privateKey: this.config.get<string>('notifications.fcm.privateKey'),
      vapidPublicKey: this.config.get<string>('notifications.fcm.vapidPublicKey'),
    }
  }

  isConfigured(): boolean {
    const { projectId, clientEmail, privateKey } = this.credentials
    return Boolean(projectId && clientEmail && privateKey)
  }

  unconfiguredReason(): string | null {
    if (this.isConfigured()) return null
    const { projectId, clientEmail, privateKey } = this.credentials
    const missing = [
      !projectId && 'FCM_PROJECT_ID',
      !clientEmail && 'FCM_CLIENT_EMAIL',
      !privateKey && 'FCM_PRIVATE_KEY',
    ].filter(Boolean)
    return `Firebase Cloud Messaging is not configured — missing ${missing.join(', ')}`
  }

  /** The browser also needs the VAPID public key before it can subscribe. */
  browserPushReason(): string | null {
    const base = this.unconfiguredReason()
    if (base) return base
    return this.credentials.vapidPublicKey
      ? null
      : 'FCM_VAPID_PUBLIC_KEY is not set — the browser cannot obtain a push token'
  }

  vapidPublicKey(): string | null {
    return this.credentials.vapidPublicKey ?? null
  }

  projectId(): string | null {
    return this.credentials.projectId ?? null
  }

  async send(request: ChannelSendRequest): Promise<ChannelSendResult> {
    const reason = this.unconfiguredReason()
    if (reason) {
      return { ok: false, providerName: this.providerName, failureReason: reason, retryable: false }
    }

    const tokens = request.pushTokens ?? []
    if (tokens.length === 0) {
      return {
        ok: false,
        providerName: this.providerName,
        failureReason: 'Recipient has no registered push device',
        retryable: false,
      }
    }

    let accessToken: string
    try {
      accessToken = await this.accessToken()
    } catch (error) {
      // An auth failure is usually a clock skew or a transient Google error —
      // both worth another attempt.
      return {
        ok: false,
        providerName: this.providerName,
        failureReason: `FCM authentication failed: ${(error as Error).message}`,
        retryable: true,
      }
    }

    const invalidTokens: string[] = []
    const messageIds: string[] = []
    const failures: string[] = []
    let retryable = false

    // FCM HTTP v1 has no multicast endpoint; one request per token is the
    // documented approach. Devices per user are few, so this stays bounded.
    for (const token of tokens) {
      const outcome = await this.sendToToken(accessToken, token, request)
      if (outcome.ok) {
        messageIds.push(outcome.messageId ?? '')
      } else if (outcome.invalid) {
        invalidTokens.push(token)
        failures.push(outcome.reason ?? 'Token no longer registered')
      } else {
        failures.push(outcome.reason ?? 'FCM send failed')
        retryable = retryable || outcome.retryable
      }
    }

    if (messageIds.length > 0) {
      return {
        ok: true,
        providerName: this.providerName,
        providerMessageId: messageIds.filter(Boolean)[0],
        retryable: false,
        invalidTokens,
      }
    }

    return {
      ok: false,
      providerName: this.providerName,
      // Every token failed. If they all failed because they are gone, another
      // attempt cannot help — say so rather than looping the queue.
      failureReason: failures[0] ?? 'FCM send failed',
      retryable,
      invalidTokens,
    }
  }

  private async sendToToken(
    accessToken: string,
    token: string,
    request: ChannelSendRequest,
  ): Promise<{ ok: boolean; messageId?: string; invalid?: boolean; retryable: boolean; reason?: string }> {
    const { projectId } = this.credentials
    const highPriority =
      request.priority === NotificationPriority.CRITICAL || request.priority === NotificationPriority.HIGH

    const body = {
      message: {
        token,
        notification: {
          title: request.title,
          body: request.body,
          ...(request.imageUrl ? { image: request.imageUrl } : {}),
        },
        // Mirrored into `data` as well: the service worker reads these on a
        // background click, where the `notification` block is handled by the
        // browser and its payload is not exposed to our handler.
        data: {
          notificationId: request.notificationId,
          category: request.category,
          priority: request.priority,
          ...(request.deepLink ? { deepLink: request.deepLink } : {}),
          ...(request.icon ? { icon: request.icon } : {}),
        },
        webpush: {
          headers: { Urgency: highPriority ? 'high' : 'normal' },
          fcmOptions: request.deepLink ? { link: request.deepLink } : undefined,
        },
        android: { priority: highPriority ? 'HIGH' : 'NORMAL' },
      },
    }

    try {
      const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const json = (await response.json()) as { name?: string }
        return { ok: true, messageId: json.name, retryable: false }
      }

      const text = await response.text()
      let parsed: FcmError = {}
      try {
        parsed = JSON.parse(text) as FcmError
      } catch {
        // Non-JSON error body — the raw text is still the best explanation.
      }
      const errorCode = parsed.error?.details?.find((d) => d.errorCode)?.errorCode ?? parsed.error?.status
      const message = parsed.error?.message ?? text.slice(0, 300)

      // UNREGISTERED / INVALID_ARGUMENT on a token means the installation is
      // gone; the device row is deactivated instead of retried forever.
      const invalid =
        errorCode === 'UNREGISTERED' || errorCode === 'INVALID_ARGUMENT' || response.status === 404

      return {
        ok: false,
        invalid,
        retryable: !invalid && (response.status === 429 || response.status >= 500),
        reason: `FCM ${response.status}: ${message}`,
      }
    } catch (error) {
      return { ok: false, retryable: true, reason: `FCM request failed: ${(error as Error).message}` }
    }
  }

  /** Service-account JWT → OAuth2 access token, cached until shortly before expiry. */
  private async accessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt - TOKEN_SAFETY_WINDOW_MS > Date.now()) {
      return this.cachedToken.value
    }

    const { clientEmail, privateKey } = this.credentials
    const now = Math.floor(Date.now() / 1000)
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claims = base64Url(
      JSON.stringify({
        iss: clientEmail,
        scope: FCM_SCOPE,
        aud: GOOGLE_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    )

    const signer = createSign('RSA-SHA256')
    signer.update(`${header}.${claims}`)
    const signature = signer.sign(privateKey as string).toString('base64url')
    const assertion = `${header}.${claims}.${signature}`

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`token endpoint returned ${response.status}: ${text.slice(0, 200)}`)
    }

    const json = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!json.access_token) throw new Error('token endpoint returned no access_token')

    this.cachedToken = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    }
    this.logger.debug('Obtained a new FCM access token')
    return json.access_token
  }
}

function base64Url(value: string): string {
  return Buffer.from(value).toString('base64url')
}
