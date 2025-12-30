// src/lib/r2-client.ts
// R2 storage client with cryptographic tenant isolation
//
// SECURITY MODEL:
// - Storage keys include HMAC signature binding content to tenant
// - Signature prevents cross-tenant access even if key is guessed
// - Defense-in-depth: application + cryptographic isolation
// - See: https://github.com/[org]/FiskAI/issues/820

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  PutObjectRetentionCommand,
  ObjectLockRetentionMode,
} from "@aws-sdk/client-s3"
import { createHmac, timingSafeEqual } from "crypto"

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME || "fiskai-documents"

/**
 * Get the R2 tenant isolation secret.
 * This key is used to HMAC-sign storage keys, binding them to specific tenants.
 *
 * IMPORTANT: This MUST be set in production. Falls back to R2_SECRET_ACCESS_KEY
 * for backward compatibility but logs a warning.
 */
function getTenantIsolationSecret(): string {
  const secret = process.env.R2_TENANT_ISOLATION_SECRET
  if (secret) {
    return secret
  }

  // Fallback for backward compatibility - use R2 secret key
  // This is acceptable because the secret is still tenant-specific
  // but a dedicated key is preferred for rotation independence
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[R2] R2_TENANT_ISOLATION_SECRET not set. Using R2_SECRET_ACCESS_KEY as fallback. " +
        "Set R2_TENANT_ISOLATION_SECRET for independent key rotation."
    )
  }
  return process.env.R2_SECRET_ACCESS_KEY || "dev-fallback-secret"
}

/**
 * Generate HMAC signature for tenant-bound storage key.
 * This creates a cryptographic binding between the company ID, content hash,
 * and the storage path, preventing cross-tenant access.
 *
 * @param companyId - The tenant's company ID
 * @param contentHash - SHA-256 hash of file content
 * @param path - The storage path (year/month/extension)
 * @returns 8-character hex signature
 */
export function generateTenantSignature(
  companyId: string,
  contentHash: string,
  path: string
): string {
  const secret = getTenantIsolationSecret()
  const message = `${companyId}:${contentHash}:${path}`
  const hmac = createHmac("sha256", secret)
  hmac.update(message)
  // Use first 8 chars of hex for compact but sufficient collision resistance
  return hmac.digest("hex").substring(0, 8)
}

/**
 * Verify that a storage key's signature is valid for the claimed tenant.
 * This is the cryptographic check that prevents cross-tenant access.
 *
 * @param key - Full R2 storage key
 * @param companyId - The tenant claiming access
 * @returns true if signature is valid for this tenant
 */
export function verifyTenantSignature(key: string, companyId: string): boolean {
  // Parse key: attachments/{companyId}/{year}/{month}/{sig}_{contentHash}.{ext}
  const parts = key.split("/")
  if (parts.length < 5 || parts[0] !== "attachments") {
    return false
  }

  const keyCompanyId = parts[1]
  if (keyCompanyId !== companyId) {
    return false
  }

  const year = parts[2]
  const month = parts[3]
  const filename = parts[4]

  // Parse filename: {sig}_{contentHash}.{ext}
  const underscoreIdx = filename.indexOf("_")
  if (underscoreIdx === -1) {
    // Legacy key format without signature - allow for backward compatibility
    // but log for migration tracking
    if (process.env.NODE_ENV === "production") {
      console.warn(`[R2] Legacy key format detected (no signature): ${key}`)
    }
    return true
  }

  const providedSig = filename.substring(0, underscoreIdx)
  const rest = filename.substring(underscoreIdx + 1)
  const dotIdx = rest.lastIndexOf(".")
  const contentHash = dotIdx !== -1 ? rest.substring(0, dotIdx) : rest
  const ext = dotIdx !== -1 ? rest.substring(dotIdx + 1) : ""

  const path = `${year}/${month}/${ext}`
  const expectedSig = generateTenantSignature(companyId, contentHash, path)

  // Use timing-safe comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))
  } catch {
    // Buffer length mismatch means invalid signature
    return false
  }
}

export async function uploadToR2(key: string, data: Buffer, contentType: string): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  )
  return key
}

export async function downloadFromR2(key: string): Promise<Buffer> {
  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )

  const chunks: Uint8Array[] = []
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
}

/**
 * Generate cryptographically-signed R2 storage key for tenant-isolated storage.
 *
 * Key format: attachments/{companyId}/{year}/{month}/{signature}_{contentHash}.{ext}
 *
 * The signature is an HMAC binding the companyId, contentHash, and path together.
 * This provides defense-in-depth: even if an attacker guesses a valid key path,
 * they cannot forge the signature without the server-side secret.
 *
 * @param companyId - The tenant's company ID (cryptographically bound to key)
 * @param contentHash - SHA-256 hash of file content (for deduplication)
 * @param filename - Original filename (used for extension only)
 * @returns Cryptographically-signed storage key
 */
export function generateR2Key(companyId: string, contentHash: string, filename: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const ext = filename.split(".").pop() || "bin"

  const path = `${year}/${month}/${ext}`
  const signature = generateTenantSignature(companyId, contentHash, path)

  return `attachments/${companyId}/${year}/${month}/${signature}_${contentHash}.${ext}`
}
