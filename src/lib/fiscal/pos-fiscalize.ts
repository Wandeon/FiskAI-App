import { calculateZKI, validateZKIInput } from "@/lib/e-invoice/zki"
import { db } from "@/lib/db"
import { executeFiscalRequest } from "./fiscal-pipeline"
import { FiscalStatus, FiscalMessageType } from "@prisma/client"
import { buildFiscalRequestSnapshot } from "@/lib/fiscal/request-snapshot"
import { buildFiscalResponseCreateInput } from "@/lib/fiscal/response-builder"

const FORCE_DEMO_MODE = process.env.FISCAL_DEMO_MODE === "true"

export interface PosFiscalInput {
  invoice: {
    id: string
    invoiceNumber: string
    issueDate: Date
    totalAmount: number
    paymentMethod: "CASH" | "CARD"
  }
  company: {
    id: string
    oib: string
    fiscalEnabled: boolean
    premisesCode: string
    deviceCode: string
  }
}

export interface PosFiscalResult {
  success: boolean
  jir?: string
  zki: string
  error?: string
}

export async function fiscalizePosSale(input: PosFiscalInput): Promise<PosFiscalResult> {
  const { invoice, company } = input

  // Calculate ZKI (always required)
  const totalInCents = Math.round(invoice.totalAmount * 100)

  const zkiInput = {
    oib: company.oib,
    dateTime: invoice.issueDate,
    invoiceNumber: invoice.invoiceNumber,
    premisesCode: company.premisesCode,
    deviceCode: company.deviceCode,
    totalAmount: totalInCents,
  }

  const validation = validateZKIInput(zkiInput)
  if (!validation.valid) {
    return {
      success: false,
      zki: "",
      error: `Nevažeći podaci: ${validation.errors.join(", ")}`,
    }
  }

  const zki = calculateZKI(zkiInput)

  // Check if real fiscalization is enabled
  // Demo mode if: explicitly disabled, or FISCAL_DEMO_MODE env is set
  if (!company.fiscalEnabled || FORCE_DEMO_MODE) {
    // Demo mode - return mock JIR
    const demoJir = `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Still update invoice with demo data for testing
    await db.eInvoice.update({
      where: { id: invoice.id },
      data: {
        zki,
        jir: demoJir,
        fiscalStatus: "FISCALIZED",
        fiscalizedAt: new Date(),
      },
    })

    return {
      success: true,
      jir: demoJir,
      zki,
    }
  }

  // Real fiscalization - check for active certificate
  const certificate = await db.fiscalCertificate.findFirst({
    where: {
      companyId: company.id,
      status: "ACTIVE",
    },
  })

  if (!certificate) {
    return {
      success: false,
      zki,
      error: "Fiskalizacija nije moguća - nema aktivnog certifikata",
    }
  }

  // Real fiscalization - create fiscal request and execute
  try {
    const snapshot = buildFiscalRequestSnapshot({
      invoice,
      company,
      certificate,
    })

    // Create fiscal request record
    const fiscalRequest = await db.fiscalRequest.create({
      data: {
        companyId: company.id,
        invoiceId: invoice.id,
        certificateId: certificate.id,
        messageType: "RACUN" as FiscalMessageType,
        status: "PROCESSING" as FiscalStatus,
        attemptCount: 1,
        ...snapshot,
      },
    })

    // Execute fiscalization
    const result = await executeFiscalRequest(fiscalRequest)

    await db.fiscalResponse.create({
      data: buildFiscalResponseCreateInput(fiscalRequest, {
        status: result.success ? "SUCCESS" : "FAILED",
        attemptNumber: 1,
        jir: result.jir,
        zki: result.zki || zki,
        responseXml: result.responseXml,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      }),
    })

    // Update request with result
    await db.fiscalRequest.update({
      where: { id: fiscalRequest.id },
      data: {
        status: result.success ? "COMPLETED" : "FAILED",
        jir: result.jir,
        zki: result.zki || zki,
        responseXml: result.responseXml,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        attemptCount: 1,
      },
    })

    // Update invoice with JIR
    if (result.success && result.jir) {
      await db.eInvoice.update({
        where: { id: invoice.id },
        data: {
          jir: result.jir,
          zki: result.zki || zki,
          fiscalStatus: "FISCALIZED",
          fiscalizedAt: new Date(),
        },
      })
    }

    return {
      success: result.success,
      jir: result.jir,
      zki: result.zki || zki,
      error: result.errorMessage,
    }
  } catch (error: unknown) {
    console.error("POS fiscalization error:", error)

    // Type guard for error objects with poreznaCode property
    const shouldRetry =
      typeof error === "object" &&
      error !== null &&
      "poreznaCode" in error &&
      (error as { poreznaCode: string }).poreznaCode !== "p001" &&
      (error as { poreznaCode: string }).poreznaCode !== "p002"

    const errorMessage = error instanceof Error ? error.message : "Greška kod fiskalizacije"

    if (shouldRetry) {
      const request = await db.fiscalRequest.findFirst({
        where: { invoiceId: invoice.id, messageType: "RACUN" },
        orderBy: { createdAt: "desc" },
      })

      if (request) {
        await db.fiscalResponse.create({
          data: buildFiscalResponseCreateInput(request, {
            status: "FAILED",
            attemptNumber: request.attemptCount + 1,
            zki,
            errorMessage,
          }),
        })

        await db.fiscalRequest.update({
          where: { id: request.id },
          data: {
            status: "FAILED",
            errorMessage,
            attemptCount: request.attemptCount + 1,
          },
        })
      }
    }

    return {
      success: false,
      zki,
      error: errorMessage,
    }
  }
}
