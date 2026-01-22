// src/lib/outbox/handlers/webhook-handler.ts
/**
 * Webhook Event Handler
 *
 * Handles incoming webhook events from external integrations.
 *
 * NOTE: Webhook processing is currently disabled pending integration
 * with the fiskai-intelligence service for regulatory event webhooks.
 */

import { z } from "zod"

// Payload schema for webhook events
const webhookReceivedSchema = z.object({
  webhookId: z.string().optional(),
  source: z.string().optional(),
  eventType: z.string().optional(),
  payload: z.unknown().optional(),
})

/**
 * Handle webhook.received event.
 *
 * Currently a stub - webhook processing will be implemented when
 * external integrations are configured.
 */
export async function handleWebhookReceived(payload: unknown): Promise<void> {
  const parsed = webhookReceivedSchema.safeParse(payload)

  if (!parsed.success) {
    console.warn("[outbox:webhook.received] Invalid payload, skipping:", parsed.error.message)
    return
  }

  const { webhookId, source, eventType } = parsed.data

  console.log(
    `[outbox:webhook.received] Webhook event received (stub handler)`,
    `webhookId=${webhookId ?? "unknown"}`,
    `source=${source ?? "unknown"}`,
    `eventType=${eventType ?? "unknown"}`
  )

  // TODO: Implement actual webhook processing when integrations are ready
  // This should dispatch to source-specific handlers based on the source field
}
