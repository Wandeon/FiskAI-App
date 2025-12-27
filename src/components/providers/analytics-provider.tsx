"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initAnalytics, trackPageView } from "@/lib/analytics"
import { reportWebVitals } from "@/lib/web-vitals"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    initAnalytics()
    // Report Core Web Vitals after PostHog is initialized
    reportWebVitals()
  }, [])

  useEffect(() => {
    if (pathname) {
      const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
      trackPageView(url)
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
