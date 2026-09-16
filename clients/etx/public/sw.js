/**
 * Воркер ради установки на домашний экран.
 *
 * Chrome не предлагает «Add to Home Screen», пока не зарегистрирован
 * service worker с обработчиком `fetch`. Этот файл существует только
 * ради этой проверки.
 *
 * НИЧЕГО НЕ КЭШИРУЕТСЯ. Обработчик не вызывает `respondWith`, поэтому
 * каждый запрос по-прежнему идёт в сеть. Код кошелька должен приходить
 * с сервера при каждом открытии: устаревший или подменённый скрипт —
 * это украденный кошелёк.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {})
