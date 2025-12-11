import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { logger } from "./lib/logger"

export async function middleware(request: NextRequest) {
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID()

    // Create a response object
    const response = NextResponse.next()

    // Set the request ID header
    response.headers.set("x-request-id", requestId)

    // Log the request
    // Note: We cannot use the shared AsyncLocalStorage context here directly 
    // because Middleware runs in a separate runtime/scope.
    // We log explicitly with the values available.
    logger.info({
        requestId,
        method: request.method,
        url: request.url,
        userAgent: request.headers.get("user-agent"),
        msg: "Incoming Request"
    })

    return response
}

export const config = {
    matcher: [
        // Skip all internal paths
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
}
