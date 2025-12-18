# Phase 5: Intelligence - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add smart suggestions engine with pattern detection and AI-powered insights to the checklist system.

**Prerequisites:** Phase 1-4 complete (schema, API, UI, notifications)

**Existing Infrastructure:**

- AI: OpenAI (GPT-4o) for extraction, DeepSeek for summaries
- Patterns: Invoice/expense history, audit logs, bank transactions
- Feedback: `AIFeedback` table for accuracy tracking
- Rate limiting: Plan-based quotas in `src/lib/ai/rate-limiter.ts`

---

## Task 5.1: Create Pattern Detection Service

**Files:**

- Create: `src/lib/guidance/patterns.ts`

**Purpose:** Analyze user activity to detect patterns for smart suggestions.

```typescript
// src/lib/guidance/patterns.ts
import { db } from "@/lib/db"
import { startOfMonth, subMonths, format, getDay } from "date-fns"

export interface PatternInsight {
  type: "invoice_reminder" | "expense_pattern" | "revenue_trend" | "compliance_risk"
  title: string
  description: string
  confidence: number // 0-100
  data?: Record<string, any>
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
  const lastMonth = subMonths(thisMonth, 1)
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
    catMap.set(monthKey, (catMap.get(monthKey) || 0) + Number(exp.amount))
    categoryMonthly.set(exp.categoryId, catMap)
  }

  // Check for anomalies
  const thisMonthKey = format(thisMonth, "yyyy-MM")
  const lastMonthKey = format(lastMonth, "yyyy-MM")

  for (const [categoryId, monthMap] of categoryMonthly) {
    const thisMonthAmount = monthMap.get(thisMonthKey) || 0
    const lastMonthAmount = monthMap.get(lastMonthKey) || 0

    // Calculate 3-month average (excluding current month)
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

  // Get monthly revenue for last 6 months
  const sixMonthsAgo = subMonths(thisMonth, 6)
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

  // Get last 3 complete months
  const months = Array.from(monthlyRevenue.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-4, -1) // Exclude current month

  if (months.length >= 3) {
    const [oldest, middle, recent] = months.map(([, v]) => v)
    const avgPast = (oldest + middle) / 2
    const trend = ((recent - avgPast) / avgPast) * 100

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
```

**Commit:**

```bash
git add src/lib/guidance/
git commit -m "feat(guidance): add pattern detection service for smart suggestions"
```

---

## Task 5.2: Integrate Patterns into Checklist

**Files:**

- Modify: `src/lib/guidance/checklist.ts`

**Step 1: Import pattern detection**

```typescript
import { getAllPatternInsights, type PatternInsight } from "./patterns"
```

**Step 2: Add pattern insights to getChecklistItems**

In the `getChecklistItems` function, add a new section for pattern-based suggestions:

```typescript
// After existing checklist item generation, before returning

// Add smart suggestions from pattern detection
try {
  const patterns = await getAllPatternInsights(companyId)

  for (const pattern of patterns) {
    items.push({
      id: `pattern-${pattern.type}-${Date.now()}`,
      category: pattern.type === "invoice_reminder" ? "fakturiranje" : "financije",
      type: "suggestion",
      title: pattern.title,
      description: pattern.description,
      urgency: pattern.confidence >= 80 ? "upcoming" : "optional",
      action: pattern.suggestedAction
        ? {
            type: "link",
            href: pattern.suggestedAction.href,
          }
        : undefined,
    })
  }
} catch (error) {
  console.error("Failed to get pattern insights:", error)
}
```

**Commit:**

```bash
git add src/lib/guidance/checklist.ts
git commit -m "feat(guidance): integrate pattern detection into checklist"
```

---

## Task 5.3: Create Insights Dashboard Widget

**Files:**

- Create: `src/components/guidance/InsightsWidget.tsx`
- Update: `src/components/guidance/index.ts`

```typescript
// src/components/guidance/InsightsWidget.tsx
"use client"

import { useState, useEffect } from "react"
import { Lightbulb, TrendingUp, TrendingDown, Receipt, Wallet, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface Insight {
  type: "invoice_reminder" | "expense_pattern" | "revenue_trend" | "compliance_risk"
  title: string
  description: string
  confidence: number
  suggestedAction?: {
    label: string
    href: string
  }
}

interface InsightsWidgetProps {
  className?: string
}

const typeIcons = {
  invoice_reminder: Receipt,
  expense_pattern: Wallet,
  revenue_trend: TrendingUp,
  compliance_risk: TrendingDown,
}

const typeColors = {
  invoice_reminder: "text-blue-400 bg-blue-400/10",
  expense_pattern: "text-amber-400 bg-amber-400/10",
  revenue_trend: "text-emerald-400 bg-emerald-400/10",
  compliance_risk: "text-red-400 bg-red-400/10",
}

export function InsightsWidget({ className }: InsightsWidgetProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        const res = await fetch("/api/guidance/insights")
        if (res.ok) {
          const data = await res.json()
          setInsights(data.insights || [])
        }
      } catch (error) {
        console.error("Failed to fetch insights:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchInsights()
  }, [])

  if (isLoading) {
    return (
      <div className={cn("rounded-2xl surface-glass p-4", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-white">Uvidi</span>
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className={cn("rounded-2xl surface-glass p-4", className)}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-white">Uvidi</span>
        </div>
        <p className="text-sm text-white/60">
          Nema dovoljno podataka za pametne prijedloge. Nastavite koristiti FiskAI!
        </p>
      </div>
    )
  }

  return (
    <div className={cn("rounded-2xl surface-glass p-4", className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-400" />
          <span className="font-semibold text-white">Pametni uvidi</span>
        </div>
        <span className="text-xs text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
          AI
        </span>
      </div>

      <div className="space-y-3">
        {insights.slice(0, 3).map((insight, index) => {
          const Icon = typeIcons[insight.type]
          const colorClasses = typeColors[insight.type]

          return (
            <div
              key={index}
              className="rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={cn("rounded-lg p-2", colorClasses)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {insight.title}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5 line-clamp-2">
                    {insight.description}
                  </p>
                  {insight.suggestedAction && (
                    <Link
                      href={insight.suggestedAction.href}
                      className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2"
                    >
                      {insight.suggestedAction.label}
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Update exports:**

```typescript
// src/components/guidance/index.ts
export * from "./InsightsWidget"
```

**Commit:**

```bash
git add src/components/guidance/
git commit -m "feat(guidance): add InsightsWidget for smart suggestions display"
```

---

## Task 5.4: Create Insights API Endpoint

**Files:**

- Create: `src/app/api/guidance/insights/route.ts`

```typescript
// src/app/api/guidance/insights/route.ts
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth-utils"
import { getSelectedCompany } from "@/lib/company"
import { getAllPatternInsights } from "@/lib/guidance/patterns"

export const dynamic = "force-dynamic"

/**
 * GET /api/guidance/insights
 *
 * Get AI-powered pattern insights for the current company.
 */
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await getSelectedCompany()
    if (!company) {
      return NextResponse.json({ error: "No company selected" }, { status: 400 })
    }

    const insights = await getAllPatternInsights(company.id)

    return NextResponse.json({ insights })
  } catch (error) {
    console.error("Error fetching insights:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**Commit:**

```bash
git add src/app/api/guidance/
git commit -m "feat(guidance): add insights API endpoint"
```

---

## Task 5.5: Add Insights Widget to Dashboard

**Files:**

- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Add import**

```typescript
import { InsightsWidget } from "@/components/guidance"
```

**Step 2: Add widget to dashboard layout**

Find the dashboard widgets area and add:

```tsx
{
  /* Smart Insights Widget */
}
;<InsightsWidget className="col-span-1" />
```

Place it after the ChecklistWidget or in a prominent position.

**Commit:**

```bash
git add src/app/(dashboard)/dashboard/
git commit -m "feat(guidance): add InsightsWidget to dashboard"
```

---

## Task 5.6: Update Guidance Index Exports

**Files:**

- Modify: `src/lib/guidance/index.ts`

Add pattern exports:

```typescript
export * from "./patterns"
```

**Commit:**

```bash
git add src/lib/guidance/index.ts
git commit -m "feat(guidance): export pattern detection utilities"
```

---

## Task 5.7: Build Verification and Push

**Step 1: Run tests**

```bash
node --import tsx --test src/lib/guidance/__tests__/*.test.ts
```

**Step 2: Run build**

```bash
npm run build
```

**Step 3: Commit and push**

```bash
git add .
git commit -m "feat(guidance): complete Phase 5 - Intelligence with pattern detection"
git push origin main
```

---

## Quick Reference

**New files created:**

- `src/lib/guidance/patterns.ts` - Pattern detection algorithms
- `src/components/guidance/InsightsWidget.tsx` - Dashboard widget
- `src/app/api/guidance/insights/route.ts` - API endpoint

**Modified files:**

- `src/lib/guidance/checklist.ts` - Integrated patterns
- `src/lib/guidance/index.ts` - New exports
- `src/components/guidance/index.ts` - New exports
- `src/app/(dashboard)/dashboard/page.tsx` - Added widget

**Pattern Detection Features:**

1. **Invoice reminders** - "You usually invoice Client X around this time"
2. **Expense anomalies** - "Your office expenses are 50% higher than usual"
3. **Revenue trends** - "Revenue is down/up X% compared to previous months"

**Confidence thresholds:**

- 80%+: Show as "upcoming" urgency
- 60-79%: Show as "optional"
- <60%: Don't show

**Future enhancements (not in this phase):**

- AI chat assistant
- Compliance risk scoring
- Cash flow predictions
