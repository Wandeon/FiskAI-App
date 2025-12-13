// src/app/api/e-invoices/receive/route.ts
// API endpoint for receiving e-invoices from external systems

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth, requireCompany } from "@/lib/auth-utils";
import { IncomingInvoice } from "@/lib/e-invoice/types";
import { logger } from "@/lib/logger";

const incomingInvoiceSchema = z.object({
  invoiceNumber: z.string(),
  issueDate: z.string(), // ISO date string
  dueDate: z.string().optional(), // ISO date string
  currency: z.string().default("EUR"),
  buyer: z.object({
    name: z.string(),
    oib: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }),
  seller: z.object({
    name: z.string(),
    oib: z.string().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }),
  lines: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unit: z.string().optional().default("C62"),
    unitPrice: z.number(),
    netAmount: z.number(),
    vatRate: z.number().min(0).max(100).optional().default(25),
    vatCategory: z.string().optional().default("S"),
    vatAmount: z.number(),
  })),
  netAmount: z.number(),
  vatAmount: z.number(),
  totalAmount: z.number(),
  providerRef: z.string().optional(), // Reference from e-invoice provider
  xmlData: z.string().optional(), // Original XML data
  direction: z.enum(["INBOUND", "OUTBOUND"]).default("INBOUND"),
  type: z.enum(["INVOICE", "E_INVOICE", "QUOTE", "PROFORMA", "CREDIT_NOTE", "DEBIT_NOTE"]).default("INVOICE"),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    const company = await requireCompany(user.id!);

    const body = await request.json();
    const parsed = incomingInvoiceSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn({
        userId: user.id,
        companyId: company.id,
        validationErrors: parsed.error.issues,
        operation: "incoming_invoice_validation_failed"
      }, "Incoming invoice validation failed");

      return NextResponse.json(
        { 
          error: "Invalid invoice data", 
          details: parsed.error.issues
        }, 
        { status: 400 }
      );
    }

    const invoiceData = parsed.data;

    // Check if invoice already exists (prevent duplicates)
    if (invoiceData.providerRef) {
      const existing = await db.eInvoice.findFirst({
        where: {
          providerRef: invoiceData.providerRef,
          companyId: company.id,
        }
      });

      if (existing) {
        logger.warn({
          userId: user.id,
          companyId: company.id,
          providerRef: invoiceData.providerRef,
          operation: "duplicate_invoice_received"
        }, "Duplicate incoming invoice received");

        return NextResponse.json(
          { 
            error: "Invoice already exists", 
            invoiceId: existing.id 
          }, 
          { status: 409 }
        );
      }
    }

    // Create or find buyer contact
    let buyerContact = null;
    if (invoiceData.buyer?.oib) {
      buyerContact = await db.contact.findFirst({
        where: {
          oib: invoiceData.buyer.oib,
          companyId: company.id,
        }
      });

      if (!buyerContact) {
        // Create new buyer contact
        buyerContact = await db.contact.create({
          data: {
            companyId: company.id,
            type: "SUPPLIER",
            name: invoiceData.buyer.name,
            oib: invoiceData.buyer.oib,
            address: invoiceData.buyer.address,
            city: invoiceData.buyer.city,
            postalCode: invoiceData.buyer.postalCode,
            country: invoiceData.buyer.country,
          }
        });
      }
    }

    // Create the incoming e-invoice
    const incomingInvoice = await db.eInvoice.create({
      data: {
        companyId: company.id,
        direction: invoiceData.direction,
        type: invoiceData.type,
        internalReference: generateInternalReference(invoiceData.invoiceNumber, invoiceData.issueDate),
        notes: `Primljeni e-račun iz vanjskog sustava. Provider ref: ${invoiceData.providerRef || 'N/A'}`,
        buyerId: buyerContact?.id,
        
        // Invoice data
        invoiceNumber: invoiceData.invoiceNumber,
        issueDate: new Date(invoiceData.issueDate),
        dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : undefined,
        currency: invoiceData.currency,
        bankAccount: company.iban || undefined,
        
        // Amounts
        netAmount: invoiceData.netAmount,
        vatAmount: invoiceData.vatAmount,
        totalAmount: invoiceData.totalAmount,
        
        // Status - set to "DELIVERED" since it's received
        status: "DELIVERED",
        
        // Provider info
        providerRef: invoiceData.providerRef,
        providerStatus: "RECEIVED",
        providerError: null,
        
        // XML data if provided
        ...(invoiceData.xmlData && { ublXml: invoiceData.xmlData }),
        
        // Create invoice lines
        lines: {
          create: invoiceData.lines.map((line, index) => ({
            lineNumber: index + 1,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitPrice: line.unitPrice,
            netAmount: line.netAmount,
            vatRate: line.vatRate,
            vatCategory: line.vatCategory,
            vatAmount: line.vatAmount,
          }))
        }
      },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        buyer: true,
      }
    });

    logger.info({
      userId: user.id,
      companyId: company.id,
      invoiceId: incomingInvoice.id,
      invoiceNumber: incomingInvoice.invoiceNumber,
      providerRef: invoiceData.providerRef,
      operation: "incoming_invoice_created"
    }, "Incoming e-invoice created successfully");

    return NextResponse.json({
      success: true,
      invoice: incomingInvoice,
      message: "E-invoice received and processed successfully"
    });

  } catch (error) {
    logger.error({ error }, "Failed to process incoming e-invoice");

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Failed to process incoming e-invoice", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process incoming e-invoice" },
      { status: 500 }
    );
  }
}

// Helper function to generate internal reference
function generateInternalReference(invoiceNumber: string, issueDate: string): string {
  const date = new Date(issueDate);
  const year = date.getFullYear();
  return `${year}/${invoiceNumber}`;
}

// GET endpoint to list received invoices
export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const company = await requireCompany(user.id!);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const provider = searchParams.get("provider");

    const whereClause: any = {
      companyId: company.id,
      direction: "INBOUND", // Only inbound (received) invoices
    };

    if (status) {
      whereClause.status = status;
    }

    if (fromDate) {
      whereClause.issueDate = { ...whereClause.issueDate, gte: new Date(fromDate) };
    }

    if (toDate) {
      whereClause.issueDate = { ...whereClause.issueDate, lte: new Date(toDate) };
    }

    if (provider) {
      whereClause.providerRef = { contains: provider };
    }

    const receivedInvoices = await db.eInvoice.findMany({
      where: whereClause,
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        buyer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info({
      userId: user.id,
      companyId: company.id,
      count: receivedInvoices.length,
      operation: "received_invoices_fetched"
    }, "Received e-invoices fetched successfully");

    return NextResponse.json({
      invoices: receivedInvoices,
      count: receivedInvoices.length
    });

  } catch (error) {
    logger.error({ error }, "Failed to fetch received e-invoices");

    return NextResponse.json(
      { error: "Failed to fetch received e-invoices" },
      { status: 500 }
    );
  }
}