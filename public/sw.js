// Web push for "rebalance due" notices. Registered by the Invest page's
// "Browser notifications" toggle; the server sends { title, body, url }.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Orchestra", {
      body: data.body || "",
      data: { url: data.url || "/invest" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
