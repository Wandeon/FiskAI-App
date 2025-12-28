"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initAnalytics, trackPageView } from "@/lib/analytics"
import { reportWebVitals } from "@/lib/web-vitals"
import { registerServiceWorker } from "@/lib/register-sw"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const webVitalsReported = useRef(false)

  useEffect(() => {
    initAnalytics()
    // Register service worker for offline support
    registerServiceWorker()
  }, [])

  useEffect(() => {
    // Report CWV once per session with initial pathname
    if (!webVitalsReported.current && pathname) {
      reportWebVitals(pathname)
      webVitalsReported.current = true
    }
  }, [pathname])

  useEffect(() => {
    if (pathname) {
      const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
      trackPageView(url)
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
