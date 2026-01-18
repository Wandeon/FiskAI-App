import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { logger } from "./lib/logger"
import { getSubdomain, getDashboardPathForRole, canAccessPath } from "@/lib/middleware/subdomain"
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

  // Public API routes bypass authentication (health checks, webhooks, etc.)
  // Must check BEFORE subdomain/auth routing to allow internal healthchecks from localhost
  if (pathname.startsWith("/api/") && isPublicApiRoute(pathname)) {
    const response = NextResponse.next()
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Detect subdomain using real host
  const realHost = getRealHost(request)
  const subdomain = getSubdomain(realHost)

  // Legacy subdomain redirects: admin.fiskai.hr → app.fiskai.hr/admin, staff.fiskai.hr → app.fiskai.hr/staff
  // These are 308 permanent redirects to preserve method (POST stays POST)
  const hostParts = realHost.split(":")[0].split(".")
  if (hostParts.length >= 3) {
    const possibleLegacySubdomain = hostParts[0]
    if (possibleLegacySubdomain === "admin" || possibleLegacySubdomain === "staff") {
      const externalUrl = getExternalUrl(request)
      const baseDomain = externalUrl.hostname.replace(/^(admin|staff)\./, "")
      const redirectUrl = new URL(externalUrl)
      redirectUrl.hostname = `app.${baseDomain}`
      // Prepend the subdomain as a path prefix
      redirectUrl.pathname = `/${possibleLegacySubdomain}${pathname === "/" ? "" : pathname}`

      logger.info(
        {
          requestId,
          subdomain: possibleLegacySubdomain,
          pathname,
          redirectUrl: redirectUrl.toString(),
        },
        "Legacy subdomain redirect to app subdomain with path prefix"
      )

      return new NextResponse(null, {
        status: 308,
        headers: {
          Location: redirectUrl.toString(),
          "x-request-id": requestId,
          "x-response-time": `${Date.now() - startTime}ms`,
        },
      })
    }
  }

  // Marketing subdomain - apply rate limiting for unauthenticated traffic
  // Note: Marketing is now served from separate static site, but we still handle
  // requests that reach the app server (e.g., during migration)
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

  // App subdomain - require authentication
  // But first, check if this is a public auth page that doesn't require authentication
  const PUBLIC_AUTH_PATHS = ["/auth", "/login", "/register", "/forgot-password", "/reset-password"]
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )

  // Allow public auth pages without authentication
  if (isPublicAuthPath) {
    const response = NextResponse.next()
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    response.headers.set("Content-Security-Policy", generateCSP(nonce))
    response.headers.set("x-nonce", nonce)
    return response
  }

  const isSecure =
    request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https"
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    secureCookie: isSecure,
    cookieName: isSecure ? "__Secure-authjs.session-token" : "authjs.session-token",
  })

  if (!token) {
    // Redirect to auth on app subdomain
    const externalUrl = getExternalUrl(request)
    const authUrl = new URL("/auth", externalUrl)
    authUrl.searchParams.set("callbackUrl", externalUrl.toString())

    logger.info(
      {
        requestId,
        subdomain,
        pathname,
      },
      "Redirecting unauthenticated user to auth"
    )

    const response = NextResponse.redirect(authUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    response.headers.set("Content-Security-Policy", generateCSP(nonce))
    return response
  }

  // User is authenticated - check path-based role access
  const systemRole = (token.systemRole as string) || "USER"

  // Enforce role-based path restrictions
  if (!canAccessPath(systemRole, pathname)) {
    // Redirect to appropriate dashboard for their role
    const dashboardPath = getDashboardPathForRole(systemRole as "USER" | "STAFF" | "ADMIN")
    const externalUrl = getExternalUrl(request)
    const redirectUrl = new URL(dashboardPath, externalUrl)

    logger.info(
      {
        requestId,
        systemRole,
        pathname,
        redirectUrl: redirectUrl.toString(),
      },
      "User lacks permission for path, redirecting to their dashboard"
    )

    const response = NextResponse.redirect(redirectUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Legacy path redirects - all old control center paths go to /cc
  if (
    pathname === "/dashboard" ||
    pathname === "/app-control-center" ||
    pathname === "/control-center"
  ) {
    const externalUrl = getExternalUrl(request)
    const redirectUrl = new URL("/cc", externalUrl)
    redirectUrl.search = request.nextUrl.search

    logger.info(
      {
        requestId,
        subdomain,
        systemRole,
        originalPath: pathname,
        redirectPath: "/cc",
      },
      "Redirecting legacy path to /cc"
    )

    const response = NextResponse.redirect(redirectUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Redirect root path to appropriate dashboard for user's role
  if (pathname === "/") {
    const dashboardPath = getDashboardPathForRole(systemRole as "USER" | "STAFF" | "ADMIN")
    // All roles go to their respective dashboard path
    const targetPath = dashboardPath
    const externalUrl = getExternalUrl(request)
    const controlCenterUrl = new URL(targetPath, externalUrl)

    logger.info(
      {
        requestId,
        subdomain,
        systemRole,
        targetPath,
      },
      "Redirecting authenticated user from root to dashboard"
    )

    const response = NextResponse.redirect(controlCenterUrl)
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Note: Route groups (like "(app)") are file system organization only.
  // They don't create URL segments. URLs like /cc automatically route to
  // src/app/(app)/cc/page.tsx without any rewriting needed.
  // The previous rewrite logic was INCORRECT and caused 404 errors.

  // Add subdomain and pathname to headers
  const response = NextResponse.next()
  response.headers.set("x-request-id", requestId)
  response.headers.set("x-subdomain", subdomain)
  response.headers.set("x-pathname", pathname)
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
