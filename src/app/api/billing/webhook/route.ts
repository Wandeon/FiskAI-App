// src/app/api/billing/webhook/route.ts
// Stripe webhook handler for subscription events

import { NextRequest, NextResponse } from "next/server"
import { handleStripeWebhook } from "@/lib/billing/stripe"
import { logger } from "@/lib/logger"
import { isValidationError, formatValidationError } from "@/lib/api/validation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      logger.warn("Stripe webhook received without signature")
      return NextResponse.json({ error: "Missing signature" }, { status: 400 })
    }

    await handleStripeWebhook(body, signature)

    return NextResponse.json({ received: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    logger.error({ error }, "Stripe webhook processing failed")
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
