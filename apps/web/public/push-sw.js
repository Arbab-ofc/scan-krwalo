self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "Scan Krwalo";
  const options = {
    body: payload.body || "New notification",
    tag: payload.tag || "scan-krwalo",
    data: { url: payload.url || "/scanner/live-tasks" },
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
