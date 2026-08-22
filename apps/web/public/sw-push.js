self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Innflo", body: event.data?.text() ?? "You have a new update." };
  }
  const title = data.title ?? "Hotel PMS";
  const options = {
    body: data.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url ?? "/housekeeping/mobile" },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    tag: data.url ? `innflo:${data.url}` : "innflo:operations",
    renotify: true,
    // Ask the platform to alert explicitly instead of leaving sound/vibration
    // to its default convention. Android's notification channel can still
    // override this, but the web notification itself is never marked silent.
    silent: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    }),
  );
});
