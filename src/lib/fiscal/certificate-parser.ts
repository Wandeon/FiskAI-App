// src/lib/fiscal/certificate-parser.ts
import * as forge from "node-forge"
import * as crypto from "crypto"

export interface ParsedCertificate {
  subject: string
  oib: string
  serial: string
  notBefore: Date
  notAfter: Date
  issuer: string
  sha256: string
  privateKey: forge.pki.PrivateKey
  certificate: forge.pki.Certificate
}

export async function parseP12Certificate(
  p12Buffer: Buffer,
  password: string
): Promise<ParsedCertificate> {
  // Parse P12/PFX
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"))
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password)

  // Extract certificate and private key
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })

  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

  if (!certBag?.cert || !keyBag?.key) {
    throw new Error("Certificate or private key not found in P12")
  }

  const cert = certBag.cert
  const privateKey = keyBag.key

  // Extract OIB from subject
  const oib = extractOIB(cert)
  if (!oib) {
    throw new Error("OIB not found in certificate")
  }

  // Calculate SHA256 fingerprint
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const sha256 = crypto.createHash("sha256").update(certDer, "binary").digest("hex")

  return {
    subject: cert.subject.getField("CN")?.value || formatSubject(cert.subject),
    oib,
    serial: cert.serialNumber,
    notBefore: cert.validity.notBefore,
    notAfter: cert.validity.notAfter,
    issuer: cert.issuer.getField("CN")?.value || formatSubject(cert.issuer),
    sha256,
    privateKey,
    certificate: cert,
  }
}

function extractOIB(cert: forge.pki.Certificate): string | null {
  // Try serialNumber field (OID 2.5.4.5) - common in Croatian certs
  const serialNumber = cert.subject.getField({ type: "2.5.4.5" })
  if (serialNumber?.value) {
    const match = serialNumber.value.match(/\d{11}/)
    if (match) return match[0]
  }

  // Try CN field
  const cn = cert.subject.getField("CN")?.value
  if (cn) {
    const match = cn.match(/\d{11}/)
    if (match) return match[0]
  }

  // Try OU field
  const ou = cert.subject.getField("OU")?.value
  if (ou) {
    const match = ou.match(/\d{11}/)
    if (match) return match[0]
  }

  return null
}

export function validateCertificate(
  cert: ParsedCertificate,
  environment: "TEST" | "PROD"
): { valid: true } | { valid: false; error: string } {
  const now = new Date()

  if (cert.notAfter < now) {
    return { valid: false, error: "Certificate has expired" }
  }

  if (cert.notBefore > now) {
    return { valid: false, error: "Certificate is not yet valid" }
  }

  if (!isValidOIB(cert.oib)) {
    return { valid: false, error: "Invalid OIB in certificate" }
  }

  return { valid: true }
}

export function isValidOIB(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false

  let a = 10
  for (let i = 0; i < 10; i++) {
    a = (a + parseInt(oib[i], 10)) % 10
    if (a === 0) a = 10
    a = (a * 2) % 11
  }
  const control = (11 - a) % 10
  return control === parseInt(oib[10], 10)
}

function formatSubject(subject: { getField(sn: string): { value?: string } | null }): string {
  const parts: string[] = []
  const cn = subject.getField("CN")
  const o = subject.getField("O")
  if (cn?.value) parts.push(cn.value)
  if (o?.value) parts.push(o.value)
  return parts.join(", ") || "Unknown"
}

export function forgeToPem(
  privateKey: forge.pki.PrivateKey,
  certificate: forge.pki.Certificate
): { privateKeyPem: string; certificatePem: string } {
  return {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    certificatePem: forge.pki.certificateToPem(certificate),
  }
}
