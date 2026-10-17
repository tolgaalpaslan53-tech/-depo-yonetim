self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'AKTİVA', body: event.data ? event.data.text() : 'Yeni bildirim' }; }
  event.waitUntil(self.registration.showNotification(String(data.title || 'AKTİVA'), {
    body: String(data.body || 'Yeni görev'), tag: String(data.tag || 'aktiva'),
    data: { url: './' }
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const windowClient of windows) {
      if ('focus' in windowClient) { await windowClient.focus(); return; }
    }
    await clients.openWindow(event.notification.data?.url || './');
  })());
});
