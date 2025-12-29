// src/lib/regulatory-truth/webhooks/signature-verification.ts

import crypto from "crypto"

/**
 * Verify HMAC signature for webhook payloads
 *
 * Supports multiple signature formats:
 * - GitHub style: sha256=<hex>
 * - Standard HMAC: <hex>
 * - Base64: <base64>
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256"
): boolean {
  if (!signature || !secret) {
    return false
  }

  try {
    // Compute expected signature
    const hmac = crypto.createHmac(algorithm, secret)
    hmac.update(payload)
    const expectedHex = hmac.digest("hex")
    const expectedBase64 = hmac.digest("base64")

    // Extract signature value (remove algorithm prefix if present)
    const signatureValue = signature.includes("=")
      ? signature.split("=")[1]
      : signature

    // Compare using timing-safe comparison
    const isValidHex = crypto.timingSafeEqual(
      Buffer.from(expectedHex),
      Buffer.from(signatureValue.toLowerCase())
    )

    // Also try base64 comparison
    let isValidBase64 = false
    try {
      isValidBase64 = crypto.timingSafeEqual(
        Buffer.from(expectedBase64),
        Buffer.from(signatureValue)
      )
    } catch {
      // Base64 comparison failed, ignore
    }

    return isValidHex || isValidBase64
  } catch (error) {
    console.error("[signature-verification] Error verifying signature:", error)
    return false
  }
}

/**
 * Generate HMAC signature for outgoing webhook requests
 */
export function generateWebhookSignature(
  payload: string,
  secret: string,
  algorithm: "sha256" | "sha1" = "sha256",
  format: "hex" | "base64" = "hex"
): string {
  const hmac = crypto.createHmac(algorithm, secret)
  hmac.update(payload)
  return `${algorithm}=${hmac.digest(format)}`
}

/**
 * Verify timestamp to prevent replay attacks
 * Rejects requests older than maxAgeSeconds (default: 5 minutes)
 */
export function verifyWebhookTimestamp(
  timestamp: string | number,
  maxAgeSeconds: number = 300
): boolean {
  try {
    const requestTime = typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp
    const currentTime = Math.floor(Date.now() / 1000)
    const age = currentTime - requestTime

    return age >= 0 && age <= maxAgeSeconds
  } catch {
    return false
  }
}

/**
 * Verify Stripe-style webhook signature (with timestamp)
 */
export function verifyStripeStyleSignature(
  payload: string,
  signature: string,
  secret: string,
  timestamp: string | number
): boolean {
  // Verify timestamp first (prevent replay)
  if (!verifyWebhookTimestamp(timestamp)) {
    console.warn("[signature-verification] Webhook timestamp too old or invalid")
    return false
  }

  // Construct signed payload
  const signedPayload = `${timestamp}.${payload}`

  // Verify signature
  return verifyWebhookSignature(signedPayload, signature, secret)
}
