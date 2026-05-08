// AutoViral Service Worker — handles push notifications
const CACHE_NAME = 'autoviral-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'AutoViral', body: event.data?.text() || 'Your video is ready!' };
  }

  const title = data.title || 'AutoViral';
  const options = {
    body: data.body || 'Your video has been generated successfully.',
    icon: '/AutoViral/logo.png',
    badge: '/AutoViral/logo.png',
    tag: data.tag || 'autoviral-notification',
    data: { url: data.url || '/AutoViral/manual', postId: data.postId },
    requireInteraction: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'view', title: 'View Video' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/AutoViral/manual';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/AutoViral') && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
