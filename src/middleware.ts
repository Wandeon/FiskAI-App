import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { logger } from "./lib/logger"
import {
  getSubdomain,
  getRedirectUrlForSystemRole,
  canAccessSubdomain,
} from "@/lib/middleware/subdomain"
import { getCacheHeaders } from "@/lib/cache-headers"
import {
  detectAIBot,
  shouldSkipPath,
  shouldTrackCrawl,
  buildCrawlEvent,
  trackCrawlerHit,
} from "@/lib/ai-crawler"
import { generateCSP } from "@/lib/middleware/csp"
import { checkRateLimit } from "@/lib/security/rate-limit"

// Public API routes that don't require authentication
// All other API routes will require a valid session token
const PUBLIC_API_ROUTES = [
  "/api/health", // Health checks (load balancers)
  "/api/health/ready", // Readiness probes
  "/api/health/content-pipelines", // Pipeline health checks
  "/api/status", // System status (monitoring)
  "/api/auth/", // NextAuth authentication
  "/api/cron/", // Cron jobs (protected by CRON_SECRET)
  "/api/webhooks/", // Webhooks (protected by signature verification)
  "/api/billing/webhook", // Stripe webhook (protected by signature)
  "/api/e-invoices/receive", // E-invoice webhook (external system)
  "/api/bank/callback", // Bank callback (external system)
  "/api/email/callback", // Email callback (external system)
  "/api/newsletter/unsubscribe", // Newsletter unsubscribe (public action)
  "/api/sandbox/", // Sandbox endpoints (for testing)
]

// Check if an API route is public
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))
}

// Routes to skip (API, static assets, etc.)
function shouldSkipRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  )
}

// Get the real host from forwarded headers (for reverse proxy setups)
function getRealHost(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host
  )
}

// Build external URL from forwarded headers
function getExternalUrl(request: NextRequest): URL {
  const proto = request.headers.get("x-forwarded-proto") || "https"
  const host = getRealHost(request)
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `${proto}://${host}`)
  return url
}

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
  const startTime = Date.now()
  const pathname = request.nextUrl.pathname

  // Generate CSP nonce for this request
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")

  // Log incoming request
  logger.info(
    {
      requestId,
      method: request.method,
      path: pathname,
      host: getRealHost(request),
      userAgent: request.headers.get("user-agent")?.slice(0, 100),
    },
    "Incoming request"
  )

  // AI Crawler Detection - fire and forget (non-blocking)
  const userAgent = request.headers.get("user-agent") || ""
  if (!shouldSkipPath(pathname)) {
    const botName = detectAIBot(userAgent)
    if (botName && shouldTrackCrawl(botName, pathname)) {
      const crawlEvent = buildCrawlEvent(botName, pathname, request.method)
      // Fire and forget - don't await
      trackCrawlerHit(crawlEvent).catch(() => {
        // Silently ignore errors
      })
      logger.debug(
        {
          requestId,
          botName,
          path: pathname,
        },
        "AI crawler detected"
      )
    }
  }

  // Skip static files
  if (shouldSkipRoute(pathname)) {
    const response = NextResponse.next()
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Detect subdomain using real host
  const realHost = getRealHost(request)
  const subdomain = getSubdomain(realHost)

  // Marketing subdomain - apply rate limiting for unauthenticated traffic
  if (subdomain === "marketing") {
    // Rate limit unauthenticated traffic by IP address
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "anonymous"

    const rateLimitResult = await checkRateLimit(`unauthenticated_${ip}`, "UNAUTHENTICATED_TRAFFIC")

    if (!rateLimitResult.allowed) {
      logger.warn(
        {
          requestId,
          ip,
          pathname,
          blockedUntil: rateLimitResult.blockedUntil,
        },
        "Rate limit exceeded for unauthenticated traffic"
      )

      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "Content-Type": "text/plain",
          "x-request-id": requestId,
        },
      })
    }

    const response = NextResponse.next()
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-subdomain", subdomain)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)

    // Apply cache headers for public KB pages
    const cacheHeaders = getCacheHeaders(pathname)
    if (cacheHeaders) {
      for (const [key, value] of Object.entries(cacheHeaders)) {
        response.headers.set(key, value)
      }
    }

    // Apply CSP with nonce
    response.headers.set("Content-Security-Policy", generateCSP(nonce))
    response.headers.set("x-nonce", nonce)

    return response
  }

  // Protected subdomains require authentication
  const token = await getToken({ req: request })

  if (!token) {
    // Redirect to login on marketing subdomain
    const externalUrl = getExternalUrl(request)
    const loginUrl = new URL("/login", externalUrl)
    loginUrl.hostname = externalUrl.hostname.replace(/^(app|staff|admin)\./, "")
    loginUrl.searchParams.set("callbackUrl", externalUrl.toString())

    logger.info(
      {
        requestId,
        subdomain,
        pathname,
      },
      "Redirecting unauthenticated user to login"
    )

    const response = NextResponse.redirect(loginUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    response.headers.set("Content-Security-Policy", generateCSP(nonce))
    return response
  }

  // Check subdomain access based on user's system role
  const systemRole = (token.systemRole as string) || "USER"

  if (!canAccessSubdomain(systemRole, subdomain)) {
    // Redirect to correct subdomain for user's role
    const externalUrl = getExternalUrl(request)
    const redirectUrl = getRedirectUrlForSystemRole(
      systemRole as "USER" | "STAFF" | "ADMIN",
      externalUrl.toString()
    )

    logger.info(
      {
        requestId,
        systemRole,
        currentSubdomain: subdomain,
        redirectUrl,
      },
      "Redirecting user to correct subdomain for their role"
    )

    const response = NextResponse.redirect(redirectUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    response.headers.set("Content-Security-Policy", generateCSP(nonce))
    return response
  }

  // Auto-redirect STAFF/ADMIN users from app subdomain to their primary subdomain
  // This prevents confusion where staff see client UI instead of staff tools
  if (subdomain === "app" && (systemRole === "STAFF" || systemRole === "ADMIN")) {
    const externalUrl = getExternalUrl(request)
    const redirectUrl = getRedirectUrlForSystemRole(
      systemRole as "USER" | "STAFF" | "ADMIN",
      externalUrl.toString()
    )

    logger.info(
      {
        requestId,
        systemRole,
        currentSubdomain: subdomain,
        redirectUrl,
      },
      "Auto-redirecting staff/admin user from app subdomain to their primary subdomain"
    )

    const response = NextResponse.redirect(redirectUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    response.headers.set("Content-Security-Policy", generateCSP(nonce))
    return response
  }

  // Rewrite to appropriate route group based on subdomain
  const url = request.nextUrl.clone()

  // Map subdomain to route group
  // Note: "marketing" is handled above and returns early, so subdomain here is only "staff" | "app" | "admin"
  let routeGroup = ""
  switch (subdomain) {
    case "admin":
      routeGroup = "/(admin)"
      break
    case "staff":
      routeGroup = "/(staff)"
      break
    case "app":
    default:
      routeGroup = "/(app)"
  }

  // Don't rewrite if already in the correct route group
  if (!pathname.startsWith(routeGroup)) {
    url.pathname = `${routeGroup}${pathname}`

    const response = NextResponse.rewrite(url)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-subdomain", subdomain)
    response.headers.set("x-route-group", routeGroup)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)

    logger.info(
      {
        requestId,
        subdomain,
        systemRole,
        pathname,
        rewrittenPath: url.pathname,
      },
      "Request rewritten to route group"
    )

    return response
  }

  // Add subdomain to headers for route group selection
  const response = NextResponse.next()
  response.headers.set("x-request-id", requestId)
  response.headers.set("x-subdomain", subdomain)
  response.headers.set("x-route-group", routeGroup)
  response.headers.set("x-response-time", `${Date.now() - startTime}ms`)

  logger.info(
    {
      requestId,
      subdomain,
      systemRole,
      pathname,
    },
    "Request allowed"
  )

  return response
}

export const config = {
  matcher: [
    // Skip static files and internal Next.js routes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
