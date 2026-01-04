// Service Worker for FiskAI - Enhanced PWA with offline caching and background sync
const CACHE_VERSION = "v2"
const SHELL_CACHE = `fiskai-shell-${CACHE_VERSION}`
const STATIC_CACHE = `fiskai-static-${CACHE_VERSION}`
const API_CACHE = `fiskai-api-${CACHE_VERSION}`

// App shell assets - always cached
const SHELL_ASSETS = ["/", "/offline"]

// Static assets - cache-first strategy
const STATIC_PATTERNS = [
  /\.(js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp)$/,
  /\/_next\/static\//,
]

// API paths that should use network-first with cache fallback
const CACHEABLE_API_PATHS = [
  "/api/invoices",
  "/api/expenses",
  "/api/contacts",
  "/api/products",
  "/api/companies",
]

// Maximum age for cached API responses (5 minutes)
const API_CACHE_MAX_AGE = 5 * 60 * 1000

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE && key !== API_CACHE)
            .map((key) => caches.delete(key))
        )
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)
  const hostname = url.hostname
  const pathname = url.pathname

  // Check if this is an app subdomain (app., staff., admin.)
  const isAppSubdomain =
    hostname.startsWith("app.") || hostname.startsWith("staff.") || hostname.startsWith("admin.")

  // Check if this is an app path on the main domain
  const isAppPath =
    pathname.startsWith("/app/") || pathname.startsWith("/staff/") || pathname.startsWith("/admin/")

  // For app subdomains and paths, apply caching strategies
  if (isAppSubdomain || isAppPath) {
    // Static assets - cache first
    if (isStaticAsset(pathname)) {
      event.respondWith(cacheFirst(event.request, STATIC_CACHE))
      return
    }

    // API requests - network first with cache fallback
    if (isCacheableApi(pathname)) {
      event.respondWith(networkFirstWithCache(event.request, API_CACHE))
      return
    }

    // HTML pages in app - stale-while-revalidate
    if (
      event.request.headers.get("Accept")?.includes("text/html") &&
      !pathname.startsWith("/api/")
    ) {
      event.respondWith(staleWhileRevalidate(event.request, SHELL_CACHE))
      return
    }

    // Other requests - network only
    return
  }

  // Marketing site - network first with offline fallback
  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
      .then((response) => response || caches.match("/offline"))
  )
})

// Background sync for offline mutations
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-offline-data") {
    event.waitUntil(syncOfflineData())
  }
})

// Push notification support
self.addEventListener("push", (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/badge-72x72.png",
    data: data.url || "/",
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(data.title || "FiskAI", options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data))
})

// Helper functions

function isStaticAsset(pathname) {
  return STATIC_PATTERNS.some((pattern) => pattern.test(pathname))
}

function isCacheableApi(pathname) {
  return CACHEABLE_API_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"))
}

// Cache-first strategy for static assets
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response("Offline", { status: 503 })
  }
}

// Network-first with cache fallback for API requests
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      // Add timestamp header for cache validation
      const headers = new Headers(response.headers)
      headers.set("sw-cache-time", Date.now().toString())
      const cachedResponse = new Response(await response.clone().blob(), {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
      cache.put(request, cachedResponse)
    }
    return response
  } catch {
    // Network failed, try cache
    const cached = await caches.match(request)
    if (cached) {
      const cacheTime = cached.headers.get("sw-cache-time")
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime, 10)
        // Return cached response with warning header if stale
        if (age > API_CACHE_MAX_AGE) {
          const headers = new Headers(cached.headers)
          headers.set("sw-cache-stale", "true")
          return new Response(await cached.blob(), {
            status: cached.status,
            statusText: cached.statusText,
            headers,
          })
        }
      }
      return cached
    }
    return new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })
  }
}

// Stale-while-revalidate for HTML pages
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      caches.open(cacheName).then((cache) => cache.put(request, response.clone()))
    }
    return response
  })

  return cached || fetchPromise.catch(() => caches.match("/offline"))
}

// Sync offline data when connection is restored
async function syncOfflineData() {
  // This communicates with the main thread to trigger sync
  const allClients = await clients.matchAll({ type: "window" })
  for (const client of allClients) {
    client.postMessage({ type: "SYNC_OFFLINE_DATA" })
  }
}

// Listen for messages from the main thread
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting()
  }
  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)))
  }
})
