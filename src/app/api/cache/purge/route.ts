// src/app/api/cache/purge/route.ts
import { NextRequest, NextResponse } from "next/server"

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID
const PURGE_SECRET = process.env.CACHE_PURGE_SECRET

/**
 * POST /api/cache/purge
 *
 * Purge Cloudflare cache by tag or URL list.
 *
 * SECURITY: Protected by Bearer token authentication using CACHE_PURGE_SECRET.
 *
 * Request body:
 *   - tags: string[] - Cache tags to purge (Cloudflare Enterprise feature)
 *   - urls: string[] - Specific URLs to purge from cache
 *
 * At least one of tags or urls must be provided.
 */
export async function POST(request: NextRequest) {
  // Validate authorization header
  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${PURGE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Parse request body
  let body: { tags?: string[]; urls?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { tags, urls } = body

  // Validate input - at least one of tags or urls must be provided
  if (!tags && !urls) {
    return NextResponse.json({ error: "Either tags or urls must be provided" }, { status: 400 })
  }

  // Validate arrays are non-empty if provided
  if (tags && (!Array.isArray(tags) || tags.length === 0)) {
    return NextResponse.json({ error: "tags must be a non-empty array" }, { status: 400 })
  }

  if (urls && (!Array.isArray(urls) || urls.length === 0)) {
    return NextResponse.json({ error: "urls must be a non-empty array" }, { status: 400 })
  }

  // Check Cloudflare configuration
  if (!CF_API_TOKEN || !CF_ZONE_ID) {
    console.error("[cache/purge] Cloudflare configuration missing")
    return NextResponse.json({ error: "Cloudflare configuration missing" }, { status: 500 })
  }

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(tags ? { tags } : { files: urls }),
      }
    )

    const result = await response.json()

    if (!response.ok) {
      console.error("[cache/purge] Cloudflare API error:", result)
    }

    return NextResponse.json(result, { status: response.ok ? 200 : 500 })
  } catch (error) {
    console.error("[cache/purge] Error calling Cloudflare API:", error)
    return NextResponse.json({ error: "Failed to purge cache" }, { status: 500 })
  }
}
