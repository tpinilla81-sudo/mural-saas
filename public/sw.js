/* MURAL service worker — minimal & safe.
 * Instalabilidad PWA (Android/Chrome). NO intercepta respuestas (passthrough):
 * la app siempre se sirve desde la red, sin riesgo de cachés obsoletas.
 * + Web Push: recibe las notificaciones de los AVISOS PROGRAMADOS. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // passthrough intencional: no respondWith → red siempre.
});

// ── Push: mostrar la notificación al llegar ──
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "🔔 Aviso", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "🔔 Aviso programado";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    renotify: !!(data.tag),
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic en la notificación → abrir/focus la app ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ws) => {
      for (const w of ws) {
        if ("focus" in w) {
          if (w.navigate) { try { w.navigate(url); } catch (e) { /* noop */ } }
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
