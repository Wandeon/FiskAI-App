import { z } from "zod"

// Re-export Prisma enums for convenience
export type { IntegrationKind, IntegrationEnv, IntegrationStatus } from "@prisma/client"

export class IntegrationSecretsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "IntegrationSecretsError"
  }
}

// E-Invoice secrets schema
const eInvoiceSecretsSchema = z.object({
  apiKey: z.string().min(1, "apiKey is required"),
})

export type EInvoiceSecrets = z.infer<typeof eInvoiceSecretsSchema>

export function parseEInvoiceSecrets(input: unknown): EInvoiceSecrets {
  const result = eInvoiceSecretsSchema.safeParse(input)
  if (!result.success) {
    throw new IntegrationSecretsError(`Invalid e-invoice secrets: ${result.error.message}`)
  }
  return result.data
}

// Fiscalization secrets schema
const fiscalizationSecretsSchema = z.object({
  p12Base64: z.string().min(1, "p12Base64 is required"),
  p12Password: z.string().min(1, "p12Password is required"),
})

export type FiscalizationSecrets = z.infer<typeof fiscalizationSecretsSchema>

export function parseFiscalizationSecrets(input: unknown): FiscalizationSecrets {
  const result = fiscalizationSecretsSchema.safeParse(input)
  if (!result.success) {
    throw new IntegrationSecretsError(`Invalid fiscalization secrets: ${result.error.message}`)
  }
  return result.data
}

/**
 * Extracts P12 certificate data from fiscalization secrets.
 * Returns Buffer and password ready for crypto operations.
 */
export function extractP12FromSecrets(secrets: FiscalizationSecrets): {
  p12Buffer: Buffer
  password: string
} {
  return {
    p12Buffer: Buffer.from(secrets.p12Base64, "base64"),
    password: secrets.p12Password,
  }
}

// Provider config schemas (non-sensitive)
export interface EInvoiceProviderConfig {
  baseUrl?: string
  timeout?: number
  softwareId?: string
}

export interface FiscalizationProviderConfig {
  endpoint?: string
  timeout?: number
}

// Valid integration kinds
const VALID_KINDS = [
  "EINVOICE_EPOSLOVANJE",
  "EINVOICE_FINA",
  "EINVOICE_IE_RACUNI",
  "FISCALIZATION_CIS",
] as const

export function validateIntegrationKind(kind: string): kind is (typeof VALID_KINDS)[number] {
  return VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])
}

export function isEInvoiceKind(kind: string): boolean {
  return kind.startsWith("EINVOICE_")
}

export function isFiscalizationKind(kind: string): boolean {
  return kind.startsWith("FISCALIZATION_")
}
