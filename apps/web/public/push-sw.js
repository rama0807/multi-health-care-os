/* eslint-disable no-undef */
/**
 * MediCore push service worker (Milestone 18, Checkpoint 18.2).
 *
 * Standards-based: it handles the `push` and `notificationclick` events the
 * browser delivers, which is what Firebase's own `firebase-messaging-sw.js`
 * ultimately does too. Writing it directly rather than importing the Firebase
 * SDK keeps the worker dependency-free and means the same file serves any
 * push sender that delivers an FCM-shaped payload.
 *
 * Payload contract, produced by `FcmPushProvider`:
 *
 *   {
 *     notification: { title, body, image? },
 *     data: { notificationId, category, priority, deepLink?, icon? }
 *   }
 *
 * `deepLink` is mirrored into `data` deliberately: on a background click the
 * browser owns the `notification` block, so `data` is the only part this
 * handler can rely on reading.
 */

const FALLBACK_URL = '/dashboard/notifications'

self.addEventListener('install', () => {
  // Take over immediately rather than waiting for every old tab to close -
  // a stale worker would keep routing clicks with an outdated link rule.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    // A non-JSON push is still worth showing rather than dropping silently.
    payload = { notification: { title: 'MediCore', body: event.data.text() } }
  }

  const notification = payload.notification || {}
  const data = payload.data || {}
  const title = notification.title || 'MediCore'

  event.waitUntil(
    self.registration.showNotification(title, {
      body: notification.body || '',
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      image: notification.image,
      tag: data.notificationId || undefined,
      // A critical notification must survive being missed: it stays on screen
      // until the clinician dismisses it, unlike routine traffic.
      requireInteraction: data.priority === 'CRITICAL',
      data: {
        deepLink: data.deepLink || FALLBACK_URL,
        notificationId: data.notificationId || null,
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const deepLink = (event.notification.data && event.notification.data.deepLink) || FALLBACK_URL
  const target = new URL(deepLink, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Prefer focusing an open MediCore tab and navigating it, rather than
      // opening a duplicate - a clinician with the chart already open should
      // stay in the session they are in.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus().then((focused) => {
            if ('navigate' in focused) return focused.navigate(target)
            return focused
          })
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
