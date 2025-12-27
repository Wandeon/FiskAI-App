import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"

const CRON_ENDPOINTS = {
  "fetch-classify": "/api/cron/news/fetch-classify",
  review: "/api/cron/news/review",
  publish: "/api/cron/news/publish",
}

export async function POST(request: NextRequest) {
  // Check admin auth
  const user = await getCurrentUser()
  if (!user || user.systemRole !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const contentType = request.headers.get("content-type") || ""
    let job: string | null = null

    if (contentType.includes("application/json")) {
      const body = await request.json()
      job = typeof body?.job === "string" ? body.job : null
    } else {
      const form = await request.formData()
      const value = form.get("job")
      job = typeof value === "string" ? value : null
    }

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
