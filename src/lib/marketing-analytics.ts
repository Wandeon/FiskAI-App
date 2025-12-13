import { trackEvent } from "@/lib/analytics"

/**
 * Marketing-specific analytics events for conversion tracking
 * These events track the marketing funnel from visitor to paying customer
 */

export const MarketingEvents = {
  // Landing page interactions
  LANDING_PAGE_VIEWED: "landing_page_viewed",
  FEATURES_PAGE_VIEWED: "features_page_viewed",
  PRICING_PAGE_VIEWED: "pricing_page_viewed",
  SECURITY_PAGE_VIEWED: "security_page_viewed",
  CONTACT_PAGE_VIEWED: "contact_page_viewed",
  SEGMENT_PAGE_VIEWED: "segment_page_viewed", // e.g., /for/pausalni-obrt

  // Conversion funnel events
  FREE_TRIAL_CLICKED: "free_trial_clicked",
  DEMO_REQUEST_CLICKED: "demo_request_clicked",
  PRICING_PLAN_CLICKED: "pricing_plan_clicked",
  SIGNUP_BUTTON_CLICKED: "signup_button_clicked",
  LOGIN_BUTTON_CLICKED: "login_button_clicked",
  
  // Demo request form events
  DEMO_FORM_STARTED: "demo_form_started",
  DEMO_FORM_COMPLETED: "demo_form_completed",
  DEMO_FORM_ABANDONED: "demo_form_abandoned",
  
  // Registration funnel events
  REGISTRATION_STARTED: "registration_started",
  REGISTRATION_COMPLETED: "registration_completed",
  REGISTRATION_ABANDONED: "registration_abandoned",
  
  // Email capture events
  NEWSLETTER_SIGNUP: "newsletter_signup",
  
  // Support interactions
  CONTACT_FORM_SUBMITTED: "contact_form_submitted",
  SUPPORT_CALL_CLICKED: "support_call_clicked",
  SUPPORT_EMAIL_CLICKED: "support_email_clicked",
  
  // Trust signals
  TRUST_PAGE_VIEWED: "trust_page_viewed", // /security, /privacy, etc.
  LEGAL_PAGE_VIEWED: "legal_page_viewed",
  
  // Social proof interactions
  TESTIMONIAL_VIEWED: "testimonial_viewed",
  CASE_STUDY_VIEWED: "case_study_viewed",
  
  // Segment-specific conversions
  PAUSALNI_OBRT_CONVERSION: "pausalni_obrt_conversion",
  DOO_CONVERSION: "doo_conversion",
  ACCOUNTANT_CONVERSION: "accountant_conversion",
} as const

/**
 * Track a marketing conversion event
 */
export function trackMarketingEvent(
  event: keyof typeof MarketingEvents,
  properties?: Record<string, unknown>
) {
  trackEvent(MarketingEvents[event], {
    ...properties,
    timestamp: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
  })
}

/**
 * Track free trial conversion
 */
export function trackFreeTrialConversion(segment?: string, plan?: string) {
  trackMarketingEvent("FREE_TRIAL_CLICKED", { segment, plan })
  
  // Also track segment-specific conversion if applicable
  if (segment === "pausalni-obrt") {
    trackMarketingEvent("PAUSALNI_OBRT_CONVERSION")
  } else if (segment === "doo") {
    trackMarketingEvent("DOO_CONVERSION")
  } else if (segment === "accountant") {
    trackMarketingEvent("ACCOUNTANT_CONVERSION")
  }
}

/**
 * Track demo request
 */
export function trackDemoRequest(
  businessType?: string,
  invoiceCount?: string,
  sourcePage?: string
) {
  trackMarketingEvent("DEMO_FORM_COMPLETED", {
    business_type: businessType,
    invoice_count: invoiceCount,
    source_page: sourcePage,
  })
  
  // Track segment-specific demo if applicable
  if (businessType === "pausalni-obrt") {
    trackMarketingEvent("PAUSALNI_OBRT_CONVERSION")
  } else if (businessType === "doo" || businessType === "vat-obrt") {
    trackMarketingEvent("DOO_CONVERSION")
  } else if (businessType === "accountant") {
    trackMarketingEvent("ACCOUNTANT_CONVERSION")
  }
}

/**
 * Track registration completion
 */
export function trackRegistrationComplete(
  email: string,
  businessType?: string,
  companySize?: string
) {
  trackMarketingEvent("REGISTRATION_COMPLETED", {
    email,
    business_type: businessType,
    company_size: companySize,
  })
  
  // For analytics, also track the standard user identification
  // (Note: user-specific identification happens in auth flow)
}

/**
 * Track page view for marketing pages
 */
export function trackMarketingPageView(page: string, segment?: string) {
  let event: keyof typeof MarketingEvents
  
  switch (page) {
    case "/":
      event = "LANDING_PAGE_VIEWED"
      break
    case "/features":
      event = "FEATURES_PAGE_VIEWED"
      break
    case "/pricing":
      event = "PRICING_PAGE_VIEWED"
      break
    case "/security":
      event = "SECURITY_PAGE_VIEWED"
      break
    case "/contact":
      event = "CONTACT_PAGE_VIEWED"
      break
    default:
      if (page.startsWith("/for/")) {
        event = "SEGMENT_PAGE_VIEWED"
      } else if (page.includes("privacy") || page.includes("terms") || page.includes("dpa")) {
        event = "LEGAL_PAGE_VIEWED"
      } else {
        return // Don't track non-marketing pages
      }
  }
  
  trackMarketingEvent(event, { page, segment })
}

/**
 * Track trust signal interaction
 */
export function trackTrustSignal(
  signalType: "security" | "privacy" | "gdpr" | "sla" | "testimonial" | "case_study",
  details?: string
) {
  if (signalType === "testimonial") {
    trackMarketingEvent("TESTIMONIAL_VIEWED", { testimonial: details })
  } else if (signalType === "case_study") {
    trackMarketingEvent("CASE_STUDY_VIEWED", { case_study: details })
  } else if (signalType === "security" || signalType === "privacy" || signalType === "gdpr") {
    trackMarketingEvent("TRUST_PAGE_VIEWED", { page: signalType })
  }
}

/**
 * Track contact form submission
 */
export function trackContactFormSubmission(
  formType: "demo" | "support" | "general" | "sales",
  topic?: string
) {
  trackMarketingEvent("CONTACT_FORM_SUBMITTED", {
    form_type: formType,
    topic,
  })
}

/**
 * Track support interaction
 */
export function trackSupportInteraction(
  type: "call" | "email" | "chat",
  urgency?: "standard" | "urgent"
) {
  if (type === "call") {
    trackMarketingEvent("SUPPORT_CALL_CLICKED", { urgency })
  } else if (type === "email") {
    trackMarketingEvent("SUPPORT_EMAIL_CLICKED", { urgency })
  }
}

/**
 * Initialize marketing analytics on page load
 * This should be called from marketing pages
 */
export function initMarketingAnalytics() {
  if (typeof window === "undefined") return
  
  // Track the initial page view
  const pathname = window.location.pathname
  const segment = pathname.startsWith("/for/") ? pathname.split("/")[2] : undefined
  
  trackMarketingPageView(pathname, segment)
  
  // Set up click tracking for conversion buttons
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement
    const button = target.closest("button, a")
    
    if (!button) return
    
    const text = button.textContent?.toLowerCase() || ""
    const href = button.getAttribute("href")
    
    // Track free trial clicks
    if (text.includes("započni") || text.includes("besplatno") || text.includes("trial")) {
      const segmentMatch = window.location.pathname.match(/\/for\/([^/]+)/)
      const segment = segmentMatch ? segmentMatch[1] : undefined
      trackFreeTrialConversion(segment)
    }
    
    // Track demo request clicks
    if (text.includes("demo") || text.includes("zahtjev") || (href && href.includes("contact"))) {
      trackMarketingEvent("DEMO_REQUEST_CLICKED")
    }
    
    // Track signup clicks
    if (text.includes("prijava") || text.includes("signup") || text.includes("register")) {
      trackMarketingEvent("SIGNUP_BUTTON_CLICKED")
    }
    
    // Track login clicks
    if (text.includes("login") || text.includes("prijava")) {
      trackMarketingEvent("LOGIN_BUTTON_CLICKED")
    }
  }, { capture: true })
}