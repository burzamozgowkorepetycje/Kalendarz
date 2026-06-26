// Minimalny service worker — umożliwia instalację PWA bez cache'owania danych.
// Świadomie NIE cache'ujemy odpowiedzi (panel jest oparty na świeżych danych z API),
// więc fetch po prostu przechodzi do sieci.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // network passthrough — zawsze aktualne dane
  event.respondWith(fetch(event.request))
})
