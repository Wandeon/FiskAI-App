# Multi-Tenant Fiscalisation Certificates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multi-tenant Croatian fiscalisation (Fiskalizacija 1.0) where each client signs invoices with their own FINA certificate containing their OIB, for cash and B2C invoice flows.

**Architecture:** Secure P12 certificate storage with envelope encryption, Postgres-based job queue with row locking, XML building per Croatian spec, XMLDSIG signing, and submission to Porezna endpoints.

**Tech Stack:** Next.js API routes, Prisma ORM, node-forge (P12 parsing), xml-crypto (XMLDSIG), xml2js (response parsing), existing AES-256-GCM encryption pattern

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Fiscalisation Flow                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Invoice Finalized] ──▶ [Should Fiscalize?] ──▶ [Queue Request]   │
│                                │                                    │
│                                ▼                                    │
│                    ┌───────────────────────┐                       │
│                    │   FiscalRequest       │                       │
│                    │   status: QUEUED      │                       │
│                    └───────────┬───────────┘                       │
│                                │                                    │
│                    ┌───────────▼───────────┐                       │
│                    │   Cron Processor      │                       │
│                    │   FOR UPDATE SKIP     │                       │
│                    │   LOCKED              │                       │
│                    └───────────┬───────────┘                       │
│                                │                                    │
│         ┌──────────────────────┼──────────────────────┐            │
│         ▼                      ▼                      ▼            │
│   [Decrypt Cert]    [Build XML + Sign]    [Submit to Porezna]     │
│         │                      │                      │            │
│         └──────────────────────┼──────────────────────┘            │
│                                ▼                                    │
│                    ┌───────────────────────┐                       │
│                    │   Update Invoice      │                       │
│                    │   with JIR            │                       │
│                    └───────────────────────┘                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Postgres-based queue** (not Redis) - sufficient for expected scale, simpler ops
2. **Envelope encryption** - random data key per certificate, master key encrypts data keys
3. **Row locking with FOR UPDATE SKIP LOCKED** - prevents double-processing
4. **Idempotency via unique constraint** - (companyId, invoiceId, messageType)
5. **Smart retries** - network errors retry, validation errors go to DEAD immediately
6. **Cron endpoint** - Coolify/external cron triggers processing

---

## Task 1: Add Fiscal Enums to Schema

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add enums after existing enums section**

```prisma
enum FiscalEnv {
  TEST
  PROD
}

enum CertStatus {
  PENDING
  ACTIVE
  EXPIRED
  REVOKED
}

enum FiscalStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  DEAD
}

enum FiscalMessageType {
  RACUN
  STORNO
  PROVJERA
}
```

**Step 2: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`
Expected: "The schema is valid!"

---

## Task 2: Add FiscalCertificate Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add FiscalCertificate model**

```prisma
model FiscalCertificate {
  id               String      @id @default(cuid())
  companyId        String
  environment      FiscalEnv
  provider         String      @default("DIRECT")
  certSubject      String
  certSerial       String
  certNotBefore    DateTime
  certNotAfter     DateTime
  oibExtracted     String
  certSha256       String
  encryptedP12     String      @db.Text
  encryptedDataKey String
  status           CertStatus  @default(PENDING)
  lastUsedAt       DateTime?
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  company          Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fiscalRequests   FiscalRequest[]

  @@unique([companyId, environment])
  @@index([companyId])
  @@index([status])
}
```

**Step 2: Add relation to Company model**

Find the Company model and add:

```prisma
  fiscalCertificates FiscalCertificate[]
```

**Step 3: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`

---

## Task 3: Add FiscalRequest Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add FiscalRequest model**

```prisma
model FiscalRequest {
  id              String            @id @default(cuid())
  companyId       String
  certificateId   String
  invoiceId       String?
  messageType     FiscalMessageType
  status          FiscalStatus      @default(QUEUED)
  attemptCount    Int               @default(0)
  maxAttempts     Int               @default(5)
  nextRetryAt     DateTime          @default(now())
  lockedAt        DateTime?
  lockedBy        String?
  jir             String?
  zki             String?
  errorCode       String?
  errorMessage    String?
  lastHttpStatus  Int?
  requestXml      String?           @db.Text
  signedXml       String?           @db.Text
  responseXml     String?           @db.Text
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  company         Company           @relation(fields: [companyId], references: [id], onDelete: Cascade)
  certificate     FiscalCertificate @relation(fields: [certificateId], references: [id])
  invoice         Invoice?          @relation(fields: [invoiceId], references: [id])

  @@unique([companyId, invoiceId, messageType])
  @@index([status, nextRetryAt])
  @@index([companyId])
  @@index([invoiceId])
}
```

**Step 2: Add relations to Company and Invoice models**

Add to Company model:

```prisma
  fiscalRequests   FiscalRequest[]
```

Add to Invoice model:

```prisma
  fiscalRequests   FiscalRequest[]
```

**Step 3: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`

---

## Task 4: Add Fiscal Fields to Company Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add fiscal configuration fields to Company model**

Find the Company model and add these fields:

```prisma
  fiscalEnabled      Boolean     @default(false)
  fiscalEnvironment  FiscalEnv   @default(PROD)
  premisesCode       String      @default("1")
  deviceCode         String      @default("1")
```

**Step 2: Run schema validation**

Run: `cd /home/admin/FiskAI && npx prisma validate`

---

## Task 5: Add Fiscal Fields to Invoice Model

**Files:**

- Modify: `prisma/schema.prisma`

**Step 1: Add fiscal tracking fields to Invoice model**

Find the Invoice model and add these fields:

```prisma
  jir              String?
  zki              String?
  fiscalizedAt     DateTime?
  fiscalStatus     String?
  operatorOib      String?
```

**Step 2: Run schema validation and generate migration**

Run:

```bash
cd /home/admin/FiskAI && npx prisma validate
cd /home/admin/FiskAI && npx prisma migrate dev --name add_fiscal_certificates
```

---

## Task 6: Add FISCAL_CERT_KEY Environment Variable

**Files:**

- Modify: `.env.example`
- Modify: `docker-compose.prod.yml` (add placeholder comment)

**Step 1: Add to .env.example**

```bash
# Fiscalisation certificate encryption (32 bytes as 64 hex chars)
# Generate with: openssl rand -hex 32
FISCAL_CERT_KEY=
```

**Step 2: Add comment to docker-compose.prod.yml**

In the environment section of the app service, add:

```yaml
# FISCAL_CERT_KEY: Set in Coolify secrets
```

**Step 3: Generate a key for local development**

Run: `openssl rand -hex 32`

Add the generated key to your local `.env` file.

---

## Task 7: Create Envelope Encryption Module

**Files:**

- Create: `src/lib/fiscal/envelope-encryption.ts`

**Step 1: Create the envelope encryption module**

```typescript
// src/lib/fiscal/envelope-encryption.ts
import crypto from "crypto"

const MASTER_KEY_ENV = "FISCAL_CERT_KEY"
const ALGORITHM = "aes-256-gcm"

function getMasterKey(): Buffer {
  const keyHex = process.env[MASTER_KEY_ENV]
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(`${MASTER_KEY_ENV} must be 32 bytes (64 hex chars)`)
  }
  return Buffer.from(keyHex, "hex")
}

export function encryptWithEnvelope(plaintext: string): {
  encryptedData: string
  encryptedDataKey: string
} {
  const masterKey = getMasterKey()

  // Generate random data key for this certificate
  const dataKey = crypto.randomBytes(32)
  const dataIv = crypto.randomBytes(12)

  // Encrypt plaintext with data key
  const dataCipher = crypto.createCipheriv(ALGORITHM, dataKey, dataIv)
  const encryptedContent = Buffer.concat([dataCipher.update(plaintext, "utf8"), dataCipher.final()])
  const dataTag = dataCipher.getAuthTag()

  // Encrypt data key with master key
  const keyIv = crypto.randomBytes(12)
  const keyCipher = crypto.createCipheriv(ALGORITHM, masterKey, keyIv)
  const encryptedKey = Buffer.concat([keyCipher.update(dataKey), keyCipher.final()])
  const keyTag = keyCipher.getAuthTag()

  return {
    encryptedData: [
      dataIv.toString("hex"),
      encryptedContent.toString("hex"),
      dataTag.toString("hex"),
    ].join(":"),
    encryptedDataKey: [
      keyIv.toString("hex"),
      encryptedKey.toString("hex"),
      keyTag.toString("hex"),
    ].join(":"),
  }
}

export function decryptWithEnvelope(encryptedData: string, encryptedDataKey: string): string {
  const masterKey = getMasterKey()

  // Decrypt data key
  const [keyIvHex, encKeyHex, keyTagHex] = encryptedDataKey.split(":")
  const keyDecipher = crypto.createDecipheriv(ALGORITHM, masterKey, Buffer.from(keyIvHex, "hex"))
  keyDecipher.setAuthTag(Buffer.from(keyTagHex, "hex"))
  const dataKey = Buffer.concat([
    keyDecipher.update(Buffer.from(encKeyHex, "hex")),
    keyDecipher.final(),
  ])

  // Decrypt content
  const [dataIvHex, encContentHex, dataTagHex] = encryptedData.split(":")
  const dataDecipher = crypto.createDecipheriv(ALGORITHM, dataKey, Buffer.from(dataIvHex, "hex"))
  dataDecipher.setAuthTag(Buffer.from(dataTagHex, "hex"))
  return Buffer.concat([
    dataDecipher.update(Buffer.from(encContentHex, "hex")),
    dataDecipher.final(),
  ]).toString("utf8")
}
```

---

## Task 8: Create Certificate Parser Module

**Files:**

- Create: `src/lib/fiscal/certificate-parser.ts`

**Step 1: Install node-forge**

Run: `cd /home/admin/FiskAI && npm install node-forge && npm install -D @types/node-forge`

**Step 2: Create the certificate parser**

```typescript
// src/lib/fiscal/certificate-parser.ts
import forge from "node-forge"
import crypto from "crypto"

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

function formatSubject(subject: forge.pki.DistinguishedName): string {
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
```

---

## Task 9: Create XML Builder Module

**Files:**

- Create: `src/lib/fiscal/xml-builder.ts`
- Create: `src/lib/fiscal/utils.ts`

**Step 1: Create utils module**

```typescript
// src/lib/fiscal/utils.ts

export function formatAmount(amount: number, decimals: number = 2): string {
  return amount.toFixed(decimals)
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  // Format: DD.MM.YYYYTHH:MM:SS
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, "0")
  const minutes = String(d.getMinutes()).padStart(2, "0")
  const seconds = String(d.getSeconds()).padStart(2, "0")
  return `${day}.${month}.${year}T${hours}:${minutes}:${seconds}`
}

export function generateUUID(): string {
  return crypto.randomUUID()
}
```

**Step 2: Install xmlbuilder2**

Run: `cd /home/admin/FiskAI && npm install xmlbuilder2`

**Step 3: Create XML builder module**

```typescript
// src/lib/fiscal/xml-builder.ts
import { create } from "xmlbuilder2"
import { calculateZKI } from "@/lib/e-invoice/zki"
import { formatAmount, formatDateTime, generateUUID } from "./utils"

const NAMESPACE = "http://www.apis-it.hr/fin/2012/types/f73"
const SCHEMA_LOCATION = "http://www.apis-it.hr/fin/2012/types/f73 FiskalizacijaSchema.xsd"

export interface FiscalInvoiceData {
  invoiceNumber: number
  premisesCode: string
  deviceCode: string
  issueDate: Date
  totalAmount: number
  vatRegistered: boolean
  vatBreakdown?: Array<{
    rate: number
    baseAmount: number
    vatAmount: number
  }>
  consumptionTax?: Array<{
    rate: number
    baseAmount: number
    amount: number
  }>
  exemptAmount?: number
  marginAmount?: number
  notTaxableAmount?: number
  paymentMethod: string
  operatorOib: string
  subsequentDelivery?: boolean
  paragonNumber?: string
  specificPurpose?: string
}

export interface XMLBuildResult {
  xml: string
  zki: string
  messageId: string
}

export function buildRacunRequest(
  invoice: FiscalInvoiceData,
  privateKeyPem: string,
  oib: string
): XMLBuildResult {
  const messageId = generateUUID()
  const timestamp = new Date()

  // Calculate ZKI (Zaštitni Kod Izdavatelja)
  const zki = calculateZKI(
    {
      oib,
      invoiceDate: invoice.issueDate,
      invoiceNumber: String(invoice.invoiceNumber),
      premisesCode: invoice.premisesCode,
      deviceCode: invoice.deviceCode,
      totalAmount: invoice.totalAmount,
    },
    privateKeyPem
  )

  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele(NAMESPACE, "tns:RacunZahtjev")
    .att("xmlns:tns", NAMESPACE)
    .att("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance")
    .att("xsi:schemaLocation", SCHEMA_LOCATION)
    .att("Id", "RacunZahtjev")

  // Zaglavlje (Header)
  const zaglavlje = doc.ele("tns:Zaglavlje")
  zaglavlje.ele("tns:IdPoruke").txt(messageId)
  zaglavlje.ele("tns:DatumVrijeme").txt(formatDateTime(timestamp))

  // Racun (Invoice)
  const racun = doc.ele("tns:Racun")

  racun.ele("tns:Oib").txt(oib)
  racun.ele("tns:USustPdv").txt(invoice.vatRegistered ? "true" : "false")
  racun.ele("tns:DatVrijeme").txt(formatDateTime(invoice.issueDate))
  racun.ele("tns:OznSlijed").txt("N") // N = on premises level

  // Broj računa (Invoice number structure)
  const brojRacuna = racun.ele("tns:BrRac")
  brojRacuna.ele("tns:BrOznRac").txt(String(invoice.invoiceNumber))
  brojRacuna.ele("tns:OznPosPr").txt(invoice.premisesCode)
  brojRacuna.ele("tns:OznNapUr").txt(invoice.deviceCode)

  // PDV (VAT breakdown) - if VAT registered
  if (invoice.vatRegistered && invoice.vatBreakdown?.length) {
    const pdv = racun.ele("tns:Pdv")
    for (const vat of invoice.vatBreakdown) {
      const porez = pdv.ele("tns:Porez")
      porez.ele("tns:Stopa").txt(formatAmount(vat.rate, 2))
      porez.ele("tns:Osnovica").txt(formatAmount(vat.baseAmount, 2))
      porez.ele("tns:Iznos").txt(formatAmount(vat.vatAmount, 2))
    }
  }

  // PNP (Consumption tax) - optional
  if (invoice.consumptionTax?.length) {
    const pnp = racun.ele("tns:Pnp")
    for (const tax of invoice.consumptionTax) {
      const porez = pnp.ele("tns:Porez")
      porez.ele("tns:Stopa").txt(formatAmount(tax.rate, 2))
      porez.ele("tns:Osnovica").txt(formatAmount(tax.baseAmount, 2))
      porez.ele("tns:Iznos").txt(formatAmount(tax.amount, 2))
    }
  }

  // Oslobođenja (Exemptions)
  if (invoice.exemptAmount) {
    racun.ele("tns:IznosOsworking").txt(formatAmount(invoice.exemptAmount, 2))
  }

  // Marža (Margin scheme)
  if (invoice.marginAmount) {
    racun.ele("tns:IznosMarza").txt(formatAmount(invoice.marginAmount, 2))
  }

  // Ne podliježe oporezivanju (Not subject to tax)
  if (invoice.notTaxableAmount) {
    racun.ele("tns:IznosNePodworking").txt(formatAmount(invoice.notTaxableAmount, 2))
  }

  // Ukupni iznos (Total amount)
  racun.ele("tns:IznosUkupno").txt(formatAmount(invoice.totalAmount, 2))

  // Način plaćanja (Payment method)
  racun.ele("tns:NacinPlac").txt(mapPaymentMethod(invoice.paymentMethod))

  // OIB operatera (Operator OIB)
  racun.ele("tns:OibOper").txt(invoice.operatorOib)

  // ZKI
  racun.ele("tns:ZastKod").txt(zki)

  // Naknadna dostava (Subsequent delivery)
  racun.ele("tns:NaknadnaDost").txt(invoice.subsequentDelivery ? "true" : "false")

  // Paragon block number
  if (invoice.paragonNumber) {
    racun.ele("tns:ParagonBrRac").txt(invoice.paragonNumber)
  }

  // Specifična namjena (Specific purpose)
  if (invoice.specificPurpose) {
    racun.ele("tns:SpecNamworking").txt(invoice.specificPurpose)
  }

  return {
    xml: doc.end({ prettyPrint: false }),
    zki,
    messageId,
  }
}

function mapPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    CASH: "G",
    G: "G", // Gotovina (Cash)
    CARD: "K",
    K: "K", // Kartica (Card)
    BANK_TRANSFER: "T",
    T: "T", // Transakcijski račun (Bank transfer)
    OTHER: "O",
    O: "O", // Ostalo (Other)
    CHECK: "C",
    C: "C", // Ček (Check)
  }
  return map[method] || "O"
}

export function buildStornoRequest(
  originalInvoice: FiscalInvoiceData,
  originalJir: string,
  privateKeyPem: string,
  oib: string
): XMLBuildResult {
  // Storno invoice has negative amounts
  const stornoInvoice: FiscalInvoiceData = {
    ...originalInvoice,
    totalAmount: -Math.abs(originalInvoice.totalAmount),
    vatBreakdown: originalInvoice.vatBreakdown?.map((v) => ({
      ...v,
      baseAmount: -Math.abs(v.baseAmount),
      vatAmount: -Math.abs(v.vatAmount),
    })),
    specificPurpose: `STORNO ${originalJir}`,
  }

  return buildRacunRequest(stornoInvoice, privateKeyPem, oib)
}
```

---

## Task 10: Create XML Signer Module

**Files:**

- Create: `src/lib/fiscal/xml-signer.ts`

**Step 1: Install xml-crypto and xmldom**

Run: `cd /home/admin/FiskAI && npm install xml-crypto @xmldom/xmldom`

**Step 2: Create XML signer module**

```typescript
// src/lib/fiscal/xml-signer.ts
import { SignedXml } from "xml-crypto"
import { DOMParser } from "@xmldom/xmldom"

export interface SigningCredentials {
  privateKeyPem: string
  certificatePem: string
}

export function signXML(xml: string, credentials: SigningCredentials): string {
  const sig = new SignedXml({
    privateKey: credentials.privateKeyPem,
    publicCert: credentials.certificatePem,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/2001/10/xml-exc-c14n#",
  })

  // Add reference to the RacunZahtjev element
  sig.addReference({
    xpath: "//*[@Id='RacunZahtjev']",
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/2001/10/xml-exc-c14n#",
    ],
  })

  // Include KeyInfo with X509 certificate
  sig.keyInfoProvider = {
    getKeyInfo: () => {
      return `<X509Data><X509Certificate>${extractCertificateBase64(
        credentials.certificatePem
      )}</X509Certificate></X509Data>`
    },
  }

  // Compute signature
  sig.computeSignature(xml, {
    location: {
      reference: "//*[local-name()='RacunZahtjev']",
      action: "append",
    },
  })

  return sig.getSignedXml()
}

function extractCertificateBase64(pem: string): string {
  return pem
    .replace(/-----BEGIN CERTIFICATE-----/g, "")
    .replace(/-----END CERTIFICATE-----/g, "")
    .replace(/\s/g, "")
}
```

---

## Task 11: Create Porezna Client Module

**Files:**

- Create: `src/lib/fiscal/porezna-client.ts`

**Step 1: Install xml2js**

Run: `cd /home/admin/FiskAI && npm install xml2js && npm install -D @types/xml2js`

**Step 2: Create Porezna client module**

```typescript
// src/lib/fiscal/porezna-client.ts
import { parseStringPromise } from "xml2js"

const ENDPOINTS = {
  TEST: "https://cistest.apis-it.hr:8449/FiskalizacijaServiceTest",
  PROD: "https://cis.porezna-uprava.hr:8449/FiskalizacijaService",
}

export interface PoreznaResponse {
  success: boolean
  jir?: string
  zki?: string
  errorCode?: string
  errorMessage?: string
  rawResponse: string
}

export interface PoreznaError {
  httpStatus?: number
  poreznaCode?: string
  message: string
  body?: string
}

export async function submitToPorezna(
  signedXml: string,
  environment: "TEST" | "PROD"
): Promise<PoreznaResponse> {
  const endpoint = ENDPOINTS[environment]
  const soapEnvelope = buildSoapEnvelope(signedXml)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/soap+xml; charset=utf-8",
        SOAPAction: "http://www.apis-it.hr/fin/2012/types/f73/FiskalizacijaService/Racun",
      },
      body: soapEnvelope,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const responseText = await response.text()

    if (!response.ok) {
      const error: PoreznaError = {
        httpStatus: response.status,
        message: `HTTP ${response.status}`,
        body: responseText,
      }
      throw error
    }

    return parsePoreznaResponse(responseText)
  } catch (error) {
    clearTimeout(timeout)

    if (error instanceof Error && error.name === "AbortError") {
      const timeoutError: PoreznaError = {
        message: "Request timeout after 30s",
      }
      throw timeoutError
    }

    throw error
  }
}

function buildSoapEnvelope(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    ${content}
  </soap:Body>
</soap:Envelope>`
}

async function parsePoreznaResponse(xml: string): Promise<PoreznaResponse> {
  try {
    const parsed = await parseStringPromise(xml, {
      explicitArray: false,
      ignoreAttrs: false,
      tagNameProcessors: [stripNamespace],
    })

    const envelope = parsed.Envelope
    const body = envelope?.Body

    // Check for SOAP Fault
    if (body?.Fault) {
      const fault = body.Fault
      return {
        success: false,
        errorCode: fault.Code?.Value || "SOAP_FAULT",
        errorMessage: fault.Reason?.Text || "Unknown SOAP error",
        rawResponse: xml,
      }
    }

    // Check for RacunOdgovor (Invoice Response)
    const odgovor = body?.RacunOdgovor
    if (!odgovor) {
      return {
        success: false,
        errorCode: "INVALID_RESPONSE",
        errorMessage: "No RacunOdgovor in response",
        rawResponse: xml,
      }
    }

    // Check for errors in response
    const greske = odgovor.Greske?.Greska
    if (greske) {
      const errors = Array.isArray(greske) ? greske : [greske]
      const firstError = errors[0]
      return {
        success: false,
        errorCode: firstError.SifraGreske,
        errorMessage: firstError.PorukaGreske,
        rawResponse: xml,
      }
    }

    // Success - extract JIR
    const jir = odgovor.Jir
    const zki = odgovor.ZastKod

    if (!jir) {
      return {
        success: false,
        errorCode: "NO_JIR",
        errorMessage: "Response missing JIR",
        rawResponse: xml,
      }
    }

    return {
      success: true,
      jir,
      zki,
      rawResponse: xml,
    }
  } catch (parseError) {
    return {
      success: false,
      errorCode: "PARSE_ERROR",
      errorMessage: `Failed to parse response: ${parseError}`,
      rawResponse: xml,
    }
  }
}

function stripNamespace(name: string): string {
  const idx = name.indexOf(":")
  return idx >= 0 ? name.substring(idx + 1) : name
}
```

---

## Task 12: Create Fiscal Pipeline Module

**Files:**

- Create: `src/lib/fiscal/fiscal-pipeline.ts`

```typescript
// src/lib/fiscal/fiscal-pipeline.ts
import { db } from "@/lib/db"
import { FiscalRequest } from "@prisma/client"
import { decryptWithEnvelope } from "./envelope-encryption"
import { parseP12Certificate, forgeToPem } from "./certificate-parser"
import { buildRacunRequest, buildStornoRequest, FiscalInvoiceData } from "./xml-builder"
import { signXML } from "./xml-signer"
import { submitToPorezna } from "./porezna-client"

export interface PipelineResult {
  success: boolean
  jir?: string
  zki?: string
  responseXml?: string
  errorCode?: string
  errorMessage?: string
}

export async function executeFiscalRequest(request: FiscalRequest): Promise<PipelineResult> {
  // 1. Load certificate
  const certificate = await db.fiscalCertificate.findUnique({
    where: { id: request.certificateId },
  })

  if (!certificate) {
    throw { poreznaCode: "p001", message: "Certificate not found" }
  }

  if (certificate.status !== "ACTIVE") {
    throw { poreznaCode: "p002", message: `Certificate status: ${certificate.status}` }
  }

  if (certificate.certNotAfter < new Date()) {
    throw { poreznaCode: "p003", message: "Certificate has expired" }
  }

  // 2. Decrypt certificate
  const decryptedPayload = decryptWithEnvelope(
    certificate.encryptedP12,
    certificate.encryptedDataKey
  )
  const { p12, password } = JSON.parse(decryptedPayload)
  const p12Buffer = Buffer.from(p12, "base64")

  const parsedCert = await parseP12Certificate(p12Buffer, password)
  const credentials = forgeToPem(parsedCert.privateKey, parsedCert.certificate)

  // 3. Load invoice data
  const invoice = await db.invoice.findUnique({
    where: { id: request.invoiceId! },
    include: {
      items: true,
      company: true,
    },
  })

  if (!invoice) {
    throw { poreznaCode: "p004", message: "Invoice not found" }
  }

  // 4. Build fiscal invoice structure
  const fiscalInvoice = mapToFiscalInvoice(invoice)

  // 5. Build XML
  let buildResult
  if (request.messageType === "STORNO" && invoice.jir) {
    buildResult = buildStornoRequest(
      fiscalInvoice,
      invoice.jir,
      credentials.privateKeyPem,
      certificate.oibExtracted
    )
  } else {
    buildResult = buildRacunRequest(
      fiscalInvoice,
      credentials.privateKeyPem,
      certificate.oibExtracted
    )
  }

  const { xml, zki, messageId } = buildResult

  // Store request XML
  await db.fiscalRequest.update({
    where: { id: request.id },
    data: { requestXml: xml, zki },
  })

  // 6. Sign XML
  const signedXml = signXML(xml, credentials)

  // Store signed XML
  await db.fiscalRequest.update({
    where: { id: request.id },
    data: { signedXml },
  })

  // 7. Submit to Porezna
  const response = await submitToPorezna(signedXml, certificate.environment)

  // Store response
  await db.fiscalRequest.update({
    where: { id: request.id },
    data: { responseXml: response.rawResponse },
  })

  // Update certificate last used
  await db.fiscalCertificate.update({
    where: { id: certificate.id },
    data: { lastUsedAt: new Date() },
  })

  if (response.success) {
    return {
      success: true,
      jir: response.jir,
      zki: response.zki || zki,
      responseXml: response.rawResponse,
    }
  } else {
    throw {
      poreznaCode: response.errorCode,
      message: response.errorMessage || "Unknown error",
    }
  }
}

function mapToFiscalInvoice(invoice: any): FiscalInvoiceData {
  // Extract VAT breakdown from invoice items
  const vatMap = new Map<number, { base: number; vat: number }>()

  for (const item of invoice.items) {
    const rate = Number(item.vatRate)
    const existing = vatMap.get(rate) || { base: 0, vat: 0 }
    existing.base += Number(item.netAmount)
    existing.vat += Number(item.vatAmount)
    vatMap.set(rate, existing)
  }

  const vatBreakdown = Array.from(vatMap.entries()).map(([rate, amounts]) => ({
    rate,
    baseAmount: amounts.base,
    vatAmount: amounts.vat,
  }))

  return {
    invoiceNumber: extractInvoiceNumber(invoice.invoiceNumber),
    premisesCode: invoice.company.premisesCode || "1",
    deviceCode: invoice.company.deviceCode || "1",
    issueDate: invoice.issueDate,
    totalAmount: Number(invoice.totalAmount),
    vatRegistered: invoice.company.vatRegistered ?? true,
    vatBreakdown,
    paymentMethod: invoice.paymentMethod || "G",
    operatorOib: invoice.operatorOib || invoice.company.oib,
    subsequentDelivery: false,
  }
}

function extractInvoiceNumber(invoiceNumber: string): number {
  const match = invoiceNumber.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : 1
}
```

---

## Task 13: Create Should Fiscalize Logic

**Files:**

- Create: `src/lib/fiscal/should-fiscalize.ts`

```typescript
// src/lib/fiscal/should-fiscalize.ts
import { db } from "@/lib/db"
import { Invoice, Company } from "@prisma/client"

export interface FiscalDecision {
  shouldFiscalize: boolean
  reason: string
  certificateId?: string
  environment?: "TEST" | "PROD"
}

export async function shouldFiscalizeInvoice(
  invoice: Invoice & { company: Company }
): Promise<FiscalDecision> {
  const { company } = invoice

  // 1. Check if company has fiscalisation enabled
  if (!company.fiscalEnabled) {
    return { shouldFiscalize: false, reason: "Fiscalisation disabled for company" }
  }

  // 2. Check payment method - only cash-equivalent needs fiscalisation
  const cashMethods = ["CASH", "CARD", "G", "K"]
  const paymentMethod = (invoice as any).paymentMethod
  if (!cashMethods.includes(paymentMethod)) {
    return { shouldFiscalize: false, reason: "Non-cash payment method" }
  }

  // 3. Check if already fiscalized
  if ((invoice as any).jir) {
    return { shouldFiscalize: false, reason: "Already fiscalized" }
  }

  // 4. Check for existing pending request (idempotency)
  const existingRequest = await db.fiscalRequest.findFirst({
    where: {
      invoiceId: invoice.id,
      messageType: "RACUN",
      status: { in: ["QUEUED", "PROCESSING"] },
    },
  })

  if (existingRequest) {
    return { shouldFiscalize: false, reason: "Request already queued" }
  }

  // 5. Determine environment and find certificate
  const environment = company.fiscalEnvironment || "PROD"

  const certificate = await db.fiscalCertificate.findUnique({
    where: {
      companyId_environment: {
        companyId: company.id,
        environment,
      },
    },
  })

  if (!certificate) {
    return {
      shouldFiscalize: false,
      reason: `No ${environment} certificate configured`,
    }
  }

  if (certificate.status !== "ACTIVE") {
    return {
      shouldFiscalize: false,
      reason: `Certificate status: ${certificate.status}`,
    }
  }

  if (certificate.certNotAfter < new Date()) {
    return {
      shouldFiscalize: false,
      reason: "Certificate expired",
    }
  }

  return {
    shouldFiscalize: true,
    reason: "Meets fiscalisation criteria",
    certificateId: certificate.id,
    environment,
  }
}

export async function queueFiscalRequest(
  invoiceId: string,
  companyId: string,
  decision: FiscalDecision
): Promise<string | null> {
  if (!decision.shouldFiscalize || !decision.certificateId) {
    return null
  }

  const request = await db.fiscalRequest.upsert({
    where: {
      companyId_invoiceId_messageType: {
        companyId,
        invoiceId,
        messageType: "RACUN",
      },
    },
    create: {
      companyId,
      invoiceId,
      certificateId: decision.certificateId,
      messageType: "RACUN",
      status: "QUEUED",
      attemptCount: 0,
      maxAttempts: 5,
      nextRetryAt: new Date(),
    },
    update: {
      status: "QUEUED",
      attemptCount: 0,
      nextRetryAt: new Date(),
      errorCode: null,
      errorMessage: null,
    },
  })

  return request.id
}
```

---

## Task 14: Create Job Processor Cron Endpoint

**Files:**

- Create: `src/app/api/cron/fiscal-processor/route.ts`

```typescript
// src/app/api/cron/fiscal-processor/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { FiscalRequest } from "@prisma/client"
import { executeFiscalRequest } from "@/lib/fiscal/fiscal-pipeline"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const batchSize = 10
  const lockDurationMs = 60000
  const workerId = `worker-${crypto.randomUUID().slice(0, 8)}`

  try {
    // Recover stale locks first
    await recoverStaleLocks()

    // Acquire jobs with row locking
    const jobs = await db.$queryRaw<FiscalRequest[]>`
      UPDATE "FiscalRequest"
      SET
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "status" = 'PROCESSING'
      WHERE id IN (
        SELECT id FROM "FiscalRequest"
        WHERE "status" IN ('QUEUED', 'FAILED')
          AND "nextRetryAt" <= NOW()
          AND "attemptCount" < "maxAttempts"
          AND ("lockedAt" IS NULL OR "lockedAt" < NOW() - INTERVAL '${lockDurationMs} milliseconds')
        ORDER BY "nextRetryAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${batchSize}
      )
      RETURNING *
    `

    const results = []

    // Process each job
    for (const job of jobs) {
      const result = await processJob(job, workerId)
      results.push({ id: job.id, ...result })
    }

    return NextResponse.json({
      processed: jobs.length,
      results,
    })
  } catch (error) {
    console.error("[fiscal-processor] error:", error)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

async function processJob(
  job: FiscalRequest,
  workerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await executeFiscalRequest(job)

    // Success - update with JIR
    await db.fiscalRequest.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        jir: result.jir,
        responseXml: result.responseXml,
        lockedAt: null,
        lockedBy: null,
      },
    })

    // Update invoice with JIR
    if (job.invoiceId && result.jir) {
      await db.invoice.update({
        where: { id: job.invoiceId },
        data: {
          jir: result.jir,
          zki: result.zki,
          fiscalizedAt: new Date(),
          fiscalStatus: "COMPLETED",
        },
      })
    }

    return { success: true }
  } catch (error) {
    const classification = classifyError(error)
    const attemptCount = job.attemptCount + 1

    await db.fiscalRequest.update({
      where: { id: job.id },
      data: {
        status: classification.retriable ? "FAILED" : "DEAD",
        attemptCount,
        errorCode: classification.code,
        errorMessage: classification.message,
        lastHttpStatus: classification.httpStatus,
        nextRetryAt: classification.retriable ? calculateNextRetry(attemptCount) : null,
        lockedAt: null,
        lockedBy: null,
      },
    })

    // Update invoice fiscal status
    if (job.invoiceId) {
      await db.invoice.update({
        where: { id: job.invoiceId },
        data: {
          fiscalStatus: classification.retriable ? "PENDING" : "FAILED",
        },
      })
    }

    return { success: false, error: classification.message }
  }
}

interface ErrorClassification {
  code: string
  message: string
  httpStatus?: number
  retriable: boolean
}

function classifyError(error: unknown): ErrorClassification {
  // Network errors - always retry
  if (error instanceof Error) {
    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("timeout")
    ) {
      return { code: "NETWORK_ERROR", message: error.message, retriable: true }
    }
  }

  // HTTP response errors
  if (error && typeof error === "object" && "httpStatus" in error) {
    const httpError = error as { httpStatus: number; body?: string }

    if (httpError.httpStatus >= 500) {
      return {
        code: "SERVER_ERROR",
        message: `HTTP ${httpError.httpStatus}`,
        httpStatus: httpError.httpStatus,
        retriable: true,
      }
    }

    if (httpError.httpStatus === 429) {
      return {
        code: "RATE_LIMITED",
        message: "Too many requests",
        httpStatus: 429,
        retriable: true,
      }
    }

    return {
      code: "VALIDATION_ERROR",
      message: httpError.body || `HTTP ${httpError.httpStatus}`,
      httpStatus: httpError.httpStatus,
      retriable: false,
    }
  }

  // Porezna-specific error codes
  if (error && typeof error === "object" && "poreznaCode" in error) {
    const poreznaError = error as { poreznaCode: string; message: string }

    // t001-t099: Temporary errors - retry
    const retriable = poreznaError.poreznaCode.startsWith("t")

    return {
      code: poreznaError.poreznaCode,
      message: poreznaError.message,
      retriable,
    }
  }

  return { code: "UNKNOWN", message: String(error), retriable: false }
}

function calculateNextRetry(attemptCount: number): Date {
  // Exponential backoff: 30s, 2m, 8m, 32m, 2h
  const baseDelaySeconds = 30
  const delaySeconds = baseDelaySeconds * Math.pow(4, attemptCount - 1)
  const maxDelaySeconds = 2 * 60 * 60

  const actualDelay = Math.min(delaySeconds, maxDelaySeconds)
  const jitter = actualDelay * 0.1 * (Math.random() * 2 - 1)

  return new Date(Date.now() + (actualDelay + jitter) * 1000)
}

async function recoverStaleLocks() {
  const staleLockThreshold = 5 * 60 * 1000 // 5 minutes

  await db.fiscalRequest.updateMany({
    where: {
      status: "PROCESSING",
      lockedAt: { lt: new Date(Date.now() - staleLockThreshold) },
    },
    data: {
      status: "FAILED",
      lockedAt: null,
      lockedBy: null,
      errorMessage: "Lock expired - worker may have crashed",
    },
  })
}
```

---

## Task 15: Create Certificate Upload Server Actions

**Files:**

- Create: `src/app/actions/fiscal-certificate.ts`

```typescript
// src/app/actions/fiscal-certificate.ts
"use server"

import { revalidatePath } from "next/cache"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { encryptWithEnvelope } from "@/lib/fiscal/envelope-encryption"
import { parseP12Certificate, validateCertificate } from "@/lib/fiscal/certificate-parser"

export interface UploadCertificateInput {
  p12Base64: string
  password: string
  environment: "TEST" | "PROD"
}

export interface CertificateInfo {
  subject: string
  oib: string
  serial: string
  notBefore: Date
  notAfter: Date
  issuer: string
  sha256: string
}

export async function validateCertificateAction(
  input: UploadCertificateInput
): Promise<{ success: true; info: CertificateInfo } | { success: false; error: string }> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const p12Buffer = Buffer.from(input.p12Base64, "base64")

    if (p12Buffer.length > 50 * 1024) {
      return { success: false, error: "Certificate file too large (max 50KB)" }
    }

    const certInfo = await parseP12Certificate(p12Buffer, input.password)

    const validation = validateCertificate(certInfo, input.environment)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    if (certInfo.oib !== company.oib) {
      console.warn(`[fiscal-cert] OIB mismatch: cert=${certInfo.oib}, company=${company.oib}`)
    }

    return {
      success: true,
      info: {
        subject: certInfo.subject,
        oib: certInfo.oib,
        serial: certInfo.serial,
        notBefore: certInfo.notBefore,
        notAfter: certInfo.notAfter,
        issuer: certInfo.issuer,
        sha256: certInfo.sha256,
      },
    }
  } catch (error) {
    console.error("[fiscal-cert] validate error:", error)
    if (error instanceof Error && error.message.includes("password")) {
      return { success: false, error: "Invalid certificate password" }
    }
    return { success: false, error: "Failed to parse certificate" }
  }
}

export async function saveCertificateAction(
  input: UploadCertificateInput
): Promise<{ success: true; certificateId: string } | { success: false; error: string }> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const p12Buffer = Buffer.from(input.p12Base64, "base64")
    const certInfo = await parseP12Certificate(p12Buffer, input.password)

    const payload = JSON.stringify({
      p12: input.p12Base64,
      password: input.password,
    })
    const { encryptedData, encryptedDataKey } = encryptWithEnvelope(payload)

    const certificate = await db.fiscalCertificate.upsert({
      where: {
        companyId_environment: {
          companyId: company.id,
          environment: input.environment,
        },
      },
      create: {
        companyId: company.id,
        environment: input.environment,
        provider: "DIRECT",
        certSubject: certInfo.subject,
        certSerial: certInfo.serial,
        certNotBefore: certInfo.notBefore,
        certNotAfter: certInfo.notAfter,
        oibExtracted: certInfo.oib,
        certSha256: certInfo.sha256,
        encryptedP12: encryptedData,
        encryptedDataKey: encryptedDataKey,
        status: "ACTIVE",
      },
      update: {
        certSubject: certInfo.subject,
        certSerial: certInfo.serial,
        certNotBefore: certInfo.notBefore,
        certNotAfter: certInfo.notAfter,
        oibExtracted: certInfo.oib,
        certSha256: certInfo.sha256,
        encryptedP12: encryptedData,
        encryptedDataKey: encryptedDataKey,
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    })

    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id!,
        action: "FISCAL_CERTIFICATE_UPLOADED",
        entityType: "FiscalCertificate",
        entityId: certificate.id,
        metadata: {
          environment: input.environment,
          certSerial: certInfo.serial,
          oib: certInfo.oib,
          expiresAt: certInfo.notAfter.toISOString(),
        },
      },
    })

    revalidatePath("/settings/fiscalisation")
    return { success: true, certificateId: certificate.id }
  } catch (error) {
    console.error("[fiscal-cert] save error:", error)
    return { success: false, error: "Failed to save certificate" }
  }
}

export async function deleteCertificateAction(
  environment: "TEST" | "PROD"
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const pendingRequests = await db.fiscalRequest.count({
      where: {
        companyId: company.id,
        certificate: { environment },
        status: { in: ["QUEUED", "PROCESSING"] },
      },
    })

    if (pendingRequests > 0) {
      return {
        success: false,
        error: `Cannot delete: ${pendingRequests} pending fiscal requests`,
      }
    }

    await db.fiscalCertificate.delete({
      where: {
        companyId_environment: {
          companyId: company.id,
          environment,
        },
      },
    })

    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id!,
        action: "FISCAL_CERTIFICATE_DELETED",
        entityType: "FiscalCertificate",
        metadata: { environment },
      },
    })

    revalidatePath("/settings/fiscalisation")
    return { success: true }
  } catch (error) {
    console.error("[fiscal-cert] delete error:", error)
    return { success: false, error: "Failed to delete certificate" }
  }
}

export async function retryFiscalRequestAction(
  requestId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const request = await db.fiscalRequest.findFirst({
      where: { id: requestId, companyId: company.id },
    })

    if (!request) {
      return { success: false, error: "Request not found" }
    }

    if (!["FAILED", "DEAD"].includes(request.status)) {
      return { success: false, error: "Can only retry failed requests" }
    }

    await db.fiscalRequest.update({
      where: { id: requestId },
      data: {
        status: "QUEUED",
        attemptCount: 0,
        nextRetryAt: new Date(),
        errorCode: null,
        errorMessage: null,
        lockedAt: null,
        lockedBy: null,
      },
    })

    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id!,
        action: "FISCAL_REQUEST_RETRY",
        entityType: "FiscalRequest",
        entityId: requestId,
      },
    })

    revalidatePath("/settings/fiscalisation")
    return { success: true }
  } catch (error) {
    console.error("[fiscal-cert] retry error:", error)
    return { success: false, error: "Failed to retry request" }
  }
}

export async function manualFiscalizeAction(
  invoiceId: string
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const invoice = await db.invoice.findFirst({
      where: { id: invoiceId, companyId: company.id },
    })

    if (!invoice) {
      return { success: false, error: "Invoice not found" }
    }

    if ((invoice as any).jir) {
      return { success: false, error: "Invoice already fiscalized" }
    }

    if (invoice.status === "DRAFT") {
      return { success: false, error: "Cannot fiscalize draft invoice" }
    }

    const environment = company.fiscalEnvironment || "PROD"

    const certificate = await db.fiscalCertificate.findUnique({
      where: {
        companyId_environment: {
          companyId: company.id,
          environment,
        },
      },
    })

    if (!certificate || certificate.status !== "ACTIVE") {
      return { success: false, error: "No active certificate configured" }
    }

    const request = await db.fiscalRequest.upsert({
      where: {
        companyId_invoiceId_messageType: {
          companyId: company.id,
          invoiceId,
          messageType: "RACUN",
        },
      },
      create: {
        companyId: company.id,
        invoiceId,
        certificateId: certificate.id,
        messageType: "RACUN",
        status: "QUEUED",
        attemptCount: 0,
        maxAttempts: 5,
        nextRetryAt: new Date(),
      },
      update: {
        status: "QUEUED",
        attemptCount: 0,
        nextRetryAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    })

    await db.invoice.update({
      where: { id: invoiceId },
      data: { fiscalStatus: "PENDING" },
    })

    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id!,
        action: "INVOICE_MANUAL_FISCALIZE",
        entityType: "Invoice",
        entityId: invoiceId,
        metadata: { requestId: request.id },
      },
    })

    revalidatePath(`/invoices/${invoiceId}`)
    return { success: true, requestId: request.id }
  } catch (error) {
    console.error("[fiscal-cert] manual fiscalize error:", error)
    return { success: false, error: "Failed to queue fiscalization" }
  }
}
```

---

## Task 16: Create Fiscalisation Settings Page

**Files:**

- Create: `src/app/(dashboard)/settings/fiscalisation/page.tsx`

```typescript
// src/app/(dashboard)/settings/fiscalisation/page.tsx
import { requireAuth, requireCompany } from '@/lib/auth-utils'
import { db } from '@/lib/db'
import { CertificateCard } from './certificate-card'
import { FiscalStatusPanel } from './fiscal-status-panel'

export default async function FiscalisationSettingsPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  const [testCert, prodCert, recentRequests, stats] = await Promise.all([
    db.fiscalCertificate.findUnique({
      where: { companyId_environment: { companyId: company.id, environment: 'TEST' } }
    }),
    db.fiscalCertificate.findUnique({
      where: { companyId_environment: { companyId: company.id, environment: 'PROD' } }
    }),
    db.fiscalRequest.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { invoice: { select: { invoiceNumber: true } } }
    }),
    db.fiscalRequest.groupBy({
      by: ['status'],
      where: { companyId: company.id },
      _count: true
    })
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Fiscalisation Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage certificates and monitor fiscalisation status
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CertificateCard
          environment="TEST"
          certificate={testCert}
          companyOib={company.oib}
        />
        <CertificateCard
          environment="PROD"
          certificate={prodCert}
          companyOib={company.oib}
        />
      </div>

      <FiscalStatusPanel
        requests={recentRequests}
        stats={stats}
      />
    </div>
  )
}
```

---

## Task 17: Create Certificate Card Component

**Files:**

- Create: `src/app/(dashboard)/settings/fiscalisation/certificate-card.tsx`

This is a client component that displays certificate info and handles upload/delete actions. See the full implementation in the brainstorming session - includes:

- Certificate status display (active, expired, expiring soon)
- OIB mismatch warnings
- Upload and delete buttons
- Dialog triggers for upload wizard

---

## Task 18: Create Certificate Upload Dialog

**Files:**

- Create: `src/app/(dashboard)/settings/fiscalisation/certificate-upload-dialog.tsx`

This is a client component with a 3-step wizard:

1. Upload P12 file with password
2. Verify certificate details
3. Confirmation and save

Uses react-dropzone for file upload. See full implementation in brainstorming session.

---

## Task 19: Create Fiscal Status Panel Component

**Files:**

- Create: `src/app/(dashboard)/settings/fiscalisation/fiscal-status-panel.tsx`

This displays:

- Stats summary by status (QUEUED, PROCESSING, COMPLETED, FAILED, DEAD)
- Recent requests table with retry capability
- JIR display for completed requests

See full implementation in brainstorming session.

---

## Task 20: Add Settings Navigation Link

**Files:**

- Modify: `src/components/layout/settings-nav.tsx` (or similar navigation component)

Add link to fiscalisation settings:

```typescript
{
  href: '/settings/fiscalisation',
  label: 'Fiscalisation',
  icon: Shield
}
```

---

## Task 21: Integrate Fiscalisation with Invoice Finalization

**Files:**

- Modify: `src/app/actions/invoice.ts` (or wherever invoice finalization happens)

After invoice is finalized, add:

```typescript
import { shouldFiscalizeInvoice, queueFiscalRequest } from "@/lib/fiscal/should-fiscalize"

// After setting invoice status to FINALIZED:
const fiscalDecision = await shouldFiscalizeInvoice({
  ...invoice,
  company,
})

if (fiscalDecision.shouldFiscalize) {
  await queueFiscalRequest(invoice.id, company.id, fiscalDecision)
  await db.invoice.update({
    where: { id: invoice.id },
    data: { fiscalStatus: "PENDING" },
  })
}
```

---

## Task 22: Add Fiscal Status Badge to Invoice UI

**Files:**

- Modify: Invoice detail page component

Add fiscal status display showing:

- JIR if fiscalized
- Pending/Processing status
- Failed status with retry button
- Manual fiscalize button if applicable

---

## Task 23: Set Up Cron Job

**Files:**

- Create or modify cron configuration

Set up external cron (via Coolify or crontab) to hit:

```
GET /api/cron/fiscal-processor
Authorization: Bearer ${CRON_SECRET}
```

Recommended frequency: Every 1 minute

---

## Task 24: Test End-to-End Flow

**Manual Testing:**

1. Generate test FISCAL_CERT_KEY: `openssl rand -hex 32`
2. Add to environment
3. Run migrations
4. Upload test certificate (use FINA demo cert)
5. Create and finalize cash invoice
6. Verify request queued
7. Trigger cron manually
8. Verify JIR received (in test mode)

---

## Security Considerations

1. **Certificate storage**: Envelope encryption with unique data key per certificate
2. **Master key**: Stored in environment variable, never in database
3. **P12 password**: Bundled with encrypted P12, never stored separately
4. **Audit logging**: All certificate operations logged
5. **OIB validation**: Mod-11 checksum verification
6. **Certificate expiry**: Checked before every signing operation

---

## Observability

1. **Logs**: Console logging for errors with `[fiscal-*]` prefix
2. **Metrics**: Stats panel shows request counts by status
3. **Alerts**: Certificate expiry warnings in UI
4. **Audit trail**: All operations logged to AuditLog table

---

## Future Enhancements (Out of Scope for MVP)

1. Certificate expiry email notifications
2. Automatic certificate renewal reminders
3. Batch fiscalisation for bulk imports
4. Fiscal report generation
5. Multi-premises support
6. Redis-based queue for higher scale
