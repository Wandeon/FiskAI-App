# Phase D: App Feel Implementation Plan

> Reference: `2025-12-27-authority-first-performance-design.md`

## Overview

This phase adds minimal PWA support for installability. Intentionally de-prioritized - no offline-first AI, background sync, or push notifications.

---

## Task D1: PWA Manifest

### Goal

Create web app manifest for installability.

### Files to Create

- `public/site.webmanifest`

### Files to Modify

- `src/app/layout.tsx` (add manifest link)

### Implementation

```json
// public/site.webmanifest
{
  "name": "FiskAI",
  "short_name": "FiskAI",
  "description": "AI-powered e-invoicing and fiscalization for Croatian businesses",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#38bdf8",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["business", "finance", "productivity"],
  "lang": "hr",
  "dir": "ltr"
}
```

### Layout Update

```tsx
// src/app/layout.tsx
export const metadata: Metadata = {
  // ... existing metadata
  manifest: "/site.webmanifest",
}
```

### Icon Generation

Generate PWA icons from existing SVG:

```bash
# Using sharp-cli or similar
npx sharp -i public/icon.svg -o public/icon-192.png resize 192 192
npx sharp -i public/icon.svg -o public/icon-512.png resize 512 512
```

### Acceptance Criteria

- [ ] Manifest linked in HTML head
- [ ] 192x192 and 512x512 icons present
- [ ] Chrome shows "Install" option
- [ ] Installed app opens in standalone mode

---

## Task D2: Minimal Service Worker

### Goal

Register service worker for cache shell and offline page.

### Files to Create

- `public/sw.js`
- `src/lib/register-sw.ts`

### Files to Modify

- `src/components/providers/analytics-provider.tsx`

### Implementation

```javascript
// public/sw.js
const CACHE_NAME = "fiskai-shell-v1"
const SHELL_ASSETS = ["/", "/offline", "/icon.svg", "/icon-192.png", "/icon-512.png"]

// Install - cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)))
  self.skipWaiting()
})

// Activate - clean old caches
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

// Fetch - network first, fallback to cache, then offline page
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") return

  // Skip API and auth routes
  const url = new URL(event.request.url)
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
```

```typescript
// src/lib/register-sw.ts
export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered:", registration.scope)
      })
      .catch((error) => {
        console.log("SW registration failed:", error)
      })
  })
}
```

### Analytics Provider Update

```tsx
// src/components/providers/analytics-provider.tsx
import { registerServiceWorker } from "@/lib/register-sw"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // ... existing PostHog init and web vitals

    // Register service worker
    registerServiceWorker()
  }, [])

  return <>{children}</>
}
```

### Acceptance Criteria

- [ ] Service worker registered on page load
- [ ] Shell assets cached
- [ ] Offline page shown when network unavailable
- [ ] No interference with authenticated routes

---

## Task D3: Offline Page

### Goal

Create simple offline fallback page.

### Files to Create

- `src/app/offline/page.tsx`

### Implementation

```tsx
// src/app/offline/page.tsx
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Offline",
  description: "You are currently offline",
  robots: { index: false, follow: false },
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 mx-auto mb-6 text-muted-foreground">
          {/* Offline icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Niste spojeni na internet</h1>
        <p className="text-muted-foreground mb-6">
          Provjerite svoju internetsku vezu i pokušajte ponovo.
        </p>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          Pokušaj ponovo
        </button>
      </div>
    </div>
  )
}
```

### Acceptance Criteria

- [ ] Page accessible at /offline
- [ ] Not indexed by search engines
- [ ] Retry button refreshes page
- [ ] Works without JavaScript (basic HTML renders)

---

## Verification Checklist

After completing all tasks:

1. [ ] Run `npx tsc --noEmit` - no type errors
2. [ ] Check manifest in DevTools > Application > Manifest
3. [ ] Verify service worker in DevTools > Application > Service Workers
4. [ ] Test install prompt in Chrome/Edge
5. [ ] Test offline by disabling network in DevTools
6. [ ] Lighthouse PWA audit passes basic criteria

---

## Out of Scope (Intentionally)

- Offline-first AI capabilities
- Background sync
- Push notifications
- Workbox or other SW frameworks
- IndexedDB data caching

---

## Dependencies

- Icon generation tool (sharp-cli or manual creation)
- Icons should be created from existing brand assets
