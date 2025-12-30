"use server"

import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { canCreateInvoice } from "@/lib/billing/stripe"
import { Prisma, PaymentMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"
import type { ProcessPosSaleInput, ProcessPosSaleResult } from "@/types/pos"
import { fiscalizePosSale } from "@/lib/fiscal/pos-fiscalize"
import { recordRevenueRegisterEntry } from "@/lib/invoicing/events"

const Decimal = Prisma.Decimal

export async function processPosSale(input: ProcessPosSaleInput): Promise<ProcessPosSaleResult> {
  // Validation - do this BEFORE auth to allow testing
  if (!input.items || input.items.length === 0) {
    return { success: false, error: "Račun mora imati barem jednu stavku" }
  }

  if (input.paymentMethod === "CARD" && !input.stripePaymentIntentId) {
    return { success: false, error: "Payment Intent ID je obavezan za kartično plaćanje" }
  }

  try {
    const user = await requireAuth()

    return requireCompanyWithContext(user.id!, async (company) => {
      // Check invoice limit
      const canCreate = await canCreateInvoice(company.id)
      if (!canCreate) {
        return { success: false, error: "Dostigli ste mjesečni limit računa" }
      }

      // Get business premises and device
      const premises = await db.businessPremises.findFirst({
        where: { companyId: company.id, isDefault: true, isActive: true },
      })
      if (!premises) {
        return { success: false, error: "Nije konfiguriran poslovni prostor" }
      }

      const device = await db.paymentDevice.findFirst({
        where: { businessPremisesId: premises.id, isDefault: true, isActive: true },
      })
      if (!device) {
        return { success: false, error: "Nije konfiguriran naplatni uređaj" }
      }

      // Generate invoice number
      const issueDate = new Date()
      const numbering = await getNextInvoiceNumber(company.id, undefined, undefined, issueDate)

      // Calculate line items
      const lineItems = input.items.map((item, index) => {
        const quantity = new Decimal(item.quantity)
        const unitPrice = new Decimal(item.unitPrice)
        const vatRate = new Decimal(item.vatRate)
        const netAmount = quantity.mul(unitPrice)
        const vatAmount = netAmount.mul(vatRate).div(100)

        return {
          lineNumber: index + 1,
          description: item.description,
          quantity,
          unit: "C62", // Piece
          unitPrice,
          netAmount,
          vatRate,
          vatCategory: "S",
          vatAmount,
        }
      })

      // Calculate totals
      const netAmount = lineItems.reduce((sum, l) => sum.add(l.netAmount), new Decimal(0))
      const vatAmount = lineItems.reduce((sum, l) => sum.add(l.vatAmount), new Decimal(0))
      const totalAmount = netAmount.add(vatAmount)

      // Create invoice
      const invoice = await db.eInvoice.create({
        data: {
          companyId: company.id,
          type: "INVOICE",
          direction: "OUTBOUND",
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: input.buyerId || null,
          issueDate,
          currency: "EUR",
          netAmount,
          vatAmount,
          totalAmount,
          status: "PENDING_FISCALIZATION",
          paymentMethod: input.paymentMethod as PaymentMethod,
          lines: { create: lineItems },
        },
        include: { lines: true },
      })

      // Fiscalize the invoice
      const fiscalResult = await fiscalizePosSale({
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.issueDate,
          totalAmount: Number(invoice.totalAmount),
          paymentMethod: input.paymentMethod,
        },
        company: {
          id: company.id,
          oib: company.oib,
          fiscalEnabled: company.fiscalEnabled,
          premisesCode: premises.code.toString(),
          deviceCode: device.code.toString(),
        },
      })

      // Update invoice with fiscal data
      if (fiscalResult.success) {
        await db.eInvoice.update({
          where: { id: invoice.id },
          data: {
            zki: fiscalResult.zki,
            jir: fiscalResult.jir,
            fiscalizedAt: fiscalResult.jir ? new Date() : null,
            status: fiscalResult.jir ? "FISCALIZED" : "PENDING_FISCALIZATION",
          },
        })

        if (fiscalResult.jir) {
          await recordRevenueRegisterEntry(invoice.id)
        }
      } else {
        console.error("Fiscalization warning:", fiscalResult.error)
        revalidatePath("/invoices")
        revalidatePath("/pos")
        return {
          success: false,
          error: fiscalResult.error || "Greška pri fiskalizaciji računa",
        }
      }

      revalidatePath("/invoices")
      revalidatePath("/pos")

      return {
        success: true,
        invoice: {
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
          issueDate: invoice.issueDate.toISOString(),
          paymentMethod: input.paymentMethod,
          items: invoice.lines.map((line) => ({
            description: line.description,
            quantity: Number(line.quantity),
            unitPrice: Number(line.unitPrice),
            totalPrice: Number(line.netAmount),
            vatRate: Number(line.vatRate),
          })),
        },
        issuerOib: company.oib,
        jir: fiscalResult.jir,
        zki: fiscalResult.zki,
        pdfUrl: `/api/invoices/${invoice.id}/pdf`,
      }
    })
  } catch (error) {
    console.error("POS sale error:", error)
    return { success: false, error: "Greška pri obradi prodaje" }
  }
}
