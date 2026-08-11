const CACHE_VERSION = 'v11'
// Replaced at build time by scripts/build-sw.mjs with the hashed bundle the
// build actually emitted, and a build id derived from those filenames.
//
// It has to be injected rather than listed here because the names carry a
// content hash that changes every build. Left empty — as it is in the source
// file the dev server serves verbatim — the worker still installs and still
// caches at runtime; it just cannot guarantee a cold offline start.
const BUILD_ASSETS = []
const BUILD_ID = 'source'
const CACHE_NAME = `baby-feeding-tracker-lullaby-${CACHE_VERSION}-${BUILD_ID}`
const STATIC_SHELL = ['/', '/manifest.webmanifest', '/app-icon.svg', '/app-icon-192.png', '/app-icon-512.png', '/favicon.svg']
const APP_SHELL = STATIC_SHELL.concat(BUILD_ASSETS)

self.addEventListener('install', (event) => {
  // Cached one at a time rather than with addAll, which rejects the whole
  // batch if any single entry 404s — and a failed install means no worker at
  // all, which is far worse than a missing icon. The offline-boot spec asserts
  // the entries that actually matter did land.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))),
  )
  // Deliberately no skipWaiting(): taking over mid-session can leave a running
  // page using a shell it was not built against. The new worker waits until the
  // app asks it to activate (below), which it does on a user tap.
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (url.pathname.startsWith('/api/')) return
  if (request.method !== 'GET') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only a real success is worth keeping. Caching indiscriminately meant a
        // 502 served during a deploy became the offline fallback and stayed
        // there — the app would keep handing back a gateway error long after the
        // deploy finished. `ok` also excludes opaque cross-origin responses,
        // whose status is always 0 and whose body we cannot inspect.
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        return caches.match('/')
      }),
  )
})
