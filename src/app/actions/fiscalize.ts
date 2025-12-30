"use server"

import { db } from "@/lib/db"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { getFiscalProvider, calculateZKI, validateZKIInput } from "@/lib/e-invoice"
import type { FiscalInvoice, PaymentMethodCode } from "@/lib/e-invoice"
import { revalidatePath } from "next/cache"
import { validateTransition } from "@/lib/invoice-status-validation"
import { validateStatusTransition, getTransitionError } from "@/lib/e-invoice-status"

/**
 * Fiscalize an invoice with Croatian Tax Authority (CIS)
 *
 * This action:
 * 1. Validates the invoice is ready for fiscalization
 * 2. Calculates ZKI (Zaštitni Kod Izdavatelja)
 * 3. Sends to fiscalization provider
 * 4. Updates invoice with JIR and ZKI
 */
export async function fiscalizeInvoice(invoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  try {
    // Get invoice with all required data
    const invoice = await db.eInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: company.id,
      },
      include: {
        company: true,
        lines: true,
        buyer: true,
      },
    })

    if (!invoice) {
      return { success: false, error: "Račun nije pronađen" }
    }

    // Check if already fiscalized
    if (invoice.status === "FISCALIZED" || invoice.jir) {
      return { success: false, error: "Račun je već fiskaliziran" }
    }

    // Validate status transition
    const transitionValidation = validateTransition(invoice.status, "FISCALIZED")
    if (!transitionValidation.valid) {
      return { success: false, error: transitionValidation.error }
    }

    // Check if invoice has required data
    if (!invoice.invoiceNumber) {
      return { success: false, error: "Račun nema broj računa" }
    }

    if (!invoice.lines || invoice.lines.length === 0) {
      return { success: false, error: "Račun mora imati barem jednu stavku" }
    }

    // Get default business premises and device
    // In production, these should be configurable per invoice
    const premises = await db.businessPremises.findFirst({
      where: {
        companyId: company.id,
        isDefault: true,
        isActive: true,
      },
    })

    if (!premises) {
      return {
        success: false,
        error: "Nije konfiguriran poslovni prostor. Molimo konfigurirajte u postavkama.",
      }
    }

    const device = await db.paymentDevice.findFirst({
      where: {
        businessPremisesId: premises.id,
        isDefault: true,
        isActive: true,
      },
    })

    if (!device) {
      return {
        success: false,
        error: "Nije konfiguriran naplatni uređaj. Molimo konfigurirajte u postavkama.",
      }
    }

    // Convert total to cents for ZKI calculation
    const totalInCents = Number(invoice.totalAmount) * 100

    // Prepare ZKI input
    const zkiInput = {
      oib: company.oib,
      dateTime: invoice.issueDate,
      invoiceNumber: invoice.invoiceNumber,
      premisesCode: premises.code.toString(),
      deviceCode: device.code.toString(),
      totalAmount: Math.round(totalInCents),
    }

    // Validate ZKI input
    const validation = validateZKIInput(zkiInput)
    if (!validation.valid) {
      return {
        success: false,
        error: `Nevažeći podaci za fiskalizaciju: ${validation.errors.join(", ")}`,
      }
    }

    // Calculate ZKI
    // TODO: In production, pass private key from secure storage
    const zki = calculateZKI(zkiInput)

    // Group VAT amounts by rate
    const vatByRate = invoice.lines.reduce(
      (acc, line) => {
        const rate = Number(line.vatRate)
        const amount = Number(line.vatAmount)

        if (rate === 25) acc.vat25 += amount
        else if (rate === 13) acc.vat13 += amount
        else if (rate === 5) acc.vat5 += amount
        else if (rate === 0) acc.vat0 += amount

        return acc
      },
      { vat25: 0, vat13: 0, vat5: 0, vat0: 0 }
    )

    // Prepare fiscal invoice
    const fiscalInvoice: FiscalInvoice = {
      invoiceNumber: invoice.invoiceNumber,
      zki,
      dateTime: invoice.issueDate,
      company: {
        oib: company.oib,
        name: company.name,
        address: company.address || "",
      },
      premisesCode: premises.code.toString(),
      deviceCode: device.code.toString(),
      items: invoice.lines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        vatRate: Number(line.vatRate),
        total: Number(line.netAmount) + Number(line.vatAmount),
      })),
      totals: {
        net: Number(invoice.netAmount),
        vat25: vatByRate.vat25,
        vat13: vatByRate.vat13,
        vat5: vatByRate.vat5,
        vat0: vatByRate.vat0,
        total: Number(invoice.totalAmount),
      },
      paymentMethod: determinePaymentMethod(invoice),
    }

    // Get fiscal provider
    const provider = getFiscalProvider()

    // Send to fiscalization
    const result = await provider.send(fiscalInvoice)

    if (!result.success) {
      // Update invoice status to error
      await db.eInvoice.update({
        where: { id: invoiceId },
        data: {
          status: "ERROR",
          providerError: result.error,
        },
      })

      return {
        success: false,
        error: result.error || "Greška pri fiskalizaciji",
      }
    }

    // Update invoice with fiscalization data
    await db.eInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "FISCALIZED",
        jir: result.jir,
        zki,
        fiscalizedAt: new Date(),
        providerError: null, // Clear any previous errors
      },
    })

    revalidatePath("/e-invoices")
    revalidatePath(`/e-invoices/${invoiceId}`)

    return {
      success: true,
      jir: result.jir,
      zki,
    }
  } catch (error) {
    console.error("Fiscalization error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Nepoznata greška pri fiskalizaciji",
    }
  }
}

/**
 * Check fiscalization status
 */
export async function checkFiscalStatus(invoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  try {
    const invoice = await db.eInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: company.id,
      },
      select: {
        id: true,
        jir: true,
        zki: true,
        status: true,
        fiscalizedAt: true,
      },
    })

    if (!invoice) {
      return { success: false, error: "Račun nije pronađen" }
    }

    if (!invoice.jir) {
      return { success: false, error: "Račun nije fiskaliziran" }
    }

    // Validate status transition
    const transitionValidation = validateTransition(invoice.status, "REJECTED")
    if (!transitionValidation.valid) {
      return { success: false, error: transitionValidation.error }
    }

    const provider = getFiscalProvider()
    const status = await provider.getStatus(invoice.jir)

    return {
      success: true,
      status: status.status,
      jir: invoice.jir,
      zki: invoice.zki,
      fiscalizedAt: invoice.fiscalizedAt,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Greška pri provjeri statusa",
    }
  }
}

/**
 * Cancel fiscalized invoice
 * NOTE: This is typically not allowed in Croatian system.
 * Instead, you should issue a credit note.
 */
export async function cancelFiscalizedInvoice(invoiceId: string) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  try {
    const invoice = await db.eInvoice.findFirst({
      where: {
        id: invoiceId,
        companyId: company.id,
      },
      select: {
        id: true,
        jir: true,
        status: true,
      },
    })

    if (!invoice) {
      return { success: false, error: "Račun nije pronađen" }
    }

    if (!invoice.jir) {
      return { success: false, error: "Račun nije fiskaliziran" }
    }

    // Validate status transition
    const transitionValidation = validateTransition(invoice.status, "REJECTED")
    if (!transitionValidation.valid) {
      return { success: false, error: transitionValidation.error }
    }

    const provider = getFiscalProvider()
    const result = await provider.cancel(invoice.jir)

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Greška pri storniranju",
      }
    }

    // Update invoice status
    await db.eInvoice.update({
      where: { id: invoiceId },
      data: {
        status: "REJECTED", // or create a CANCELLED status
      },
    })

    revalidatePath("/e-invoices")
    revalidatePath(`/e-invoices/${invoiceId}`)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Greška pri storniranju",
    }
  }
}

/**
 * Determine payment method from invoice data
 * This is a simple implementation - in production you'd have this as a field
 */
function determinePaymentMethod(invoice: { dueDate?: Date | null }): PaymentMethodCode {
  // If due date is in future, assume bank transfer
  if (invoice.dueDate && invoice.dueDate > new Date()) {
    return "T" // Transakcija (Bank Transfer)
  }

  // Default to bank transfer for B2B
  return "T"
}
