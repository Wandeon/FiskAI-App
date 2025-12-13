import { NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"

const bodySchema = z.object({
  transactionId: z.string().min(1),
  invoiceId: z.string().min(1),
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

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Neispravan zahtjev" }, { status: 400 })
  }

  const { transactionId, invoiceId } = parsed.data

  const transaction = await db.bankTransaction.findFirst({
    where: { id: transactionId, companyId: company.id },
  })

  if (!transaction) {
    return NextResponse.json({ error: "Transakcija nije pronađena" }, { status: 404 })
  }

  if (transaction.matchStatus !== "UNMATCHED" && transaction.matchStatus !== "IGNORED") {
    return NextResponse.json(
      { error: "Transakcija je već povezana" },
      { status: 400 }
    )
  }

  const invoice = await db.eInvoice.findFirst({
    where: { id: invoiceId, companyId: company.id },
  })

  if (!invoice) {
    return NextResponse.json({ error: "Račun nije pronađen" }, { status: 404 })
  }

  if (invoice.paidAt) {
    return NextResponse.json(
      { error: "Račun je već evidentiran kao plaćen" },
      { status: 400 }
    )
  }

  await db.bankTransaction.update({
    where: { id: transactionId },
    data: {
      matchedInvoiceId: invoice.id,
      matchStatus: "MANUAL_MATCHED",
      confidenceScore: 100,
      matchedAt: new Date(),
      matchedBy: user.id!,
    },
  })

  await db.eInvoice.update({
    where: { id: invoice.id },
    data: {
      paidAt: transaction.date,
      status: "ACCEPTED",
    },
  })

  revalidatePath("/banking")
  revalidatePath("/banking/transactions")
  revalidatePath("/banking/reconciliation")
  revalidatePath("/e-invoices")
  if (transaction.bankAccountId) {
    revalidatePath(`/banking/${transaction.bankAccountId}`)
  }
  revalidatePath(`/e-invoices/${invoice.id}`)

  return NextResponse.json({ success: true })
}
