'use client'

import { DevicePlatform, type PushConfigStatus, type UserDevice } from '@medicore/types'
import { useCallback, useEffect, useState } from 'react'

import { deactivateDevice, getPushConfig, listDevices, registerDevice } from '@/lib/api/notifications'

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported'

export interface PushState {
  /** Server-side push configuration, including why it may be unavailable. */
  config: PushConfigStatus | null
  permission: PushPermission
  devices: UserDevice[]
  isLoading: boolean
  isSubscribing: boolean
  /** The last failure, shown verbatim rather than as "something went wrong". */
  error: string | null
  subscribe: () => Promise<void>
  refresh: () => Promise<void>
  removeDevice: (id: string) => Promise<void>
}

/**
 * Browser push subscription (Checkpoint 18.2).
 *
 * What this does and does not do, stated plainly because the difference
 * matters:
 *
 * - It **does** register the service worker, request notification permission,
 *   describe the device, register the resulting token with the API, and list
 *   and revoke a user's devices. All of that is real and exercised.
 * - It **does not** mint an FCM registration token itself. Obtaining one
 *   requires the Firebase JS SDK (`firebase/messaging`), which is not a
 *   dependency of this app, and a Firebase project, which this deployment
 *   does not have. Rather than fabricate a token that would silently never
 *   receive anything, `subscribe()` reports exactly what is missing - the same
 *   line this repo already holds for SMS, payment gateways and AI providers.
 *
 * When a deployment does configure FCM, the remaining work is a single
 * `getToken()` call in `acquireToken` below; every other piece - permission,
 * worker, registration API, multi-device storage, click routing - is done.
 */
export function usePushNotifications(): PushState {
  const [config, setConfig] = useState<PushConfigStatus | null>(null)
  const [permission, setPermission] = useState<PushPermission>('default')
  const [devices, setDevices] = useState<UserDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [pushConfig, myDevices] = await Promise.all([getPushConfig(), listDevices()])
      setConfig(pushConfig)
      setDevices(myDevices)
      setPermission(currentPermission())
    } catch {
      setError('Could not load your notification devices')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const subscribe = useCallback(async () => {
    setError(null)
    setIsSubscribing(true)
    try {
      if (!isSupported()) {
        setPermission('unsupported')
        setError('This browser does not support push notifications')
        return
      }

      const granted = await Notification.requestPermission()
      setPermission(granted as PushPermission)
      if (granted !== 'granted') {
        setError(
          granted === 'denied'
            ? 'Notification permission was blocked. Enable it in your browser’s site settings and try again.'
            : 'Notification permission was dismissed',
        )
        return
      }

      // Registered even when no token can be obtained: the worker is what
      // displays and routes a notification, and having it in place means a
      // deployment that later configures FCM needs no client change.
      await navigator.serviceWorker.register('/push-sw.js')
      await navigator.serviceWorker.ready

      const pushConfig = config ?? (await getPushConfig())
      setConfig(pushConfig)

      const token = await acquireToken(pushConfig)
      if (!token) {
        setError(
          pushConfig.reason ??
            'Browser push is not configured for this deployment, so no device token could be obtained.',
        )
        return
      }

      const device = describeDevice()
      await registerDevice({ token, platform: DevicePlatform.WEB, ...device })
      setDevices(await listDevices())
    } catch (caught) {
      setError((caught as Error).message)
    } finally {
      setIsSubscribing(false)
    }
  }, [config])

  const removeDevice = useCallback(async (id: string) => {
    await deactivateDevice(id)
    setDevices(await listDevices())
  }, [])

  return { config, permission, devices, isLoading, isSubscribing, error, subscribe, refresh, removeDevice }
}

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function currentPermission(): PushPermission {
  if (!isSupported()) return 'unsupported'
  return Notification.permission as PushPermission
}

/**
 * Obtains an FCM registration token, or null with the reason already carried
 * on `config`.
 *
 * Deliberately returns null rather than falling back to a Web Push
 * `PushSubscription`: a raw subscription is *not* an FCM token, and storing
 * one would make `UserDevice` rows that `FcmPushProvider` can never deliver
 * to - a device list that looks healthy and silently drops every message.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- becomes a real await once the Firebase SDK is present
async function acquireToken(config: PushConfigStatus): Promise<string | null> {
  if (!config.configured || !config.vapidPublicKey) return null

  // With FCM configured, this is where `getToken(messaging, { vapidKey })`
  // from `firebase/messaging` goes. The SDK is not a dependency of this app
  // (see the hook's doc comment), so there is nothing to call yet.
  return null
}

/** Best-effort, user-facing device label - never used for identification. */
function describeDevice(): { deviceName: string; browser: string; osName: string; userAgent: string } {
  const userAgent = navigator.userAgent
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser'
  const osName = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : 'Unknown'

  return {
    deviceName: `${browser} on ${osName}`,
    browser,
    osName,
    userAgent: userAgent.slice(0, 500),
  }
}
