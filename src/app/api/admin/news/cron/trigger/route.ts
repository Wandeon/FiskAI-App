import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const ADMIN_COOKIE = "fiskai_admin_auth"

async function isAdminAuthenticated() {
  // TODO: Replace with proper auth when available
  const cookieStore = await cookies()
  return cookieStore.get(ADMIN_COOKIE)?.value === "authenticated"
}

const CRON_ENDPOINTS = {
  "fetch-classify": "/api/cron/news/fetch-classify",
  review: "/api/cron/news/review",
  publish: "/api/cron/news/publish",
}

export async function POST(request: NextRequest) {
  // Check admin auth
  const isAuth = await isAdminAuthenticated()
  if (!isAuth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { job } = body

    if (!job || !(job in CRON_ENDPOINTS)) {
      return NextResponse.json(
        {
          error: `Invalid job. Must be one of: ${Object.keys(CRON_ENDPOINTS).join(", ")}`,
        },
        { status: 400 }
      )
    }

    const endpoint = CRON_ENDPOINTS[job as keyof typeof CRON_ENDPOINTS]

    // Get the base URL
    const protocol = request.headers.get("x-forwarded-proto") || "http"
    const host = request.headers.get("host") || "localhost:3000"
    const baseUrl = `${protocol}://${host}`

    // Call the cron endpoint with CRON_SECRET
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 })
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })

    const result = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Cron job failed: ${result.error || "Unknown error"}`,
          details: result,
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      job,
      result,
    })
  } catch (error) {
    console.error("Error triggering cron job:", error)
    return NextResponse.json(
      {
        error: `Failed to trigger cron job: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 }
    )
  }
}
