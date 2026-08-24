// Service worker minimal : uniquement pour recevoir les notifications push
// ("à toi de jouer !"). Pas de mise en cache, pas de mode hors-ligne — juste
// le strict nécessaire pour que le navigateur autorise l'abonnement Push.

self.addEventListener("push", (event) => {
  let data = { title: "Karré", body: "Nouvelle notification", url: "/" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // charge utile non-JSON : on garde les valeurs par défaut
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
