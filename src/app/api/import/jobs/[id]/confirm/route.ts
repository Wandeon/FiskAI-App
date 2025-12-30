import { NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { setTenantContext } from "@/lib/prisma-extensions"
import { ensureOrganizationForContact } from "@/lib/master-data/contact-master-data"
import { ImportFormat, Prisma } from "@prisma/client"

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)
  const { id } = await params
  const body = await request.json()

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const job = await db.importJob.findUnique({ where: { id } })

  if (!job || job.companyId !== company.id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  if (job.status !== "READY_FOR_REVIEW") {
    return NextResponse.json({ error: "Job not ready for confirmation" }, { status: 400 })
  }

  if (job.documentType === "BANK_STATEMENT") {
    // Handle bank statement confirmation
    const { transactions, bankAccountId } = body

    if (!bankAccountId) {
      return NextResponse.json({ error: "Bank account required" }, { status: 400 })
    }

    const existingImport = await db.statementImport.findFirst({
      where: { importJobId: job.id },
    })

    const extension = job.originalName.split(".").pop()?.toLowerCase() || ""
    const format =
      extension === "xml"
        ? ImportFormat.XML_CAMT053
        : extension === "csv"
          ? ImportFormat.CSV
          : ImportFormat.PDF

    const statementImport =
      existingImport ??
      (await db.statementImport.create({
        data: {
          companyId: company.id,
          bankAccountId,
          importJobId: job.id,
          fileName: job.originalName,
          fileChecksum: job.fileChecksum,
          format,
          transactionCount: transactions?.length || 0,
          importedBy: user.id!,
        },
      }))

    // Write transactions to database
    if (transactions && transactions.length > 0) {
      await db.bankTransaction.createMany({
        data: transactions.map((t: any) => ({
          companyId: company.id,
          bankAccountId,
          statementImportId: statementImport.id,
          date: new Date(t.date),
          description: t.description || "",
          amount: new Prisma.Decimal(Math.abs(t.amount)),
          balance: new Prisma.Decimal(0),
          reference: t.reference || null,
          counterpartyName: t.counterpartyName || null,
          counterpartyIban: t.counterpartyIban || null,
          matchStatus: "UNMATCHED",
          confidenceScore: 0,
        })),
      })
    }

    // Update job status
    await db.importJob.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        bankAccountId,
      },
    })

    return NextResponse.json({
      success: true,
      transactionCount: transactions?.length || 0,
    })
  } else if (job.documentType === "INVOICE") {
    // Handle invoice confirmation - store as Expense
    const { vendor, invoice, lineItems, subtotal, taxAmount, totalAmount, currency, payment } = body

    // Find or create vendor as a Contact
    let vendorContact = null
    if (vendor?.oib) {
      vendorContact = await db.contact.findFirst({
        where: { companyId: company.id, oib: vendor.oib },
      })
    }

    if (!vendorContact && vendor?.name) {
      vendorContact = await db.contact.create({
        data: {
          companyId: company.id,
          type: "SUPPLIER",
          name: vendor.name,
          oib: vendor.oib || null,
          address: vendor.address || null,
        },
      })
    }

    // Find or create default expense category for imported invoices
    let category = await db.expenseCategory.findFirst({
      where: { companyId: company.id, code: "IMPORTED" },
    })

    if (!category) {
      category = await db.expenseCategory.create({
        data: {
          companyId: company.id,
          name: "Uvezeni računi",
          code: "IMPORTED",
          vatDeductibleDefault: true,
        },
      })
    }

    // Build description from line items
    const lineItemsDesc = (lineItems || [])
      .map((item: any) => item.description)
      .filter(Boolean)
      .join(", ")
    const description =
      lineItemsDesc ||
      `Račun ${invoice?.number || "N/A"} - ${vendor?.name || "Nepoznati dobavljač"}`

    const vendorOrganizationId = vendorContact?.id
      ? await ensureOrganizationForContact(company.id, vendorContact.id)
      : null

    // Create the Expense record
    const expense = await db.expense.create({
      data: {
        companyId: company.id,
        vendorId: vendorContact?.id || null,
        vendorOrganizationId,
        categoryId: category.id,
        description,
        date: invoice?.issueDate ? new Date(invoice.issueDate) : new Date(),
        dueDate: invoice?.dueDate ? new Date(invoice.dueDate) : null,
        netAmount: new Prisma.Decimal(subtotal || 0),
        vatAmount: new Prisma.Decimal(taxAmount || 0),
        totalAmount: new Prisma.Decimal(totalAmount || 0),
        vatDeductible: true,
        currency: currency || "EUR",
        status: "PENDING",
        receiptUrl: job.storagePath, // Link to the uploaded document
        notes: JSON.stringify({
          invoiceNumber: invoice?.number,
          vendorIban: payment?.iban || vendor?.iban,
          paymentModel: payment?.model,
          paymentReference: payment?.reference,
          lineItems: lineItems || [],
        }),
      },
    })

    // Update job status
    await db.importJob.update({
      where: { id },
      data: { status: "CONFIRMED" },
    })

    return NextResponse.json({
      success: true,
      expenseId: expense.id,
      invoiceNumber: invoice?.number || "N/A",
    })
  } else if (job.documentType === "PRIMKA" || job.documentType === "IZDATNICA") {
    const source = body && Array.isArray(body.items) ? body : (job.extractedData ?? {})
    const { warehouseId, items, referenceNumber, movementDate } = source as {
      warehouseId?: string
      items?: Array<{ productId: string; quantity: number | string; unitCost?: number | string }>
      referenceNumber?: string
      movementDate?: string
    }

    if (!warehouseId) {
      return NextResponse.json({ error: "Warehouse is required" }, { status: 400 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Stock items are required" }, { status: 400 })
    }

    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: company.id },
    })

    if (!warehouse) {
      return NextResponse.json({ error: "Warehouse not found" }, { status: 404 })
    }

    const companyRecord = await db.company.findUnique({
      where: { id: company.id },
      select: { stockValuationMethod: true },
    })

    const valuationMethod = companyRecord?.stockValuationMethod ?? "WEIGHTED_AVERAGE"
    const movementTimestamp = movementDate ? new Date(movementDate) : new Date()
    if (Number.isNaN(movementTimestamp.getTime())) {
      return NextResponse.json({ error: "Invalid movement date" }, { status: 400 })
    }
    const movementType = job.documentType

    await db.$transaction(async (tx) => {
      for (const item of items) {
        if (!item.productId) {
          throw new Error("Product is required for stock movement")
        }

        const quantity = new Prisma.Decimal(item.quantity ?? 0)
        if (quantity.lte(0)) {
          throw new Error("Quantity must be greater than 0")
        }

        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId: company.id },
        })

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`)
        }

        const stockItem = await tx.stockItem.upsert({
          where: {
            warehouseId_productId: {
              warehouseId,
              productId: item.productId,
            },
          },
          create: {
            companyId: company.id,
            warehouseId,
            productId: item.productId,
            quantityOnHand: new Prisma.Decimal(0),
          },
          update: {},
        })

        const delta = movementType === "PRIMKA" ? quantity : quantity.mul(-1)
        const nextQuantity = new Prisma.Decimal(stockItem.quantityOnHand).add(delta)

        if (nextQuantity.lt(0)) {
          throw new Error(`Insufficient stock for product ${product.name}`)
        }

        const unitCost = item.unitCost !== undefined ? new Prisma.Decimal(item.unitCost) : null
        let nextAverageCost = stockItem.averageCost

        if (valuationMethod === "WEIGHTED_AVERAGE" && unitCost && delta.gt(0)) {
          const currentQty = new Prisma.Decimal(stockItem.quantityOnHand)
          const currentValue = stockItem.averageCost
            ? currentQty.mul(stockItem.averageCost)
            : new Prisma.Decimal(0)
          const incomingValue = quantity.mul(unitCost)
          const totalQty = currentQty.add(quantity)
          nextAverageCost = totalQty.eq(0)
            ? unitCost
            : currentValue.add(incomingValue).div(totalQty)
        }

        await tx.stockMovement.create({
          data: {
            companyId: company.id,
            warehouseId,
            productId: item.productId,
            stockItemId: stockItem.id,
            movementType,
            quantity,
            unitCost,
            movementDate: movementTimestamp,
            referenceNumber: referenceNumber || job.originalName,
          },
        })

        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantityOnHand: nextQuantity,
            averageCost: nextAverageCost,
            lastMovementAt: movementTimestamp,
          },
        })
      }
    })

    await db.importJob.update({
      where: { id },
      data: { status: "CONFIRMED" },
    })

    return NextResponse.json({
      success: true,
      movementCount: items.length,
    })
  }

  // Unknown document type
  return NextResponse.json({ error: "Unknown document type" }, { status: 400 })
}
