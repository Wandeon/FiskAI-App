// src/lib/fiscal/fiscal-pipeline.ts
import { db } from "@/lib/db"
import { FiscalRequest } from "@prisma/client"
import { randomFillSync } from "crypto"
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

  // 2. Decrypt certificate and setup secure cleanup
  // Security: Use try-finally to ensure sensitive data is zeroed even on errors
  let p12Buffer: Buffer | null = null
  let credentials: { privateKeyPem: string; certPem: string } | null = null

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

function mapToFiscalInvoice(invoice: any): FiscalInvoiceData {
  // Extract VAT breakdown from invoice lines
  const vatMap = new Map<number, { base: number; vat: number }>()

  for (const line of invoice.lines) {
    const rate = Number(line.vatRate)
    const existing = vatMap.get(rate) || { base: 0, vat: 0 }
    existing.base += Number(line.netAmount)
    existing.vat += Number(line.vatAmount)
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
