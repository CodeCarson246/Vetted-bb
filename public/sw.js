/* Vetted.bb service worker — web push notifications */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'Vetted.bb', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Vetted.bb'
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    // Group notifications by URL so multiple messages from the same
    // section collapse into one instead of stacking individually.
    tag: data.tag || data.url || 'vetted-general',
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url: data.url || '/inbox' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/inbox'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if one is open, otherwise open a new one
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
