import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { ensureOrganizationForContact } from "@/lib/master-data/contact-master-data"
import { revalidatePath } from "next/cache"
import { MatchKind, MatchSource, MatchStatus } from "@prisma/client"
import { setTenantContext } from "@/lib/prisma-extensions"
import { getIpFromHeaders, getUserAgentFromHeaders, logAudit } from "@/lib/audit"

const bodySchema = z
  .object({
    transactionId: z.string().min(1),
    invoiceId: z.string().min(1).optional(),
    expenseId: z.string().min(1).optional(),
  })
  .refine((data) => data.invoiceId || data.expenseId, {
    message: "Either invoiceId or expenseId must be provided",
  })

export async function POST(request: Request) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const company = await requireCompany(user.id!)
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 })
  }

  setTenantContext({
    companyId: company.id,
    userId: user.id!,
  })

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan zahtjev" }, { status: 400 })
  }

  const { transactionId, invoiceId, expenseId } = parsed.data

  const transaction = await db.bankTransaction.findFirst({
    where: { id: transactionId, companyId: company.id },
    include: {
      matchRecords: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!transaction) {
    return NextResponse.json({ error: "Transakcija nije pronađena" }, { status: 404 })
  }

  const latestMatch = transaction.matchRecords[0]
  if (
    latestMatch &&
    latestMatch.matchStatus !== MatchStatus.UNMATCHED &&
    latestMatch.matchStatus !== MatchStatus.IGNORED
  ) {
    return NextResponse.json({ error: "Transakcija je već povezana" }, { status: 400 })
  }

  if (invoiceId) {
    const invoice = await db.eInvoice.findFirst({
      where: { id: invoiceId, companyId: company.id },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Račun nije pronađen" }, { status: 404 })
    }

    if (invoice.paidAt) {
      return NextResponse.json({ error: "Račun je već evidentiran kao plaćen" }, { status: 400 })
    }

    let counterpartyOrganizationId: string | null =
      invoice.direction === "OUTBOUND"
        ? (invoice.buyerOrganizationId ?? null)
        : (invoice.sellerOrganizationId ?? null)

    if (!counterpartyOrganizationId) {
      const contactId = invoice.direction === "OUTBOUND" ? invoice.buyerId : invoice.sellerId
      if (contactId) {
        counterpartyOrganizationId = await ensureOrganizationForContact(company.id, contactId)
      }
    }

    await db.matchRecord.create({
      data: {
        companyId: company.id,
        bankTransactionId: transactionId,
        matchStatus: MatchStatus.MANUAL_MATCHED,
        matchKind: MatchKind.INVOICE,
        matchedInvoiceId: invoice.id,
        confidenceScore: 100,
        reason: "Manual match",
        source: MatchSource.MANUAL,
        createdBy: user.id!,
      },
    })

    const beforeMatch = latestMatch
      ? {
          matchStatus: latestMatch.matchStatus,
          matchKind: latestMatch.matchKind,
          matchedInvoiceId: latestMatch.matchedInvoiceId,
          matchedExpenseId: latestMatch.matchedExpenseId,
        }
      : { matchStatus: MatchStatus.UNMATCHED }

    await logAudit({
      companyId: company.id,
      userId: user.id!,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: transactionId,
      reason: "bank_match_invoice",
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
      changes: {
        before: beforeMatch,
        after: {
          matchStatus: MatchStatus.MANUAL_MATCHED,
          matchKind: MatchKind.INVOICE,
          matchedInvoiceId: invoice.id,
          matchedExpenseId: null,
        },
      },
    })

    await db.eInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAt: transaction.date,
        status: "ACCEPTED",
      },
    })

    if (counterpartyOrganizationId) {
      await db.bankTransaction.update({
        where: { id: transaction.id },
        data: { counterpartyOrganizationId },
      })
    }

    revalidatePath("/banking")
    revalidatePath("/banking/transactions")
    revalidatePath("/banking/reconciliation")
    revalidatePath("/e-invoices")
    if (transaction.bankAccountId) {
      revalidatePath(`/banking/${transaction.bankAccountId}`)
    }
    revalidatePath(`/e-invoices/${invoice.id}`)

    return NextResponse.json({ success: true, matchType: "invoice" })
  }

  if (expenseId) {
    const expense = await db.expense.findFirst({
      where: { id: expenseId, companyId: company.id },
    })

    if (!expense) {
      return NextResponse.json({ error: "Trošak nije pronađen" }, { status: 404 })
    }

    if (expense.status === "PAID") {
      return NextResponse.json({ error: "Trošak je već evidentiran kao plaćen" }, { status: 400 })
    }

    let counterpartyOrganizationId: string | null = expense.vendorOrganizationId ?? null
    if (!counterpartyOrganizationId && expense.vendorId) {
      counterpartyOrganizationId = await ensureOrganizationForContact(company.id, expense.vendorId)
    }

    await db.matchRecord.create({
      data: {
        companyId: company.id,
        bankTransactionId: transactionId,
        matchStatus: MatchStatus.MANUAL_MATCHED,
        matchKind: MatchKind.EXPENSE,
        matchedExpenseId: expense.id,
        confidenceScore: 100,
        reason: "Manual match",
        source: MatchSource.MANUAL,
        createdBy: user.id!,
      },
    })

    const beforeMatch = latestMatch
      ? {
          matchStatus: latestMatch.matchStatus,
          matchKind: latestMatch.matchKind,
          matchedInvoiceId: latestMatch.matchedInvoiceId,
          matchedExpenseId: latestMatch.matchedExpenseId,
        }
      : { matchStatus: MatchStatus.UNMATCHED }

    await logAudit({
      companyId: company.id,
      userId: user.id!,
      action: "UPDATE",
      entity: "BankTransaction",
      entityId: transactionId,
      reason: "bank_match_expense",
      ipAddress: getIpFromHeaders(request.headers),
      userAgent: getUserAgentFromHeaders(request.headers),
      changes: {
        before: beforeMatch,
        after: {
          matchStatus: MatchStatus.MANUAL_MATCHED,
          matchKind: MatchKind.EXPENSE,
          matchedInvoiceId: null,
          matchedExpenseId: expense.id,
        },
      },
    })

    await db.expense.update({
      where: { id: expense.id },
      data: {
        paymentDate: transaction.date,
        status: "PAID",
        paymentMethod: "TRANSFER",
      },
    })

    if (counterpartyOrganizationId) {
      await db.bankTransaction.update({
        where: { id: transaction.id },
        data: { counterpartyOrganizationId },
      })
    }

    revalidatePath("/banking")
    revalidatePath("/banking/transactions")
    revalidatePath("/banking/reconciliation")
    revalidatePath("/expenses")
    if (transaction.bankAccountId) {
      revalidatePath(`/banking/${transaction.bankAccountId}`)
    }
    revalidatePath(`/expenses/${expense.id}`)

    return NextResponse.json({ success: true, matchType: "expense" })
  }

  return NextResponse.json({ error: "Neispravan zahtjev" }, { status: 400 })
}
