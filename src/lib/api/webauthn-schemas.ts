/**
 * WebAuthn Zod Validation Schemas
 *
 * Provides comprehensive Zod schemas for validating WebAuthn authentication payloads.
 * These schemas validate the structure of WebAuthn API responses from the browser.
 *
 * Security Note: WebAuthn routes handle external authentication input and are security-critical.
 * All incoming payloads must be validated before processing.
 */

import { z } from "zod"

/**
 * Base64URL string validation
 * WebAuthn uses Base64URL encoding for binary data
 */
const base64UrlStringSchema = z.string().min(1, "Base64URL string is required")

/**
 * Authenticator transport types as defined in WebAuthn spec
 * https://w3c.github.io/webauthn/#enumdef-authenticatortransport
 */
const authenticatorTransportSchema = z.enum([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
])

/**
 * Public key credential type (always "public-key" in WebAuthn)
 */
const publicKeyCredentialTypeSchema = z.literal("public-key")

/**
 * Authenticator attachment type
 */
const authenticatorAttachmentSchema = z.enum(["cross-platform", "platform"])

/**
 * Client extension results (can contain various extension outputs)
 * We use passthrough to allow any extension outputs
 */
const clientExtensionResultsSchema = z.object({}).passthrough()

/**
 * AuthenticatorAttestationResponse schema
 * Used in registration responses
 */
const authenticatorAttestationResponseSchema = z.object({
  clientDataJSON: base64UrlStringSchema,
  attestationObject: base64UrlStringSchema,
  authenticatorData: base64UrlStringSchema.optional(),
  transports: z.array(authenticatorTransportSchema).optional(),
  publicKeyAlgorithm: z.number().optional(),
  publicKey: base64UrlStringSchema.optional(),
})

/**
 * AuthenticatorAssertionResponse schema
 * Used in authentication responses
 *
 * Note: userHandle can be null from the browser but the @simplewebauthn/types
 * expects undefined, so we transform null to undefined.
 */
const authenticatorAssertionResponseSchema = z.object({
  clientDataJSON: base64UrlStringSchema,
  authenticatorData: base64UrlStringSchema,
  signature: base64UrlStringSchema,
  userHandle: z
    .string()
    .nullish()
    .transform((val) => val ?? undefined),
})

/**
 * RegistrationResponseJSON schema
 * Validates the response from navigator.credentials.create()
 */
export const registrationResponseSchema = z.object({
  id: base64UrlStringSchema,
  rawId: base64UrlStringSchema,
  response: authenticatorAttestationResponseSchema,
  authenticatorAttachment: authenticatorAttachmentSchema.optional(),
  clientExtensionResults: clientExtensionResultsSchema,
  type: publicKeyCredentialTypeSchema,
})

/**
 * AuthenticationResponseJSON schema
 * Validates the response from navigator.credentials.get()
 */
export const authenticationResponseSchema = z.object({
  id: base64UrlStringSchema,
  rawId: base64UrlStringSchema,
  response: authenticatorAssertionResponseSchema,
  authenticatorAttachment: authenticatorAttachmentSchema.optional(),
  clientExtensionResults: clientExtensionResultsSchema,
  type: publicKeyCredentialTypeSchema,
})

// ============================================================================
// Route-specific schemas
// ============================================================================

/**
 * POST /api/webauthn/register/start
 * No body required - uses session user
 */
export const registerStartSchema = z.object({}).strict()

/**
 * POST /api/webauthn/register/finish
 * Requires the registration response and optional passkey name
 */
export const registerFinishSchema = z.object({
  response: registrationResponseSchema,
  name: z.string().max(100, "Passkey name must be 100 characters or less").optional(),
})

/**
 * POST /api/webauthn/login/start
 * Requires email to identify the user
 */
export const loginStartSchema = z.object({
  email: z.string().email("Valid email is required"),
})

/**
 * POST /api/webauthn/login/finish
 * Requires userId and authentication response
 */
export const loginFinishSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  response: authenticationResponseSchema,
})

/**
 * DELETE /api/webauthn/passkeys/[id]
 * Validates the passkey ID parameter
 */
export const passkeyIdParamsSchema = z.object({
  id: z.string().cuid("Invalid passkey ID format"),
})

// ============================================================================
// Type exports for use in route handlers
// ============================================================================

export type RegisterFinishInput = z.infer<typeof registerFinishSchema>
export type LoginStartInput = z.infer<typeof loginStartSchema>
export type LoginFinishInput = z.infer<typeof loginFinishSchema>
export type PasskeyIdParams = z.infer<typeof passkeyIdParamsSchema>
