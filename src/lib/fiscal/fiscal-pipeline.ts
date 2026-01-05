// src/lib/fiscal/fiscal-pipeline.ts
/**
 * Fiscal Pipeline - Dual-Path Execution
 *
 * Supports two paths for fiscalization:
 * - V1: Legacy FiscalCertificate with envelope encryption (FISCAL_CERT_KEY)
 * - V2: IntegrationAccount with unified vault (INTEGRATION_VAULT_KEY)
 *
 * Routing logic:
 * 1. If integrationAccountId is set on request, use V2 path
 * 2. If USE_INTEGRATION_ACCOUNT_FISCAL=true and no certificateId, try V2
 * 3. Otherwise, use V1 path with certificateId
 *
 * @module fiscal/fiscal-pipeline
 * @since Phase 4 - Fiscalization Migration
 */

import { db } from "@/lib/db"
import { FiscalRequest, Prisma } from "@prisma/client"
import { randomFillSync } from "crypto"
import { decryptWithEnvelope } from "./envelope-encryption"
import { parseP12Certificate, forgeToPem } from "./certificate-parser"
import { buildRacunRequest, buildStornoRequest, FiscalInvoiceData } from "./xml-builder"
import { signXML } from "./xml-signer"
import { submitToPorezna } from "./porezna-client"
import { createSignerFromIntegrationAccount, resolveSignerForCompany } from "./signer-v2"
import { logger } from "@/lib/logger"

const Decimal = Prisma.Decimal

export interface PipelineResult {
  success: boolean
  jir?: string
  zki?: string
  responseXml?: string
  errorCode?: string
  errorMessage?: string
  /** V2 path: integrationAccountId used for signing */
  integrationAccountId?: string
}

/**
 * Check if V2 IntegrationAccount path should be used
 */
function shouldUseIntegrationAccountPath(request: FiscalRequest): boolean {
  // Explicit integrationAccountId takes precedence
  if (request.integrationAccountId) {
    return true
  }

  // Feature flag to try V2 when no certificateId is provided
  if (process.env.USE_INTEGRATION_ACCOUNT_FISCAL === "true" && !request.certificateId) {
    return true
  }

  return false
}

/**
 * Main entry point for fiscal request execution.
 * Routes between V1 (FiscalCertificate) and V2 (IntegrationAccount) paths.
 */
export async function executeFiscalRequest(request: FiscalRequest): Promise<PipelineResult> {
  const useV2 = shouldUseIntegrationAccountPath(request)

  logger.info(
    {
      requestId: request.id,
      companyId: request.companyId,
      useV2,
      hasIntegrationAccountId: !!request.integrationAccountId,
      hasCertificateId: !!request.certificateId,
    },
    "Fiscal pipeline routing"
  )

  if (useV2) {
    return executeFiscalRequestV2(request)
  }

  return executeFiscalRequestV1(request)
}

/**
 * V2 path: Execute fiscal request using IntegrationAccount
 */
async function executeFiscalRequestV2(request: FiscalRequest): Promise<PipelineResult> {
  const p12Buffer: Buffer | null = null

  try {
    // Get signer from IntegrationAccount
    let signer
    if (request.integrationAccountId) {
      signer = await createSignerFromIntegrationAccount(
        request.integrationAccountId,
        request.companyId
      )
    } else {
      // Resolve signer for company
      const environment = process.env.FISCAL_ENVIRONMENT === "TEST" ? "TEST" : ("PROD" as const)
      signer = await resolveSignerForCompany(request.companyId, environment)

      // Update request with resolved integrationAccountId
      await db.fiscalRequest.update({
        where: { id: request.id },
        data: { integrationAccountId: signer.integrationAccountId },
      })
    }

    // Store certificate metadata on request
    await db.fiscalRequest.update({
      where: { id: request.id },
      data: {
        certificateSubject: signer.certSubject,
        certificateSerial: signer.certSerial,
        certificateOib: signer.oib,
        certificateNotAfter: signer.certNotAfter,
      },
    })

    // Load invoice data
    const invoice = await db.eInvoice.findUnique({
      where: { id: request.invoiceId! },
      include: {
        lines: true,
        company: true,
      },
    })

    if (!invoice) {
      throw { poreznaCode: "p004", message: "Invoice not found" }
    }

    // Build fiscal invoice structure
    const fiscalInvoice = mapToFiscalInvoice(invoice)

    // Build XML
    let buildResult
    if (request.messageType === "STORNO" && invoice.jir) {
      buildResult = buildStornoRequest(
        fiscalInvoice,
        invoice.jir,
        signer.credentials.privateKeyPem,
        signer.oib
      )
    } else {
      buildResult = buildRacunRequest(fiscalInvoice, signer.credentials.privateKeyPem, signer.oib)
    }

    const { xml, zki } = buildResult

    // Store request XML
    await db.fiscalRequest.update({
      where: { id: request.id },
      data: { requestXml: xml, zki },
    })

    // Sign XML
    const signedXml = signXML(xml, signer.credentials)

    // Store signed XML
    await db.fiscalRequest.update({
      where: { id: request.id },
      data: { signedXml },
    })

    // Submit to Porezna
    const environment = process.env.FISCAL_ENVIRONMENT === "TEST" ? "TEST" : ("PROD" as const)
    const response = await submitToPorezna(signedXml, environment)

    // Store response
    await db.fiscalRequest.update({
      where: { id: request.id },
      data: { responseXml: response.rawResponse },
    })

    logger.info(
      {
        requestId: request.id,
        integrationAccountId: signer.integrationAccountId,
        success: response.success,
        jir: response.jir,
      },
      "Fiscal request V2 completed"
    )

    if (response.success) {
      return {
        success: true,
        jir: response.jir,
        zki: response.zki || zki,
        responseXml: response.rawResponse,
        integrationAccountId: signer.integrationAccountId,
      }
    } else {
      throw {
        poreznaCode: response.errorCode,
        message: response.errorMessage || "Unknown error",
      }
    }
  } finally {
    // Security: Zero sensitive buffers
    if (p12Buffer) {
      randomFillSync(p12Buffer)
    }
  }
}

/**
 * V1 path: Execute fiscal request using legacy FiscalCertificate
 */
async function executeFiscalRequestV1(request: FiscalRequest): Promise<PipelineResult> {
  // 1. Load certificate
  if (!request.certificateId) {
    throw { poreznaCode: "p001", message: "Certificate ID not provided" }
  }

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

  // 2. Decrypt certificate and setup secure cleanup
  // Security: Use try-finally to ensure sensitive data is zeroed even on errors
  let p12Buffer: Buffer | null = null
  let credentials: { privateKeyPem: string; certificatePem: string } | null = null

  try {
    const decryptedPayload = decryptWithEnvelope(
      certificate.encryptedP12,
      certificate.encryptedDataKey
    )
    const { p12, password } = JSON.parse(decryptedPayload)

    // Security: Store in Buffer which can be securely zeroed
    p12Buffer = Buffer.from(p12, "base64")

    const parsedCert = await parseP12Certificate(p12Buffer, password)
    credentials = forgeToPem(parsedCert.privateKey, parsedCert.certificate)

    // Note: password string remains in memory (JS strings are immutable)
    // but we minimize its lifetime by scoping it to this block

    // 3. Load invoice data
    const invoice = await db.eInvoice.findUnique({
      where: { id: request.invoiceId! },
      include: {
        lines: true,
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
        credentials!.privateKeyPem,
        certificate.oibExtracted
      )
    } else {
      buildResult = buildRacunRequest(
        fiscalInvoice,
        credentials!.privateKeyPem,
        certificate.oibExtracted
      )
    }

    const { xml, zki, messageId } = buildResult

    // Store request XML
    await db.fiscalRequest.update({
      where: { id: request.id },
      data: { requestXml: xml, zki },
    })

    // Sign XML
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
  } finally {
    // Security: Zero sensitive buffers to prevent memory exposure
    // This ensures cleanup even if errors occur during processing
    if (p12Buffer) {
      randomFillSync(p12Buffer)
    }

    // Clear credentials reference (though strings can't be securely zeroed in JS)
    credentials = null
  }
}

interface InvoiceForFiscalization {
  invoiceNumber: string
  issueDate: Date
  totalAmount: number | string | { toString(): string }
  paymentMethod?: string | null
  operatorOib?: string | null
  lines: Array<{
    vatRate: number | string | { toString(): string }
    netAmount: number | string | { toString(): string }
    vatAmount: number | string | { toString(): string }
  }>
  company: {
    oib: string
    premisesCode?: string
    deviceCode?: string
    vatRegistered?: boolean
    // Allow additional DB fields
    [key: string]: unknown
  }
  // Allow additional DB fields from EInvoice model
  [key: string]: unknown
}

function mapToFiscalInvoice(invoice: InvoiceForFiscalization): FiscalInvoiceData {
  // Extract VAT breakdown from invoice lines
  const vatMap = new Map<string, { base: Prisma.Decimal; vat: Prisma.Decimal }>()

  for (const line of invoice.lines) {
    const rateKey =
      line.vatRate instanceof Decimal
        ? line.vatRate.toFixed(2)
        : new Decimal(String(line.vatRate)).toFixed(2)
    const existing = vatMap.get(rateKey) || { base: new Decimal(0), vat: new Decimal(0) }
    existing.base = existing.base.add(new Decimal(String(line.netAmount)))
    existing.vat = existing.vat.add(new Decimal(String(line.vatAmount)))
    vatMap.set(rateKey, existing)
  }

  const vatBreakdown = Array.from(vatMap.entries()).map(([rateKey, amounts]) => ({
    rate: Number(rateKey),
    baseAmount: amounts.base,
    vatAmount: amounts.vat,
  }))

  return {
    invoiceNumber: extractInvoiceNumber(invoice.invoiceNumber),
    premisesCode: invoice.company.premisesCode || "1",
    deviceCode: invoice.company.deviceCode || "1",
    issueDate: invoice.issueDate,
    totalAmount: new Decimal(String(invoice.totalAmount)),
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
