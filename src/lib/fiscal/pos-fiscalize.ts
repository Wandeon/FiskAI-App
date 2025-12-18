import { calculateZKI, validateZKIInput } from "@/lib/e-invoice/zki"
import { db } from "@/lib/db"
import { executeFiscalRequest } from "./fiscal-pipeline"
import { FiscalRequestStatus, FiscalRequestMessageType } from "@prisma/client"

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
    // No certificate - queue for retry, but return success with ZKI only
    await queueFiscalRetry(invoice.id)
    return {
      success: true,
      zki,
      error: "Fiskalizacija u čekanju - nema aktivnog certifikata",
    }
  }

  // Real fiscalization - create fiscal request and execute
  try {
    // Create fiscal request record
    const fiscalRequest = await db.fiscalRequest.create({
      data: {
        companyId: company.id,
        invoiceId: invoice.id,
        certificateId: certificate.id,
        messageType: "RACUN" as FiscalRequestMessageType,
        status: "PROCESSING" as FiscalRequestStatus,
        attemptCount: 1,
        lastAttemptAt: new Date(),
      },
    })

    // Execute fiscalization
    const result = await executeFiscalRequest(fiscalRequest)

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
  } catch (error: any) {
    console.error("POS fiscalization error:", error)

    // Queue for retry if it's a temporary failure
    if (error?.poreznaCode !== "p001" && error?.poreznaCode !== "p002") {
      await queueFiscalRetry(invoice.id)
    }

    return {
      success: false,
      zki,
      error: error?.message || "Greška kod fiskalizacije",
    }
  }
}

async function queueFiscalRetry(invoiceId: string): Promise<void> {
  // Update invoice to mark it needs fiscalization retry
  await db.eInvoice.update({
    where: { id: invoiceId },
    data: {
      fiscalStatus: "PENDING",
    },
  })
}
