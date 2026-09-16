/**
 * Installability worker.
 *
 * Chrome will not offer "Add to Home Screen" unless a service worker
 * is registered and has a `fetch` listener. This file exists for that
 * check alone.
 *
 * NOTHING IS CACHED. The listener does not call `respondWith`, so
 * every request still goes to the network. Wallet code must come from
 * the server on each open: a stale or swapped script is a stolen
 * wallet.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {})
