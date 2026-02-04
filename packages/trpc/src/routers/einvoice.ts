import { z } from "zod"
import { router, protectedProcedure } from "../trpc"
import { eInvoiceLineSchema, eurosToCents, formatInvoiceNumber } from "@fiskai/shared"
import { EPoslovanjeProvider } from "../lib/einvoice/eposlovanje"
import { generateUBLInvoice } from "../lib/einvoice/ubl-generator"
import { decryptSecret } from "../lib/crypto"

// Input schema for createDraft - we define it here to avoid ZodEffects merge issues
const createDraftInputSchema = z.object({
  companyId: z.string().cuid(),
  businessPremisesId: z.string().cuid(),
  paymentDeviceId: z.string().cuid(),
  contactId: z.string().min(1, "Kupac je obavezan"),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  buyerReference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
  lines: z.array(eInvoiceLineSchema).min(1, "Potrebna je najmanje jedna stavka"),
}).refine((data) => {
  if (data.dueDate && data.issueDate) {
    return data.dueDate >= data.issueDate
  }
  return true
}, {
  message: "Datum dospijeća mora biti nakon datuma izdavanja",
  path: ["dueDate"],
})

type CreateDraftInput = z.infer<typeof createDraftInputSchema>

export const eInvoiceRouter = router({
  // Get company info for invoice preview (seller info)
  getCompanyInfo: protectedProcedure
    .input(z.object({
      companyId: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const company = await ctx.db.company.findFirst({
        where: {
          id: input.companyId,
          members: {
            some: { userId: ctx.userId },
          },
        },
        include: {
          businessPremises: {
            where: { isActive: true },
            include: {
              paymentDevices: {
                where: { isActive: true },
              },
            },
          },
        },
      })

      if (!company) {
        throw new Error("UNAUTHORIZED")
      }

      return company
    }),

  // Get buyer (contact) by ID
  getBuyerById: protectedProcedure
    .input(z.object({
      companyId: z.string().cuid(),
      contactId: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to company
      const company = await ctx.db.company.findFirst({
        where: {
          id: input.companyId,
          members: {
            some: { userId: ctx.userId },
          },
        },
      })

      if (!company) {
        throw new Error("UNAUTHORIZED")
      }

      const contact = await ctx.db.contact.findFirst({
        where: {
          id: input.contactId,
          companyId: input.companyId,
        },
      })

      if (!contact) {
        throw new Error("Contact not found")
      }

      return contact
    }),

  // Get contacts that can be buyers (CUSTOMER or BOTH)
  getBuyers: protectedProcedure
    .input(z.object({
      companyId: z.string().cuid(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to company
      const company = await ctx.db.company.findFirst({
        where: {
          id: input.companyId,
          members: {
            some: { userId: ctx.userId },
          },
        },
      })

      if (!company) {
        throw new Error("UNAUTHORIZED")
      }

      return ctx.db.contact.findMany({
        where: {
          companyId: input.companyId,
          type: { in: ["CUSTOMER", "BOTH"] },
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { oib: { contains: input.search } },
              { email: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        orderBy: { name: "asc" },
        take: 50,
      })
    }),

  // Get active products for line item suggestions
  getProducts: protectedProcedure
    .input(z.object({
      companyId: z.string().cuid(),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Verify user has access to company
      const company = await ctx.db.company.findFirst({
        where: {
          id: input.companyId,
          members: {
            some: { userId: ctx.userId },
          },
        },
      })

      if (!company) {
        throw new Error("UNAUTHORIZED")
      }

      return ctx.db.product.findMany({
        where: {
          companyId: input.companyId,
          isActive: true,
          ...(input.search && {
            OR: [
              { name: { contains: input.search, mode: "insensitive" } },
              { description: { contains: input.search, mode: "insensitive" } },
              { sku: { contains: input.search, mode: "insensitive" } },
            ],
          }),
        },
        orderBy: { name: "asc" },
        take: 50,
      })
    }),

  // Create a draft e-invoice with lines
  createDraft: protectedProcedure
    .input(createDraftInputSchema)
    .mutation(async ({ ctx, input }) => {
      const { companyId, businessPremisesId, paymentDeviceId, lines, ...invoiceData } = input as CreateDraftInput

      // Verify user has access to company
      const company = await ctx.db.company.findFirst({
        where: {
          id: companyId,
          members: {
            some: { userId: ctx.userId },
          },
        },
      })

      if (!company) {
        throw new Error("UNAUTHORIZED")
      }

      // Get business premises and payment device codes
      const premises = await ctx.db.businessPremises.findUnique({
        where: { id: businessPremisesId },
      })
      const device = await ctx.db.paymentDevice.findUnique({
        where: { id: paymentDeviceId },
      })

      if (!premises || !device) {
        throw new Error("Invalid business premises or payment device")
      }

      // Get or create invoice sequence
      const year = invoiceData.issueDate.getFullYear()
      const sequence = await ctx.db.invoiceSequence.upsert({
        where: {
          companyId_businessPremisesId_paymentDeviceId_year: {
            companyId,
            businessPremisesId,
            paymentDeviceId,
            year,
          },
        },
        create: {
          companyId,
          businessPremisesId,
          paymentDeviceId,
          year,
          lastNumber: 1,
        },
        update: {
          lastNumber: { increment: 1 },
        },
      })

      const invoiceNumber = sequence.lastNumber
      const invoiceNumberFull = formatInvoiceNumber(
        invoiceNumber,
        premises.code,
        device.code
      )

      // Calculate line totals (convert EUR to cents)
      let subtotalCents = 0
      let vatAmountCents = 0

      const processedLines = lines.map((line, index) => {
        // Convert unitPrice from EUR to cents
        const unitPriceCents = eurosToCents(line.unitPrice)
        // quantity is already a number (e.g., 2.5)
        const lineTotal = Math.round(line.quantity * unitPriceCents)
        const lineVat = Math.round(lineTotal * (line.vatRate / 100))

        subtotalCents += lineTotal
        vatAmountCents += lineVat

        return {
          description: line.description,
          quantity: Math.round(line.quantity * 100), // Store as integer * 100 for precision
          unitPrice: unitPriceCents,
          vatRate: line.vatRate,
          unit: line.unit,
          vatCategory: line.vatCategory,
          lineTotalCents: lineTotal,
          vatAmountCents: lineVat,
          sortOrder: index,
        }
      })

      const totalCents = subtotalCents + vatAmountCents

      // Create invoice with lines
      return ctx.db.invoice.create({
        data: {
          companyId,
          businessPremisesId,
          paymentDeviceId,
          contactId: invoiceData.contactId,
          invoiceNumber,
          invoiceNumberFull,
          year,
          status: "DRAFT",
          issueDate: invoiceData.issueDate,
          dueDate: invoiceData.dueDate,
          buyerReference: invoiceData.buyerReference,
          notes: invoiceData.notes,
          subtotalCents,
          vatAmountCents,
          totalCents,
          lines: {
            create: processedLines,
          },
        },
        include: {
          contact: true,
          businessPremises: true,
          paymentDevice: true,
          lines: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    }),

  // Get invoice by ID with all relations
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          company: {
            members: {
              some: { userId: ctx.userId },
            },
          },
        },
        include: {
          company: true,
          contact: true,
          businessPremises: true,
          paymentDevice: true,
          lines: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })

      if (!invoice) {
        throw new Error("Invoice not found")
      }

      return invoice
    }),

  // Send invoice via e-Poslovanje
  send: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      // Get invoice with company details
      const invoice = await ctx.db.invoice.findFirst({
        where: {
          id: input.id,
          company: {
            members: {
              some: { userId: ctx.userId },
            },
          },
        },
        include: {
          company: true,
          contact: true,
          lines: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })

      if (!invoice) {
        throw new Error("Invoice not found")
      }

      // Verify invoice can be sent
      if (invoice.status !== "DRAFT" && invoice.status !== "ISSUED") {
        throw new Error("Invoice must be in DRAFT or ISSUED status to send")
      }

      // Check if contact has OIB (required for e-invoice in Croatia)
      if (!invoice.contact?.oib) {
        throw new Error("Contact must have OIB to receive e-invoice")
      }

      // Check if company has e-invoice enabled
      if (!invoice.company.eInvoiceEnabled) {
        throw new Error("E-invoice is not enabled for this company")
      }

      // Check if company has e-invoice provider configured
      if (!invoice.company.eInvoiceProvider) {
        throw new Error("E-invoice provider is not configured")
      }

      // Check if company has encrypted API key
      if (!invoice.company.eInvoiceApiKeyEncrypted) {
        throw new Error("E-invoice API key is not configured")
      }

      // Generate UBL XML document
      const ublXml = generateUBLInvoice(invoice)

      // Decrypt the API key
      const apiKey = decryptSecret(invoice.company.eInvoiceApiKeyEncrypted)

      // Create provider and send
      const provider = new EPoslovanjeProvider({ apiKey })
      const result = await provider.sendDocument(ublXml)

      // Update invoice with provider response
      return ctx.db.invoice.update({
        where: { id: input.id },
        data: {
          status: "SENT",
          eInvoiceId: `EINV-${invoice.invoiceNumberFull}`,
          eInvoiceSentAt: new Date(),
          eInvoiceStatus: "SENT",
          eInvoiceProviderRef: String(result.id),
          eInvoiceProviderData: {
            providerId: result.id,
            insertedOn: result.insertedOn,
            message: result.message,
          },
        },
        include: {
          contact: true,
          businessPremises: true,
          paymentDevice: true,
          lines: {
            orderBy: { sortOrder: "asc" },
          },
        },
      })
    }),
})
