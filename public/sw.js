// Service Worker for FiskAI - Cache shell and offline support
const CACHE_NAME = "fiskai-shell-v1"
const SHELL_ASSETS = ["/", "/offline"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return

  const url = new URL(event.request.url)

  // Skip authenticated app subdomains entirely (app.fiskai.hr, staff.fiskai.hr, admin.fiskai.hr)
  const hostname = url.hostname
  if (
    hostname.startsWith("app.") ||
    hostname.startsWith("staff.") ||
    hostname.startsWith("admin.")
  ) {
    return
  }

  // Skip API and authenticated route paths on main domain
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/app/") ||
    url.pathname.startsWith("/staff/") ||
    url.pathname.startsWith("/admin/")
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request))
      .then((response) => response || caches.match("/offline"))
  )
})
