import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals"

function sendToPostHog(metric: Metric) {
  // PostHog might not be initialized yet, check window
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
    posthog.capture("web_vital", {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
    })
  }
}

export function reportWebVitals() {
  // Core Web Vitals (CLS, LCP, INP) + additional metrics (FCP, TTFB)
  // Note: FID was deprecated in favor of INP in web-vitals v4+
  onCLS(sendToPostHog)
  onLCP(sendToPostHog)
  onINP(sendToPostHog)
  onFCP(sendToPostHog)
  onTTFB(sendToPostHog)
}
