// src/lib/web-vitals.ts
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals"

type RouteGroup = "marketing" | "kb" | "app" | "staff" | "admin" | "other"

/**
 * Determines route group from hostname (subdomain) and pathname.
 * Production uses app.fiskai.hr with path-based routing (/staff, /admin).
 * Marketing site at www.fiskai.hr uses pathname-based detection.
 *
 * Note: Legacy subdomain detection kept for backwards compatibility during transition.
 */
function getRouteGroup(pathname: string): RouteGroup {
  // Check hostname for subdomain-based routing (production)
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname
    if (hostname.startsWith("app.")) return "app"
    if (hostname.startsWith("staff.")) return "staff"
    if (hostname.startsWith("admin.")) return "admin"
  }

  // Pathname-based detection for marketing site (fiskai.hr)
  if (
    pathname.startsWith("/vodic") ||
    pathname.startsWith("/rjecnik") ||
    pathname.startsWith("/kako-da") ||
    pathname.startsWith("/vijesti") ||
    pathname.startsWith("/baza-znanja") ||
    pathname.startsWith("/usporedba")
  ) {
    return "kb"
  }
  if (
    pathname === "/" ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register")
  ) {
    return "marketing"
  }
  return "other"
}

function sendToPostHog(metric: Metric, pathname: string) {
  if (
    typeof window !== "undefined" &&
    (
      window as unknown as {
        posthog?: { capture: (event: string, properties: Record<string, unknown>) => void }
      }
    ).posthog
  ) {
    const posthog = (
      window as unknown as {
        posthog: { capture: (event: string, properties: Record<string, unknown>) => void }
      }
    ).posthog

    const routeGroup = getRouteGroup(pathname)

    posthog.capture("web_vital", {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      // Route tagging for SLO segmentation
      route_group: routeGroup,
      pathname: pathname,
    })
  }
}

/**
 * Reports Core Web Vitals to PostHog.
 *
 * Design decision: The pathname is captured once when reportWebVitals is called
 * (typically on initial mount). This is intentional - CWV metrics like LCP and CLS
 * measure the initial page load experience. SPA navigations don't trigger new
 * CWV measurements, so binding to the initial pathname is correct. If you need
 * per-navigation metrics, you would need to re-initialize the web-vitals library
 * on each route change.
 */
export function reportWebVitals(pathname: string) {
  const sendMetric = (metric: Metric) => sendToPostHog(metric, pathname)

  onCLS(sendMetric)
  onLCP(sendMetric)
  onINP(sendMetric)
  onFCP(sendMetric)
  onTTFB(sendMetric)
}
