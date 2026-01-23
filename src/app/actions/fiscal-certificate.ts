// src/app/actions/fiscal-certificate.ts
"use server"

import { z } from "zod"
import { revalidatePath } from "next/cache"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { encryptWithEnvelope } from "@/lib/fiscal/envelope-encryption"
import { parseP12Certificate, validateCertificate } from "@/lib/fiscal/certificate-parser"
import { buildFiscalRequestSnapshot } from "@/lib/fiscal/request-snapshot"
import type { UploadCertificateInput, CertificateInfo } from "./fiscal-certificate.types"

// Zod schemas for validation
const uploadCertificateSchema = z.object({
  p12Base64: z.string().min(1, "Certifikat je obavezan"),
  password: z.string().min(1, "Lozinka je obavezna"),
  environment: z.enum(["TEST", "PROD"]),
})

const environmentSchema = z.enum(["TEST", "PROD"])
const uuidSchema = z.string().uuid()

export async function validateCertificateAction(
  input: unknown
): Promise<{ success: true; info: CertificateInfo } | { success: false; error: string }> {
  try {
    const validated = uploadCertificateSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Neispravni podaci" }
    }
    const data = validated.data

    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const p12Buffer = Buffer.from(data.p12Base64, "base64")

    if (p12Buffer.length > 50 * 1024) {
      return { success: false, error: "Certificate file too large (max 50KB)" }
    }

    const certInfo = await parseP12Certificate(p12Buffer, data.password)

    const validation = validateCertificate(certInfo, data.environment)
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
  input: unknown
): Promise<{ success: true; certificateId: string } | { success: false; error: string }> {
  try {
    const validated = uploadCertificateSchema.safeParse(input)
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Neispravni podaci" }
    }
    const data = validated.data

    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const p12Buffer = Buffer.from(data.p12Base64, "base64")
    const certInfo = await parseP12Certificate(p12Buffer, data.password)

    const payload = JSON.stringify({
      p12: data.p12Base64,
      password: data.password,
    })
    const { encryptedData, encryptedDataKey } = encryptWithEnvelope(payload)

    const certificate = await db.fiscalCertificate.upsert({
      where: {
        companyId_environment: {
          companyId: company.id,
          environment: data.environment,
        },
      },
      create: {
        companyId: company.id,
        environment: data.environment,
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
          environment: data.environment,
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
  environment: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = environmentSchema.safeParse(environment)
    if (!validated.success) {
      return { success: false, error: "Neispravno okruženje" }
    }
    const validatedEnvironment = validated.data

    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const pendingRequests = await db.fiscalRequest.count({
      where: {
        companyId: company.id,
        certificate: { environment: validatedEnvironment },
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
          environment: validatedEnvironment,
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
          environment: validatedEnvironment,
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
  requestId: unknown
): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = uuidSchema.safeParse(requestId)
    if (!validated.success) {
      return { success: false, error: "Nevažeći ID zahtjeva" }
    }
    const validatedRequestId = validated.data

    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const request = await db.fiscalRequest.findFirst({
      where: { id: validatedRequestId, companyId: company.id },
    })

    if (!request) {
      return { success: false, error: "Request not found" }
    }

    if (!["FAILED", "DEAD"].includes(request.status)) {
      return { success: false, error: "Can only retry failed requests" }
    }

    await db.fiscalRequest.update({
      where: { id: validatedRequestId },
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
        entityId: validatedRequestId,
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
  invoiceId: unknown
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const validated = uuidSchema.safeParse(invoiceId)
    if (!validated.success) {
      return { success: false, error: "Nevažeći ID računa" }
    }
    const validatedInvoiceId = validated.data

    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    const invoice = await db.eInvoice.findFirst({
      where: { id: validatedInvoiceId, companyId: company.id },
    })

    if (!invoice) {
      return { success: false, error: "Invoice not found" }
    }

    if (invoice.jir) {
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
          invoiceId: validatedInvoiceId,
          messageType: "RACUN",
        },
      },
      create: {
        companyId: company.id,
        invoiceId: validatedInvoiceId,
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
      where: { id: validatedInvoiceId },
      data: { fiscalStatus: "PENDING" },
    })

    await db.auditLog.create({
      data: {
        companyId: company.id,
        userId: user.id!,
        action: "UPDATE",
        entity: "EInvoice",
        entityId: validatedInvoiceId,
        changes: {
          operation: "MANUAL_FISCALIZE",
          requestId: request.id,
        },
      },
    })

    revalidatePath(`/invoices/${validatedInvoiceId}`)
    return { success: true, requestId: request.id }
  } catch (error) {
    console.error("[fiscal-cert] manual fiscalize error:", error)
    return { success: false, error: "Failed to queue fiscalization" }
  }
}
