import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16
const KEY_LENGTH = 32

function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]*$/.test(str)
}

export class VaultError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message)
    this.name = "VaultError"
  }
}

function getMasterKey(): Buffer {
  const keyHex = process.env.INTEGRATION_VAULT_KEY

  if (!keyHex) {
    throw new VaultError("INTEGRATION_VAULT_KEY environment variable not set", "VAULT_KEY_MISSING")
  }

  if (keyHex.length !== KEY_LENGTH * 2) {
    throw new VaultError(
      `INTEGRATION_VAULT_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`,
      "VAULT_KEY_INVALID_LENGTH"
    )
  }

  return Buffer.from(keyHex, "hex")
}

export interface EncryptedEnvelope {
  envelope: string
  keyVersion: number
}

/**
 * Encrypts a secrets object using AES-256-GCM.
 * Format: iv:ciphertext:authTag (all hex-encoded)
 */
export function encryptSecretEnvelope<T extends Record<string, unknown>>(
  secrets: T
): EncryptedEnvelope {
  const masterKey = getMasterKey()
  const iv = randomBytes(IV_LENGTH)
  const plaintext = JSON.stringify(secrets)

  const cipher = createCipheriv(ALGORITHM, masterKey, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  const envelope = [iv.toString("hex"), encrypted.toString("hex"), authTag.toString("hex")].join(
    ":"
  )

  return {
    envelope,
    keyVersion: 1, // Future: support key rotation
  }
}

/**
 * Decrypts a secrets envelope.
 * @throws VaultError on decryption failure
 */
export function decryptSecretEnvelope<T = Record<string, unknown>>(
  envelope: string,
  keyVersion: number
): T {
  // Future: support multiple key versions for rotation
  if (keyVersion !== 1) {
    throw new VaultError(`Unsupported key version: ${keyVersion}`, "VAULT_UNSUPPORTED_KEY_VERSION")
  }

  const masterKey = getMasterKey()
  const parts = envelope.split(":")

  if (parts.length !== 3) {
    throw new VaultError(
      "Invalid envelope format: expected iv:ciphertext:authTag",
      "VAULT_INVALID_FORMAT"
    )
  }

  const [ivHex, encryptedHex, authTagHex] = parts

  // Validate hex format before parsing
  if (!isValidHex(ivHex) || !isValidHex(encryptedHex) || !isValidHex(authTagHex)) {
    throw new VaultError("Invalid envelope: contains non-hex characters", "VAULT_INVALID_HEX")
  }

  try {
    const iv = Buffer.from(ivHex, "hex")
    const encrypted = Buffer.from(encryptedHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")

    if (iv.length !== IV_LENGTH) {
      throw new VaultError("Invalid IV length", "VAULT_INVALID_IV")
    }

    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new VaultError("Invalid auth tag length", "VAULT_INVALID_AUTH_TAG")
    }

    const decipher = createDecipheriv(ALGORITHM, masterKey, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

    return JSON.parse(decrypted.toString("utf8")) as T
  } catch (error) {
    if (error instanceof VaultError) {
      throw error
    }
    if (error instanceof SyntaxError) {
      throw new VaultError(
        "Decryption succeeded but payload is not valid JSON",
        "VAULT_INVALID_PLAINTEXT"
      )
    }
    throw new VaultError("Decryption failed: invalid ciphertext or key", "VAULT_DECRYPTION_FAILED")
  }
}

/**
 * Type guard to check if envelope is present
 */
export function hasSecretEnvelope(account: {
  secretEnvelope: string | null
  secretKeyVersion: number
}): account is { secretEnvelope: string; secretKeyVersion: number } {
  return account.secretEnvelope !== null
}
