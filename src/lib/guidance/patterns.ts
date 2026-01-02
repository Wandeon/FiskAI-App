// src/lib/guidance/patterns.ts
import { db } from "@/lib/db"
import { startOfMonth, subMonths, format } from "date-fns"

export interface PatternInsight {
  type: "invoice_reminder" | "expense_pattern" | "revenue_trend" | "compliance_risk"
  title: string
  description: string
  confidence: number // 0-100
  data?: Record<string, unknown>
  suggestedAction?: {
    label: string
    href: string
  }
}

/**
 * Detect recurring invoice patterns
 * "You usually invoice Client X around this time"
 */
export async function detectInvoicePatterns(companyId: string): Promise<PatternInsight[]> {
  const insights: PatternInsight[] = []
  const now = new Date()
  const currentDayOfMonth = now.getDate()

  // Get invoices from last 6 months
  const sixMonthsAgo = subMonths(now, 6)
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      direction: "OUTBOUND",
      status: { not: "DRAFT" },
      issueDate: { gte: sixMonthsAgo },
    },
    include: { buyer: true },
    orderBy: { issueDate: "desc" },
  })

  // Group by buyer
  const buyerInvoices = new Map<string, typeof invoices>()
  for (const inv of invoices) {
    if (!inv.buyerId) continue
    const list = buyerInvoices.get(inv.buyerId) || []
    list.push(inv)
    buyerInvoices.set(inv.buyerId, list)
  }

  // Check for monthly patterns per buyer
  for (const [buyerId, invList] of buyerInvoices) {
    if (invList.length < 3) continue // Need at least 3 data points

    // Analyze issue day patterns
    const issueDays = invList.map((i) => new Date(i.issueDate).getDate())
    const avgDay = Math.round(issueDays.reduce((a, b) => a + b, 0) / issueDays.length)
    const dayVariance = Math.sqrt(
      issueDays.reduce((sum, d) => sum + Math.pow(d - avgDay, 2), 0) / issueDays.length
    )

    // If variance is low (<5 days) and we're near that time, suggest
    if (dayVariance < 5 && Math.abs(currentDayOfMonth - avgDay) <= 3) {
      const buyer = invList[0].buyer
      const avgAmount = invList.reduce((s, i) => s + Number(i.totalAmount), 0) / invList.length

      // Check if already invoiced this month
      const thisMonthInvoice = invList.find(
        (i) => new Date(i.issueDate).getMonth() === now.getMonth()
      )

      if (!thisMonthInvoice) {
        insights.push({
          type: "invoice_reminder",
          title: `Mjesečni račun za ${buyer?.name || "klijenta"}`,
          description: `Obično fakturirate ovom klijentu oko ${avgDay}. dana u mjesecu (prosječno ${avgAmount.toFixed(0)} EUR)`,
          confidence: Math.round(100 - dayVariance * 10),
          data: { buyerId, buyerName: buyer?.name, avgDay, avgAmount },
          suggestedAction: {
            label: "Izradi račun",
            href: `/invoices/new?buyerId=${buyerId}`,
          },
        })
      }
    }
  }

  return insights
}

/**
 * Detect expense patterns
 * "Your office supplies expenses are higher than usual"
 */
export async function detectExpensePatterns(companyId: string): Promise<PatternInsight[]> {
  const insights: PatternInsight[] = []
  const now = new Date()
  const thisMonth = startOfMonth(now)
  const threeMonthsAgo = subMonths(thisMonth, 3)

  // Get expenses by category for comparison
  const expenses = await db.expense.findMany({
    where: {
      companyId,
      date: { gte: threeMonthsAgo },
      status: { not: "CANCELLED" },
    },
    include: { category: true },
  })

  // Group by category and month
  const categoryMonthly = new Map<string, Map<string, number>>()
  for (const exp of expenses) {
    if (!exp.categoryId) continue
    const monthKey = format(new Date(exp.date), "yyyy-MM")
    const catMap = categoryMonthly.get(exp.categoryId) || new Map()
    catMap.set(monthKey, (catMap.get(monthKey) || 0) + Number((exp as unknown as Record<string, unknown>).totalAmount || 0))
    categoryMonthly.set(exp.categoryId, catMap)
  }

  // Check for anomalies
  const thisMonthKey = format(thisMonth, "yyyy-MM")

  for (const [categoryId, monthMap] of categoryMonthly) {
    const thisMonthAmount = monthMap.get(thisMonthKey) || 0

    // Calculate average of past months (excluding current month)
    const pastMonths = Array.from(monthMap.entries())
      .filter(([k]) => k !== thisMonthKey)
      .map(([, v]) => v)

    if (pastMonths.length < 2) continue

    const avgAmount = pastMonths.reduce((a, b) => a + b, 0) / pastMonths.length

    // Alert if current month is 50%+ higher than average
    if (thisMonthAmount > avgAmount * 1.5 && thisMonthAmount > 100) {
      const category = expenses.find((e) => e.categoryId === categoryId)?.category
      const percentIncrease = Math.round(((thisMonthAmount - avgAmount) / avgAmount) * 100)

      insights.push({
        type: "expense_pattern",
        title: `Povećani troškovi: ${category?.name || "Kategorija"}`,
        description: `Ovaj mjesec ste potrošili ${percentIncrease}% više nego inače (${thisMonthAmount.toFixed(0)} vs prosjek ${avgAmount.toFixed(0)} EUR)`,
        confidence: Math.min(90, 60 + pastMonths.length * 10),
        data: { categoryId, thisMonthAmount, avgAmount, percentIncrease },
        suggestedAction: {
          label: "Pregledaj troškove",
          href: `/expenses?category=${categoryId}`,
        },
      })
    }
  }

  return insights
}

/**
 * Detect revenue trends
 * "Your revenue is down 20% compared to last quarter"
 */
export async function detectRevenueTrends(companyId: string): Promise<PatternInsight[]> {
  const insights: PatternInsight[] = []
  const now = new Date()
  const thisMonth = startOfMonth(now)
  const sixMonthsAgo = subMonths(thisMonth, 6)

  // Get monthly revenue
  const invoices = await db.eInvoice.findMany({
    where: {
      companyId,
      direction: "OUTBOUND",
      status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      issueDate: { gte: sixMonthsAgo },
    },
  })

  // Group by month
  const monthlyRevenue = new Map<string, number>()
  for (const inv of invoices) {
    const monthKey = format(new Date(inv.issueDate), "yyyy-MM")
    monthlyRevenue.set(monthKey, (monthlyRevenue.get(monthKey) || 0) + Number(inv.totalAmount))
  }

  // Get last 3 complete months (excluding current)
  const months = Array.from(monthlyRevenue.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4, -1)

  if (months.length >= 3) {
    const [oldest, middle, recent] = months.map(([, v]) => v)
    const avgPast = (oldest + middle) / 2
    const trend = avgPast > 0 ? ((recent - avgPast) / avgPast) * 100 : 0

    if (trend < -15) {
      insights.push({
        type: "revenue_trend",
        title: "Prihodi u padu",
        description: `Prihodi su pali ${Math.abs(Math.round(trend))}% u odnosu na prethodna 2 mjeseca`,
        confidence: 75,
        data: { trend, recent, avgPast },
        suggestedAction: {
          label: "Pogledaj izvještaje",
          href: "/reports/revenue",
        },
      })
    } else if (trend > 20) {
      insights.push({
        type: "revenue_trend",
        title: "Prihodi rastu!",
        description: `Odlično! Prihodi su porasli ${Math.round(trend)}% u odnosu na prethodna 2 mjeseca`,
        confidence: 75,
        data: { trend, recent, avgPast },
      })
    }
  }

  return insights
}

/**
 * Get all pattern insights for a company
 */
export async function getAllPatternInsights(companyId: string): Promise<PatternInsight[]> {
  const [invoicePatterns, expensePatterns, revenueTrends] = await Promise.all([
    detectInvoicePatterns(companyId),
    detectExpensePatterns(companyId),
    detectRevenueTrends(companyId),
  ])

  return [...invoicePatterns, ...expensePatterns, ...revenueTrends]
    .filter((i) => i.confidence >= 60) // Only show confident insights
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5) // Max 5 insights
}
