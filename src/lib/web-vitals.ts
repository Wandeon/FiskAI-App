// src/lib/web-vitals.ts
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals"

type RouteGroup = "marketing" | "kb" | "app" | "staff" | "admin" | "other"

function getRouteGroup(pathname: string): RouteGroup {
  if (pathname.startsWith("/app")) return "app"
  if (pathname.startsWith("/staff")) return "staff"
  if (pathname.startsWith("/admin")) return "admin"
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

export function reportWebVitals(pathname: string) {
  const sendMetric = (metric: Metric) => sendToPostHog(metric, pathname)

  onCLS(sendMetric)
  onLCP(sendMetric)
  onINP(sendMetric)
  onFCP(sendMetric)
  onTTFB(sendMetric)
}
