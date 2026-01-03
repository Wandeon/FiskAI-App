import { db } from "@/lib/db"
import { renderToBuffer } from "@react-pdf/renderer"
import { InvoicePDFDocument } from "@/lib/pdf/invoice-template"
import { generateInvoiceBarcodeDataUrl } from "@/lib/barcode"
import { generateFiscalQRCode } from "@/lib/fiscal/qr-generator"
import { Prisma } from "@prisma/client"

export interface GenerateInvoicePDFOptions {
  invoiceId: string
  companyId: string
  deterministicSeed?: string
}

export interface GenerateInvoicePDFResult {
  buffer: Buffer
  invoiceNumber: string
}

/**
 * Generate PDF buffer for an invoice.
 * Shared between API route and server actions to avoid loopback HTTP calls.
 */
export async function generateInvoicePDF({
  invoiceId,
  companyId,
  deterministicSeed,
}: GenerateInvoicePDFOptions): Promise<GenerateInvoicePDFResult> {
  const Decimal = Prisma.Decimal
  const deterministicMode = process.env.DETERMINISTIC_MODE === "true" || Boolean(deterministicSeed)

  // Fetch invoice with all related data
  const invoice = await db.eInvoice.findFirst({
    where: {
      id: invoiceId,
      companyId,
    },
    include: {
      buyer: true,
      seller: true,
      company: true,
      lines: {
        orderBy: { lineNumber: "asc" },
      },
    },
  })

  if (!invoice) {
    throw new Error("Invoice not found")
  }

  const company = invoice.company

  // Use company as seller if seller contact is not set
  const sellerData = invoice.seller || {
    name: company.name,
    oib: company.oib,
    address: company.address,
    city: company.city,
    postalCode: company.postalCode,
    country: company.country,
    email: company.email,
    phone: company.phone,
  }

  const bankAccount = invoice.bankAccount || company.iban || undefined

  // Prepare data for PDF template
  const pdfData = {
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      currency: invoice.currency,
      netAmount: new Decimal(invoice.netAmount).toFixed(2),
      vatAmount: new Decimal(invoice.vatAmount).toFixed(2),
      totalAmount: new Decimal(invoice.totalAmount).toFixed(2),
      notes: invoice.notes,
      jir: invoice.jir,
      zki: invoice.zki,
      type: invoice.type,
      status: invoice.status,
      includeBarcode: invoice.includeBarcode ?? true,
    },
    seller: {
      name: sellerData.name,
      oib: sellerData.oib || company.oib,
      address: sellerData.address || company.address,
      city: sellerData.city || company.city,
      postalCode: sellerData.postalCode || company.postalCode,
      country: sellerData.country || company.country,
      email: sellerData.email || company.email,
      phone: sellerData.phone || company.phone,
      iban: company.iban,
    },
    buyer: invoice.buyer
      ? {
          name: invoice.buyer.name,
          oib: invoice.buyer.oib,
          vatNumber: invoice.buyer.vatNumber,
          address: invoice.buyer.address,
          city: invoice.buyer.city,
          postalCode: invoice.buyer.postalCode,
          country: invoice.buyer.country,
        }
      : null,
    lines: invoice.lines.map((line) => ({
      lineNumber: line.lineNumber,
      description: line.description,
      quantity: new Decimal(line.quantity).toFixed(3),
      unit: line.unit,
      unitPrice: new Decimal(line.unitPrice).toFixed(2),
      netAmount: new Decimal(line.netAmount).toFixed(2),
      vatRate: new Decimal(line.vatRate).toFixed(2),
      vatAmount: new Decimal(line.vatAmount).toFixed(2),
    })),
    bankAccount,
  }

  let barcodeDataUrl: string | null = null
  if (pdfData.invoice.includeBarcode && bankAccount) {
    barcodeDataUrl = await generateInvoiceBarcodeDataUrl({
      creditorName: pdfData.seller.name,
      creditorIban: bankAccount,
      amount: pdfData.invoice.totalAmount,
      currency: pdfData.invoice.currency,
      invoiceNumber: pdfData.invoice.invoiceNumber,
      dueDate: pdfData.invoice.dueDate || undefined,
      reference: pdfData.invoice.invoiceNumber,
    })
  }

  // Generate fiscal QR code if invoice is fiscalized
  let fiscalQRDataUrl: string | null = null
  if (pdfData.invoice.jir && pdfData.invoice.zki) {
    fiscalQRDataUrl = await generateFiscalQRCode({
      jir: pdfData.invoice.jir,
      zki: pdfData.invoice.zki,
      invoiceNumber: pdfData.invoice.invoiceNumber,
      issuerOib: pdfData.seller.oib,
      amount: pdfData.invoice.totalAmount,
      dateTime: pdfData.invoice.issueDate,
    })
  }

  // Generate PDF
  const doc = InvoicePDFDocument({ ...pdfData, barcodeDataUrl, fiscalQRDataUrl })

  // Deterministic mode: only override Math.random for predictable internal IDs.
  // We do NOT override Date because global mutation is unsafe in async contexts.
  // PDF metadata (CreationDate, ModDate) will vary - golden tests should compare
  // visual content or use PDF parsing, not byte-for-byte comparison.
  const pdfBuffer = await (async () => {
    if (!deterministicMode) {
      return renderToBuffer(doc)
    }

    const seedMaterial = deterministicSeed ?? `${companyId}:${invoiceId}`
    const seedBytes = Buffer.from(seedMaterial, "utf8")
    const seed = seedBytes.reduce((acc, b) => (acc * 31 + b) >>> 0, 0x811c9dc5) >>> 0

    const realRandom = Math.random

    function xorshift32(state: number) {
      let x = state >>> 0
      x ^= x << 13
      x ^= x >>> 17
      x ^= x << 5
      return x >>> 0
    }

    let rngState = seed || 1

    try {
      // Only override Math.random for deterministic internal IDs.
      // This is safe because Math.random is synchronous and stateless.
      Math.random = () => {
        rngState = xorshift32(rngState)
        return rngState / 0x100000000
      }

      return renderToBuffer(doc)
    } finally {
      Math.random = realRandom
    }
  })()

  return {
    buffer: Buffer.from(pdfBuffer),
    invoiceNumber: invoice.invoiceNumber,
  }
}
