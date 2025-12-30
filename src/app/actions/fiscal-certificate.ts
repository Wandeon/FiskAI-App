// src/app/actions/fiscal-certificate.ts
"use server"

import { revalidatePath } from "next/cache"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { encryptWithEnvelope } from "@/lib/fiscal/envelope-encryption"
import { parseP12Certificate, validateCertificate } from "@/lib/fiscal/certificate-parser"
import { buildFiscalRequestSnapshot } from "@/lib/fiscal/request-snapshot"

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
        action: "CREATE",
        entity: "FiscalCertificate",
        entityId: certificate.id,
        changes: {
          operation: "CERTIFICATE_UPLOADED",
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
        action: "DELETE",
        entity: "FiscalCertificate",
        entityId: "deleted",
        changes: {
          operation: "CERTIFICATE_DELETED",
          environment,
        },
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
        action: "UPDATE",
        entity: "FiscalRequest",
        entityId: requestId,
        changes: {
          operation: "REQUEST_RETRY",
        },
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

    const invoice = await db.eInvoice.findFirst({
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

    const snapshot = buildFiscalRequestSnapshot({
      invoice,
      company,
      certificate,
    })

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
        ...snapshot,
      },
      update: {
        status: "QUEUED",
        attemptCount: 0,
        nextRetryAt: new Date(),
        errorCode: null,
        errorMessage: null,
        ...snapshot,
      },
    })

    await db.eInvoice.update({
      where: { id: invoiceId },
      data: { fiscalStatus: "PENDING" },
    })

    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id!,
        action: "UPDATE",
        entity: "EInvoice",
        entityId: invoiceId,
        changes: {
          operation: "MANUAL_FISCALIZE",
          requestId: request.id,
        },
      },
    })

    revalidatePath(`/invoices/${invoiceId}`)
    return { success: true, requestId: request.id }
  } catch (error) {
    console.error("[fiscal-cert] manual fiscalize error:", error)
    return { success: false, error: "Failed to queue fiscalization" }
  }
}
