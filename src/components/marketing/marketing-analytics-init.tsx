"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { initMarketingAnalytics, trackMarketingPageView } from "@/lib/marketing-analytics"

/**
 * Component to initialize marketing analytics for marketing pages
 * This should be used in marketing page layouts to track conversions
 */
export function MarketingAnalyticsInit() {
  const pathname = usePathname()

  useEffect(() => {
    // Initialize marketing analytics
    initMarketingAnalytics()
  }, [])

  useEffect(() => {
    if (pathname) {
      // Extract segment from pathname (e.g., /for/pausalni-obrt -> "pausalni-obrt")
      const segment = pathname.startsWith("/for/") ? pathname.split("/")[2] : undefined
      trackMarketingPageView(pathname, segment)
    }
  }, [pathname])

  return null // This component doesn't render anything
}

/**
 * Hook to track marketing events in components
 */
export function useMarketingAnalytics() {
  const pathname = usePathname()

  const trackConversion = (
    event: "free_trial" | "demo_request" | "signup" | "contact",
    properties?: Record<string, unknown>
  ) => {
    const segment = pathname?.startsWith("/for/") ? pathname.split("/")[2] : undefined
    
    switch (event) {
      case "free_trial":
        import("@/lib/marketing-analytics").then(({ trackFreeTrialConversion }) => {
          trackFreeTrialConversion(segment, properties?.plan as string)
        })
        break
      case "demo_request":
        import("@/lib/marketing-analytics").then(({ trackDemoRequest }) => {
          trackDemoRequest(
            properties?.businessType as string,
            properties?.invoiceCount as string,
            pathname || undefined
          )
        })
        break
      case "signup":
        import("@/lib/marketing-analytics").then(({ trackRegistrationComplete }) => {
          trackRegistrationComplete(
            properties?.email as string,
            properties?.businessType as string,
            properties?.companySize as string
          )
        })
        break
      case "contact":
        import("@/lib/marketing-analytics").then(({ trackContactFormSubmission }) => {
          trackContactFormSubmission(
            properties?.formType as "demo" | "support" | "general" | "sales",
            properties?.topic as string
          )
        })
        break
    }
  }

  const trackTrustSignal = (
    signalType: "security" | "privacy" | "gdpr" | "sla" | "testimonial" | "case_study",
    details?: string
  ) => {
    import("@/lib/marketing-analytics").then(({ trackTrustSignal }) => {
      trackTrustSignal(signalType, details)
    })
  }

  const trackSupportInteraction = (
    type: "call" | "email" | "chat",
    urgency?: "standard" | "urgent"
  ) => {
    import("@/lib/marketing-analytics").then(({ trackSupportInteraction }) => {
      trackSupportInteraction(type, urgency)
    })
  }

  return {
    trackConversion,
    trackTrustSignal,
    trackSupportInteraction,
  }
}

/**
 * Button component with built-in analytics tracking
 */
export function TrackedButton({
  children,
  onClick,
  event,
  properties,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  event: "free_trial" | "demo_request" | "signup" | "contact"
  properties?: Record<string, unknown>
}) {
  const { trackConversion } = useMarketingAnalytics()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    trackConversion(event, properties)
    if (onClick) onClick(e)
  }

  return (
    <button onClick={handleClick} {...props}>
      {children}
    </button>
  )
}

/**
 * Link component with built-in analytics tracking
 */
export function TrackedLink({
  children,
  href,
  event,
  properties,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  event: "free_trial" | "demo_request" | "signup" | "contact"
  properties?: Record<string, unknown>
}) {
  const { trackConversion } = useMarketingAnalytics()

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackConversion(event, properties)
    // Allow default navigation to happen
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}