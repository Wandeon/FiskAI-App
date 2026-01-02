// src/app/api/webhooks/resend/route.ts
// Resend webhook handler for email delivery tracking

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { createHmac, timingSafeEqual } from "crypto"
import { z } from "zod"
import { ValidationError, formatValidationError } from "@/lib/api/validation"

// Resend webhook secret for signature verification
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET

// Zod schema for Resend webhook payload validation
const resendEventTypeSchema = z.enum([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.complained",
  "email.bounced",
  "email.opened",
  "email.clicked",
])

const resendWebhookSchema = z.object({
  type: resendEventTypeSchema,
  created_at: z.string(),
  data: z.object({
    created_at: z.string(),
    email_id: z.string().min(1, "email_id is required"),
    from: z.string().email("from must be a valid email"),
    to: z
      .array(z.string().email("to must contain valid emails"))
      .min(1, "to must have at least one recipient"),
    subject: z.string(),
    click: z
      .object({
        link: z.string().url("click.link must be a valid URL"),
        timestamp: z.string(),
      })
      .optional(),
    bounce: z
      .object({
        message: z.string(),
      })
      .optional(),
  }),
})

type ResendWebhookPayload = z.infer<typeof resendWebhookSchema>

/**
 * Verify Resend webhook signature using Svix format
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    // Svix signature format: v1,<base64_signature>
    const signatures = signature.split(" ")
    const signedContent = `${timestamp}.${payload}`

    // Extract the actual secret from the whsec_ prefix
    const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64")

    const expectedSignature = createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64")

    // Check if any of the signatures match
    for (const sig of signatures) {
      const [version, sigValue] = sig.split(",")
      if (version === "v1" && sigValue) {
        const sigBuffer = Buffer.from(sigValue, "base64")
        const expectedBuffer = Buffer.from(expectedSignature, "base64")
        if (
          sigBuffer.length === expectedBuffer.length &&
          timingSafeEqual(sigBuffer, expectedBuffer)
        ) {
          return true
        }
      }
    }
    return false
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()

    // Verify webhook signature if secret is configured
    if (RESEND_WEBHOOK_SECRET) {
      const svixId = request.headers.get("svix-id")
      const svixTimestamp = request.headers.get("svix-timestamp")
      const svixSignature = request.headers.get("svix-signature")

      if (!svixId || !svixTimestamp || !svixSignature) {
        logger.warn("Missing Svix headers in Resend webhook")
        return NextResponse.json({ error: "Missing headers" }, { status: 400 })
      }

      // Check timestamp to prevent replay attacks (5 minute tolerance)
      const webhookTimestamp = parseInt(svixTimestamp, 10)
      const now = Math.floor(Date.now() / 1000)
      if (Math.abs(now - webhookTimestamp) > 300) {
        logger.warn({ webhookTimestamp, now }, "Resend webhook timestamp too old")
        return NextResponse.json({ error: "Timestamp expired" }, { status: 401 })
      }

      if (!verifyWebhookSignature(body, svixSignature, svixTimestamp, RESEND_WEBHOOK_SECRET)) {
        logger.error("Resend webhook signature verification failed")
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
      }
    }

    // Parse and validate the webhook payload
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(body)
    } catch {
      logger.warn("Resend webhook received invalid JSON")
      return NextResponse.json(
        {
          error: "Validation failed",
          details: { formErrors: ["Invalid JSON in request body"], fieldErrors: {} },
        },
        { status: 400 }
      )
    }

    const validationResult = resendWebhookSchema.safeParse(parsedBody)
    if (!validationResult.success) {
      const validationError = new ValidationError(validationResult.error.flatten())
      logger.warn({ errors: validationError.errors }, "Resend webhook payload validation failed")
      return NextResponse.json(formatValidationError(validationError), { status: 400 })
    }

    const payload: ResendWebhookPayload = validationResult.data
    const { type, data } = payload
    const emailId = data.email_id

    logger.info({ type, emailId }, "Resend webhook received")

    // Find the invoice by email message ID
    const invoice = await db.eInvoice.findFirst({
      where: { emailMessageId: emailId },
    })

    if (!invoice) {
      // Email might not be invoice-related, log and acknowledge
      logger.debug({ emailId }, "No invoice found for email ID")
      return NextResponse.json({ received: true })
    }

    // Update invoice based on event type
    const now = new Date()
    const updateData: Record<string, unknown> = {}

    switch (type) {
      case "email.delivered":
        updateData.emailDeliveredAt = now
        logger.info({ invoiceId: invoice.id, emailId }, "Invoice email delivered")
        break

      case "email.opened":
        // Only record first open
        if (!invoice.emailOpenedAt) {
          updateData.emailOpenedAt = now
          logger.info({ invoiceId: invoice.id, emailId }, "Invoice email opened")
        }
        break

      case "email.clicked":
        // Only record first click
        if (!invoice.emailClickedAt) {
          updateData.emailClickedAt = now
          logger.info(
            { invoiceId: invoice.id, emailId, link: data.click?.link },
            "Invoice email link clicked"
          )
        }
        break

      case "email.bounced":
        updateData.emailBouncedAt = now
        updateData.emailBounceReason = data.bounce?.message || "Unknown bounce reason"

        // Add to global suppression list
        await db.emailSuppression.upsert({
          where: { email: data.to[0] },
          create: {
            email: data.to[0],
            reason: "bounce",
            details: data.bounce?.message || "Unknown bounce reason",
          },
          update: {
            reason: "bounce",
            details: data.bounce?.message || "Unknown bounce reason",
            suppressedAt: now,
          },
        })

        logger.warn(
          { invoiceId: invoice.id, emailId, reason: data.bounce?.message, email: data.to[0] },
          "Invoice email bounced - added to suppression list"
        )
        break
        break

      case "email.complained":
        // Treat spam complaints as bounces
        updateData.emailBouncedAt = now
        updateData.emailBounceReason = "Spam complaint"

        // Add to global suppression list
        await db.emailSuppression.upsert({
          where: { email: data.to[0] },
          create: {
            email: data.to[0],
            reason: "complaint",
            details: "Spam complaint",
          },
          update: {
            reason: "complaint",
            details: "Spam complaint",
            suppressedAt: now,
          },
        })

        logger.warn(
          { invoiceId: invoice.id, emailId, email: data.to[0] },
          "Invoice email marked as spam - added to suppression list"
        )
        break
        break

      case "email.delivery_delayed":
        logger.warn({ invoiceId: invoice.id, emailId }, "Invoice email delivery delayed")
        break

      default:
        logger.debug({ type, emailId }, "Unhandled Resend event type")
    }

    // Update invoice if we have changes
    if (Object.keys(updateData).length > 0) {
      await db.eInvoice.update({
        where: { id: invoice.id },
        data: updateData,
      })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ error }, "Resend webhook processing failed")
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
