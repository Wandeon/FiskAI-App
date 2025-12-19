import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import { logger } from "./lib/logger"
import {
  getSubdomainFromRequest,
  getRedirectUrlForSystemRole,
  canAccessSubdomain,
} from "@/lib/middleware/subdomain"

// Routes to skip (API, static assets, etc.)
function shouldSkipRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  )
}

export async function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
  const startTime = Date.now()
  const pathname = request.nextUrl.pathname

  // Log incoming request
  logger.info(
    {
      requestId,
      method: request.method,
      path: pathname,
      userAgent: request.headers.get("user-agent")?.slice(0, 100),
    },
    "Incoming request"
  )

  // Skip static files and API routes
  if (shouldSkipRoute(pathname)) {
    const response = NextResponse.next()
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Detect subdomain
  const subdomain = getSubdomainFromRequest(request)

  // Marketing subdomain - allow all traffic
  if (subdomain === "marketing") {
    const response = NextResponse.next()
    response.headers.set("x-request-id", requestId)
    response.headers.set("x-subdomain", subdomain)
    response.headers.set("x-response-time", `${Date.now() - startTime}ms`)
    return response
  }

  // Protected subdomains require authentication
  const token = await getToken({ req: request })

  if (!token) {
    // Redirect to login on marketing subdomain
    const loginUrl = new URL("/login", request.url)
    loginUrl.hostname = request.nextUrl.hostname.replace(/^(app|staff|admin)\./, "")
    loginUrl.searchParams.set("callbackUrl", request.url)

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
    return response
  }

  // Check subdomain access based on user's system role
  const systemRole = (token.systemRole as string) || "USER"

  if (!canAccessSubdomain(systemRole, subdomain)) {
    // Redirect to correct subdomain for user's role
    const redirectUrl = getRedirectUrlForSystemRole(
      systemRole as "USER" | "STAFF" | "ADMIN",
      request.url
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
    return response
  }

  // Add subdomain to headers for route group selection
  const response = NextResponse.next()
  response.headers.set("x-request-id", requestId)
  response.headers.set("x-subdomain", subdomain)
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
