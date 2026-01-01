import { describe, it, expect } from "vitest"
import { generateKeyPairSync } from "crypto"
import { signZki, verifyZkiSignature, Certificate } from "../ZkiSigner"
import { Money } from "@/domain/shared"

describe("ZkiSigner", () => {
  const testCertificate: Certificate = (() => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    })
    return {
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
      publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
    }
  })()

  const testInput = {
    oib: "12345678901",
    invoiceNumber: "1-1-1",
    totalAmount: Money.fromCents(12500),
    issueDateTime: new Date("2024-01-15T10:30:45"),
  }

  it("generates ZKI (MD5 of RSA-SHA256 signature)", () => {
    const zki = signZki(testInput, testCertificate)
    expect(zki).toMatch(/^[A-F0-9]{32}$/) // MD5 is 32 hex chars
  })

  it("generates deterministic ZKI for same input", () => {
    const zki1 = signZki(testInput, testCertificate)
    const zki2 = signZki(testInput, testCertificate)
    expect(zki1).toBe(zki2)
  })

  it("generates different ZKI for different inputs", () => {
    const zki1 = signZki(testInput, testCertificate)
    const zki2 = signZki({ ...testInput, totalAmount: Money.fromCents(12600) }, testCertificate)
    expect(zki1).not.toBe(zki2)
  })

  it("verifyZkiSignature returns true for valid signature", () => {
    const zki = signZki(testInput, testCertificate)
    expect(verifyZkiSignature(testInput, zki, testCertificate)).toBe(true)
  })

  it("verifyZkiSignature returns false for tampered ZKI", () => {
    expect(verifyZkiSignature(testInput, "ABCD1234ABCD1234ABCD1234ABCD1234", testCertificate)).toBe(
      false
    )
  })
})
