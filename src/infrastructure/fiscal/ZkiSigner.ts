import { createHash, createSign } from "crypto"
import { buildZkiString, ZkiInput } from "@/domain/fiscalization/ZkiCalculator"

export interface Certificate {
  privateKey: string
  publicKey: string
}

/**
 * Signs the ZKI string with the company's private key.
 * Returns the MD5 hash of the RSA-SHA256 signature (per Croatian fiscalization spec).
 */
export function signZki(input: ZkiInput, certificate: Certificate): string {
  const zkiString = buildZkiString(input)

  // Sign with SHA256 + RSA
  const sign = createSign("SHA256")
  sign.update(zkiString)
  const signature = sign.sign(certificate.privateKey)

  // Return MD5 of signature (Croatian fiscalization requirement)
  const md5 = createHash("md5").update(signature).digest("hex")

  return md5.toUpperCase()
}

/**
 * Verifies ZKI signature (for testing purposes)
 */
export function verifyZkiSignature(
  input: ZkiInput,
  zki: string,
  certificate: Certificate
): boolean {
  const computed = signZki(input, certificate)
  return computed === zki.toUpperCase()
}
