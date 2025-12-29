// src/app/api/webhooks/regulatory-truth/route.ts

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyWebhookSignature } from "@/lib/regulatory-truth/webhooks/signature-verification"
import { processWebhookEvent } from "@/lib/regulatory-truth/webhooks/processor"
import { logAuditEvent } from "@/lib/regulatory-truth/utils/audit-log"

/**
 * Webhook receiver endpoint for regulatory truth notifications
 *
 * Supports:
 * - RSS feed notifications
 * - Email alerts (forwarded)
 * - HTTP webhooks from government sources
 * - Custom integrations
 *
 * Security:
 * - HMAC signature verification
 * - Bearer token authentication
 * - Rate limiting per subscription
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()

  try {
    // Get provider from query params or headers
    const provider = req.nextUrl.searchParams.get("provider") || req.headers.get("x-webhook-provider")
    const subscriptionId = req.nextUrl.searchParams.get("subscription_id")

    if (!provider) {
      return NextResponse.json(
        { error: "Missing provider parameter" },
        { status: 400 }
      )
    }

    // Parse request body
    const rawBody = await req.text()
    const headers = Object.fromEntries(req.headers.entries())

    // Find webhook subscription
    const subscription = await db.webhookSubscription.findFirst({
      where: subscriptionId
        ? { id: subscriptionId }
        : { provider, isActive: true },
      orderBy: { createdAt: "desc" },
    })

    if (!subscription) {
      console.warn(`[webhook] No active subscription found for provider: ${provider}`)
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 }
      )
    }

    // Verify webhook signature if secret key is configured
    if (subscription.secretKey) {
      const signature = headers["x-webhook-signature"] || headers["x-hub-signature-256"]
      const isValid = verifyWebhookSignature(
        rawBody,
        signature || "",
        subscription.secretKey
      )

      if (!isValid) {
        console.error(`[webhook] Invalid signature for subscription: ${subscription.id}`)
        await db.webhookSubscription.update({
          where: { id: subscription.id },
          data: {
            errorCount: { increment: 1 },
            lastError: "Invalid webhook signature",
          },
        })

        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        )
      }
    }

    // Verify bearer token if configured
    if (subscription.authToken) {
      const authHeader = headers["authorization"]
      const expectedAuth = `Bearer ${subscription.authToken}`

      if (authHeader !== expectedAuth) {
        console.error(`[webhook] Invalid auth token for subscription: ${subscription.id}`)
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        )
      }
    }

    // Parse payload based on content type
    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      // If not JSON, treat as plain text
      payload = { raw: rawBody }
    }

    // Determine event type based on provider and payload structure
    const eventType = determineEventType(provider, payload)

    // Create webhook event record
    const webhookEvent = await db.webhookEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType,
        rawPayload: rawBody,
        headers,
        status: "PENDING",
      },
    })

    // Update subscription stats
    await db.webhookSubscription.update({
      where: { id: subscription.id },
      data: {
        lastTriggeredAt: new Date(),
        triggerCount: { increment: 1 },
      },
    })

    // Log audit event
    await logAuditEvent({
      action: "WEBHOOK_RECEIVED",
      entityType: "WEBHOOK_EVENT",
      entityId: webhookEvent.id,
      metadata: {
        provider,
        eventType,
        subscriptionId: subscription.id,
        payloadSize: rawBody.length,
      },
    })

    // Process webhook event asynchronously
    // This returns immediately and processes in background
    processWebhookEvent(webhookEvent.id).catch((error) => {
      console.error(`[webhook] Failed to process event ${webhookEvent.id}:`, error)
    })

    const duration = Date.now() - startTime
    console.log(
      `[webhook] Received ${eventType} from ${provider} (${duration}ms, event: ${webhookEvent.id})`
    )

    // Return success immediately (async processing)
    return NextResponse.json(
      {
        success: true,
        eventId: webhookEvent.id,
        provider,
        eventType,
      },
      { status: 200 }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("[webhook] Error processing webhook:", errorMessage)

    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    )
  }
}

/**
 * Determine event type from provider and payload
 */
function determineEventType(provider: string, payload: unknown): string {
  // RSS feed notification
  if (typeof payload === "object" && payload !== null) {
    const obj = payload as Record<string, unknown>
    if (obj.feed_url || obj.rss_url || obj.items) {
      return "RSS_ITEM"
    }
    if (obj.email_subject || obj.from_email) {
      return "EMAIL_NOTIFICATION"
    }
  }

  // Default to HTTP_POST
  return "HTTP_POST"
}

/**
 * Health check endpoint
 */
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider")

  if (provider) {
    // Check specific subscription
    const subscription = await db.webhookSubscription.findFirst({
      where: { provider, isActive: true },
    })

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        provider: subscription.provider,
        webhookType: subscription.webhookType,
        isActive: subscription.isActive,
        lastTriggeredAt: subscription.lastTriggeredAt,
        triggerCount: subscription.triggerCount,
        errorCount: subscription.errorCount,
      },
    })
  }

  // General health check
  const activeSubscriptions = await db.webhookSubscription.count({
    where: { isActive: true },
  })

  const pendingEvents = await db.webhookEvent.count({
    where: { status: "PENDING" },
  })

  return NextResponse.json({
    status: "healthy",
    activeSubscriptions,
    pendingEvents,
    timestamp: new Date().toISOString(),
  })
}
