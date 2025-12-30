import { db } from "@/lib/db"

export interface RevenueRegisterEntryRecord {
  invoiceId: string
  issueDate: Date
  netAmount: number
  vatAmount: number
  totalAmount: number
  currency: string
}

export interface RevenueRegisterReport {
  companyId: string
  period: { from: Date; to: Date }
  entries: RevenueRegisterEntryRecord[]
}

export async function generateRevenueRegister(
  companyId: string,
  fromDate: Date,
  toDate: Date
): Promise<RevenueRegisterReport> {
  const entries = await db.revenueRegisterEntry.findMany({
    where: {
      companyId,
      issueDate: {
        gte: fromDate,
        lte: toDate,
      },
    },
    orderBy: { issueDate: "asc" },
  })

  return {
    companyId,
    period: { from: fromDate, to: toDate },
    entries: entries.map((entry) => ({
      invoiceId: entry.invoiceId,
      issueDate: entry.issueDate,
      netAmount: Number(entry.netAmount),
      vatAmount: Number(entry.vatAmount),
      totalAmount: Number(entry.totalAmount),
      currency: entry.currency,
    })),
  }
}
