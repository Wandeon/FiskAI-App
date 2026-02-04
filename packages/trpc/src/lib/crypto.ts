import crypto from "crypto"

const ALGORITHM = "aes-256-gcm"

function getKey(secret?: string): Buffer {
  const secretKey = secret || process.env.EINVOICE_KEY_SECRET
  if (!secretKey) {
    throw new Error("EINVOICE_KEY_SECRET not configured")
  }
  return crypto.createHash("sha256").update(secretKey).digest()
}

export function decryptSecret(encrypted: string, key?: string): string {
  const secretKey = getKey(key)
  const [ivHex, encryptedHex, authTagHex] = encrypted.split(":")

  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error("Invalid encrypted secret format")
  }

  const iv = Buffer.from(ivHex, "hex")
  const encryptedData = Buffer.from(encryptedHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = crypto.createDecipheriv(ALGORITHM, secretKey, iv)
  decipher.setAuthTag(authTag)

  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]).toString("utf8")
}

export function encryptSecret(plaintext: string, key?: string): string {
  const secretKey = getKey(key)
  const iv = crypto.randomBytes(12)

  const cipher = crypto.createCipheriv(ALGORITHM, secretKey, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`
}

export function decryptOptionalSecret(
  encrypted: string | null | undefined,
  key?: string
): string | null {
  if (!encrypted) {
    return null
  }
  return decryptSecret(encrypted, key)
}
