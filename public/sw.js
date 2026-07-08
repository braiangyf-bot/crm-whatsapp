const CACHE_NAME = "crm-whatsapp-cache-v1";
const URLS_INICIALES = ["/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_INICIALES);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "CRM WhatsApp",
    body: "Tienes una nueva notificación.",
    url: "/",
    tag: "crm-whatsapp",
  };

  if (event.data) {
    try {
      payload = {
        ...payload,
        ...event.data.json(),
      };
    } catch {
      payload.body = event.data.text();
    }
  }

 const opciones = {
  body: payload.body,
  icon: "/icons/icon.svg",
  badge: "/icons/icon.svg",
  tag: `${payload.tag || "crm-whatsapp"}-${Date.now()}`,
  renotify: true,
  timestamp: Date.now(),
  data: {
    url: payload.url || "/",
  },
};

  event.waitUntil(
    self.registration.showNotification(payload.title || "CRM WhatsApp", opciones)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      for (const cliente of clientes) {
        if ("focus" in cliente) {
          cliente.navigate(url);
          return cliente.focus();
        }
      }

      return self.clients.openWindow(url);
    })
  );
});