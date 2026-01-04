"use server"

import { z } from "zod"
import { db } from "@/lib/db"
import { requireAuth, requireCompanyWithContext } from "@/lib/auth-utils"
import { getNextInvoiceNumber } from "@/lib/invoice-numbering"
import { canCreateInvoice } from "@/lib/billing/stripe"
import { Prisma, PaymentMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"
import type { ProcessPosSaleResult } from "@/types/pos"
import { fiscalizePosSale } from "@/lib/fiscal/pos-fiscalize"
import { recordRevenueRegisterEntry } from "@/lib/invoicing/events"
import { ensureOrganizationForContact } from "@/lib/master-data/contact-master-data"

const Decimal = Prisma.Decimal

// Zod schema for POS sale input validation
const posItemSchema = z.object({
  productId: z.string().optional(),
  description: z.string().min(1, "Opis je obavezan"),
  quantity: z.number().positive("Količina mora biti pozitivna"),
  unitPrice: z.number().min(0, "Cijena mora biti pozitivna ili nula"),
  vatRate: z.number().min(0).max(100),
})

const processPosSaleSchema = z.object({
  items: z.array(posItemSchema).min(1, "Račun mora imati barem jednu stavku"),
  paymentMethod: z.enum(["CASH", "CARD"]),
  buyerId: z.string().uuid().optional().nullable(),
  stripePaymentIntentId: z.string().optional(),
})

export async function processPosSale(input: unknown): Promise<ProcessPosSaleResult> {
  // Validate input
  const validated = processPosSaleSchema.safeParse(input)
  if (!validated.success) {
    return {
      success: false,
      error: validated.error.issues[0]?.message || "Neispravni podaci",
    }
  }
  const data = validated.data

  // Additional business logic validation
  if (data.paymentMethod === "CARD" && !data.stripePaymentIntentId) {
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
      const lineItems = data.items.map((item, index) => {
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

      const buyerOrganizationId = data.buyerId
        ? await ensureOrganizationForContact(company.id, data.buyerId)
        : null

      // Create invoice
      const invoice = await db.eInvoice.create({
        data: {
          companyId: company.id,
          type: "INVOICE",
          direction: "OUTBOUND",
          invoiceNumber: numbering.invoiceNumber,
          internalReference: numbering.internalReference,
          buyerId: data.buyerId || null,
          buyerOrganizationId,
          issueDate,
          currency: "EUR",
          netAmount,
          vatAmount,
          totalAmount,
          status: "PENDING_FISCALIZATION",
          paymentMethod: data.paymentMethod as PaymentMethod,
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
          totalAmount: invoice.totalAmount,
          paymentMethod: data.paymentMethod,
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
          paymentMethod: data.paymentMethod,
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
