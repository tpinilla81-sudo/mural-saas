/* MURAL service worker — minimal & safe.
 * Instalabilidad PWA (Android/Chrome). NO intercepta respuestas (passthrough):
 * la app siempre se sirve desde la red, sin riesgo de cachés obsoletas. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // passthrough intencional: no respondWith → red siempre.
});
