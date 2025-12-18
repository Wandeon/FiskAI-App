# Paušalni Obrt 100% Completion Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all missing features for paušalni obrt users to reach 100% functionality.

**Architecture:** Three main work streams - (1) Dashboard personalization based on legalForm, (2) Deadline notifications integrated into existing notification system, (3) POS fiscalization completing the real FINA CIS API integration.

**Tech Stack:** Next.js 14, Prisma, Drizzle (deadlines), TypeScript, Tailwind CSS

---

## Phase 1: Dashboard Personalization for Paušalni Obrt

### Task 1.1: Add legalForm to Dashboard Data Fetching

**Files:**

- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Update dashboard to fetch company.legalForm**

In `src/app/(dashboard)/dashboard/page.tsx`, the company is already fetched. Ensure `legalForm` is available:

```typescript
// Line ~22 - company already has legalForm from getCurrentCompany
// Verify legalForm is passed to components
```

**Step 2: Pass legalForm to child components**

Update the return JSX to pass legalForm:

```typescript
<HeroBanner
  userName={firstName}
  companyName={company.name}
  legalForm={company.legalForm}  // Add this
  draftInvoices={draftInvoices}
  providerConfigured={!!company.eInvoiceProvider}
  contactCount={contactCount}
/>
```

**Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): pass legalForm to components"
```

---

### Task 1.2: Create Paušalni Dashboard Card Component

**Files:**

- Create: `src/components/dashboard/pausalni-status-card.tsx`

**Step 1: Create the component**

```typescript
// src/components/dashboard/pausalni-status-card.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Calculator,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  FileText
} from "lucide-react"
import Link from "next/link"
import { formatCurrency } from "@/lib/posd/posd-calculator"

interface PausalniStatusCardProps {
  ytdRevenue: number
  vatThreshold: number
  nextDeadline: {
    title: string
    date: Date
    daysLeft: number
    type: "doprinosi" | "posd"
  } | null
  quarterlyIncome: {
    q1: number
    q2: number
    q3: number
    q4: number
  }
}

export function PausalniStatusCard({
  ytdRevenue,
  vatThreshold,
  nextDeadline,
  quarterlyIncome,
}: PausalniStatusCardProps) {
  const vatPercentage = Math.min((ytdRevenue / vatThreshold) * 100, 100)
  const isNearThreshold = vatPercentage >= 80
  const isOverThreshold = vatPercentage >= 100

  return (
    <Card className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-blue-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calculator className="h-4 w-4 text-cyan-500" />
            Paušalni obrt status
          </CardTitle>
          <Badge variant={isOverThreshold ? "destructive" : isNearThreshold ? "warning" : "secondary"}>
            {isOverThreshold ? "Preko praga!" : isNearThreshold ? "Blizu praga" : "U redu"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* VAT Threshold Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">PDV prag (60.000 €)</span>
            <span className="font-medium">{vatPercentage.toFixed(1)}%</span>
          </div>
          <Progress
            value={vatPercentage}
            className={isOverThreshold ? "bg-red-200" : isNearThreshold ? "bg-amber-200" : ""}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatCurrency(ytdRevenue)}</span>
            <span>{formatCurrency(vatThreshold)}</span>
          </div>
        </div>

        {/* Next Deadline */}
        {nextDeadline && (
          <div className={`rounded-lg p-3 ${
            nextDeadline.daysLeft <= 3
              ? "bg-red-500/10 border border-red-500/20"
              : nextDeadline.daysLeft <= 7
                ? "bg-amber-500/10 border border-amber-500/20"
                : "bg-muted/50"
          }`}>
            <div className="flex items-start gap-3">
              {nextDeadline.daysLeft <= 3 ? (
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              ) : (
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{nextDeadline.title}</p>
                <p className="text-xs text-muted-foreground">
                  {nextDeadline.date.toLocaleDateString("hr-HR")} •
                  {nextDeadline.daysLeft === 0
                    ? " Danas!"
                    : nextDeadline.daysLeft === 1
                      ? " Sutra!"
                      : ` još ${nextDeadline.daysLeft} dana`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/reports/pausalni-obrt">
              <FileText className="h-4 w-4 mr-1" />
              PO-SD
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link href="/alati/posd-kalkulator">
              <Calculator className="h-4 w-4 mr-1" />
              Kalkulator
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/pausalni-status-card.tsx
git commit -m "feat(dashboard): add PausalniStatusCard component"
```

---

### Task 1.3: Create Deadline Countdown Card Component

**Files:**

- Create: `src/components/dashboard/deadline-countdown-card.tsx`

**Step 1: Create the component**

```typescript
// src/components/dashboard/deadline-countdown-card.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, Clock, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"

interface Deadline {
  id: string
  title: string
  deadlineDate: string
  deadlineType: string
  severity: string
  description?: string
}

interface DeadlineCountdownCardProps {
  deadlines: Deadline[]
  businessType: string
}

function getDaysUntil(dateStr: string): number {
  const deadline = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  deadline.setHours(0, 0, 0, 0)
  return Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getSeverityColor(daysLeft: number, severity: string) {
  if (daysLeft <= 0) return "destructive"
  if (daysLeft <= 3 || severity === "critical") return "destructive"
  if (daysLeft <= 7 || severity === "high") return "warning"
  return "secondary"
}

export function DeadlineCountdownCard({ deadlines, businessType }: DeadlineCountdownCardProps) {
  if (deadlines.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4" />
            Nadolazeći rokovi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Nema rokova u sljedećih 30 dana
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Calendar className="h-4 w-4" />
            Nadolazeći rokovi
          </CardTitle>
          <Link
            href="/alati/kalendar"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Svi rokovi →
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {deadlines.slice(0, 4).map((deadline) => {
          const daysLeft = getDaysUntil(deadline.deadlineDate)
          const severity = getSeverityColor(daysLeft, deadline.severity)

          return (
            <div
              key={deadline.id}
              className={`flex items-start gap-3 rounded-lg p-2 ${
                daysLeft <= 3 ? "bg-red-500/10" : daysLeft <= 7 ? "bg-amber-500/10" : "bg-muted/30"
              }`}
            >
              {daysLeft <= 3 ? (
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{deadline.title}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(deadline.deadlineDate).toLocaleDateString("hr-HR", {
                    day: "numeric",
                    month: "short",
                  })}
                </p>
              </div>
              <Badge variant={severity} className="shrink-0">
                {daysLeft <= 0
                  ? "Prošao!"
                  : daysLeft === 1
                    ? "Sutra"
                    : `${daysLeft}d`}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/deadline-countdown-card.tsx
git commit -m "feat(dashboard): add DeadlineCountdownCard component"
```

---

### Task 1.4: Integrate Paušalni Cards into Dashboard

**Files:**

- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Add imports**

At the top of the file, add:

```typescript
import { PausalniStatusCard } from "@/components/dashboard/pausalni-status-card"
import { DeadlineCountdownCard } from "@/components/dashboard/deadline-countdown-card"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"
```

**Step 2: Add data fetching for deadlines and YTD revenue**

Inside the Promise.all array (around line 43), add:

```typescript
// Add to existing Promise.all
db.eInvoice.aggregate({
  where: {
    companyId: company.id,
    status: { in: revenueStatuses },
    createdAt: {
      gte: new Date(new Date().getFullYear(), 0, 1), // Jan 1 of current year
    },
  },
  _sum: { totalAmount: true },
}),
```

After the Promise.all, add deadline fetching:

```typescript
// Map legalForm to businessType for deadlines
const businessTypeMap: Record<string, string> = {
  OBRT_PAUSAL: "pausalni",
  OBRT_REAL: "obrt",
  OBRT_VAT: "obrt",
  JDOO: "doo",
  DOO: "doo",
}
const businessType = businessTypeMap[company.legalForm || ""] || "all"

// Fetch upcoming deadlines
const upcomingDeadlines = await getUpcomingDeadlines(30, businessType, 5)
```

**Step 3: Calculate next deadline for paušalni**

```typescript
// Calculate next deadline
const nextDeadline =
  upcomingDeadlines.length > 0
    ? {
        title: upcomingDeadlines[0].title,
        date: new Date(upcomingDeadlines[0].deadlineDate),
        daysLeft: Math.ceil(
          (new Date(upcomingDeadlines[0].deadlineDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        ),
        type: upcomingDeadlines[0].deadlineType?.includes("posd")
          ? ("posd" as const)
          : ("doprinosi" as const),
      }
    : null
```

**Step 4: Conditionally render paušalni card**

In the JSX, after `<FiscalizationStatus>`, add:

```typescript
{company.legalForm === "OBRT_PAUSAL" && (
  <PausalniStatusCard
    ytdRevenue={Number(ytdRevenue._sum.totalAmount || 0)}
    vatThreshold={60000}
    nextDeadline={nextDeadline}
    quarterlyIncome={{ q1: 0, q2: 0, q3: 0, q4: 0 }} // TODO: Calculate from invoices
  />
)}

<DeadlineCountdownCard
  deadlines={upcomingDeadlines}
  businessType={businessType}
/>
```

**Step 5: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat(dashboard): integrate paušalni and deadline cards"
```

---

## Phase 2: Deadline Notification System

### Task 2.1: Add Deadline Alerts to Notification Feed

**Files:**

- Modify: `src/lib/notifications.ts`

**Step 1: Add deadline imports**

At the top, add:

```typescript
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"
```

**Step 2: Add deadline fetching to getNotificationCenterFeed**

Inside the Promise.all (around line 68), add:

```typescript
// Add inside Promise.all
getUpcomingDeadlines(14, undefined, 5), // Next 14 days deadlines
```

Update the destructuring to include deadlines:

```typescript
const [
  draftCount,
  // ... existing
  upcomingDeadlines, // Add this
] = await Promise.all([
```

**Step 3: Generate deadline notifications**

After the existing alert generation (around line 264), add:

```typescript
// Deadline notifications
const deadlineAlerts: NotificationItem[] = upcomingDeadlines
  .filter((d) => {
    const daysLeft = Math.ceil(
      (new Date(d.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysLeft <= 7 // Only show deadlines within 7 days
  })
  .map((deadline) => {
    const daysLeft = Math.ceil(
      (new Date(deadline.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    const isUrgent = daysLeft <= 3

    return {
      id: `deadline-${deadline.id}`,
      type: isUrgent ? ("warning" as NotificationType) : ("info" as NotificationType),
      title: deadline.title,
      description:
        daysLeft <= 0
          ? "Rok je prošao!"
          : daysLeft === 1
            ? "Rok je sutra!"
            : `Rok za ${daysLeft} dana`,
      timestamp: new Date(deadline.deadlineDate).toLocaleDateString("hr-HR"),
      action: { label: "Kalendar", href: "/alati/kalendar" },
    }
  })
```

**Step 4: Include deadline alerts in items**

Update the items array:

```typescript
const items = [
  ...deadlineAlerts, // Add deadline alerts first (high priority)
  ...alerts,
  ...ticketNotifications,
  ...invoiceNotifications,
  ...activityNotifications,
].slice(0, 15) // Increase limit to accommodate deadlines
```

**Step 5: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat(notifications): add deadline alerts to notification feed"
```

---

### Task 2.2: Create Email Reminder Cron Job

**Files:**

- Create: `src/app/api/cron/deadline-reminders/route.ts`

**Step 1: Create the cron route**

```typescript
// src/app/api/cron/deadline-reminders/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUpcomingDeadlines } from "@/lib/deadlines/queries"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// Vercel cron or external cron calls this endpoint
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Get all companies with paušalni obrt
    const companies = await db.company.findMany({
      where: {
        legalForm: "OBRT_PAUSAL",
      },
      include: {
        users: {
          include: {
            user: true,
          },
        },
      },
    })

    const results: { companyId: string; emailsSent: number }[] = []

    for (const company of companies) {
      // Get upcoming deadlines for paušalni
      const deadlines = await getUpcomingDeadlines(7, "pausalni", 5)

      // Filter to deadlines that need reminders (7 days, 3 days, 1 day before)
      const reminderDays = [7, 3, 1]
      const deadlinesToRemind = deadlines.filter((d) => {
        const daysLeft = Math.ceil(
          (new Date(d.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return reminderDays.includes(daysLeft)
      })

      if (deadlinesToRemind.length === 0) {
        continue
      }

      // Get owner email
      const owner = company.users.find((u) => u.role === "OWNER")
      if (!owner?.user.email) continue

      // Send reminder email
      try {
        await resend.emails.send({
          from: "FiskAI <noreply@fiskai.hr>",
          to: owner.user.email,
          subject: `[FiskAI] Podsjetnik: ${deadlinesToRemind.length} rok(ova) uskoro`,
          html: generateReminderEmailHtml(company.name, deadlinesToRemind),
        })

        results.push({ companyId: company.id, emailsSent: 1 })
      } catch (emailError) {
        console.error(`Failed to send email to ${owner.user.email}:`, emailError)
      }
    }

    return NextResponse.json({
      success: true,
      companiesProcessed: companies.length,
      results,
    })
  } catch (error) {
    console.error("Deadline reminder cron error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

function generateReminderEmailHtml(
  companyName: string,
  deadlines: { title: string; deadlineDate: string; description?: string | null }[]
): string {
  const deadlineRows = deadlines
    .map((d) => {
      const daysLeft = Math.ceil(
        (new Date(d.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      const urgency = daysLeft <= 1 ? "🔴" : daysLeft <= 3 ? "🟡" : "🟢"

      return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          ${urgency} <strong>${d.title}</strong>
          ${d.description ? `<br><small style="color: #6b7280;">${d.description}</small>` : ""}
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">
          ${new Date(d.deadlineDate).toLocaleDateString("hr-HR")}<br>
          <small style="color: ${daysLeft <= 1 ? "#dc2626" : "#6b7280"};">
            ${daysLeft === 0 ? "Danas!" : daysLeft === 1 ? "Sutra!" : `za ${daysLeft} dana`}
          </small>
        </td>
      </tr>
    `
    })
    .join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0891b2;">FiskAI - Podsjetnik na rokove</h2>
        <p>Poštovani,</p>
        <p>Ovo je podsjetnik za tvrtku <strong>${companyName}</strong> o nadolazećim rokovima:</p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left;">Rok</th>
              <th style="padding: 12px; text-align: right;">Datum</th>
            </tr>
          </thead>
          <tbody>
            ${deadlineRows}
          </tbody>
        </table>

        <p>
          <a href="https://erp.metrica.hr/dashboard"
             style="display: inline-block; padding: 12px 24px; background: #0891b2; color: white; text-decoration: none; border-radius: 6px;">
            Otvori FiskAI
          </a>
        </p>

        <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
          Ovu poruku šalje FiskAI automatski. Možete promijeniti postavke obavijesti u aplikaciji.
        </p>
      </div>
    </body>
    </html>
  `
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/deadline-reminders/route.ts
git commit -m "feat(cron): add deadline reminder email cron job"
```

---

### Task 2.3: Add Missing Paušalni Deadlines to Seed Data

**Files:**

- Modify: `src/lib/deadlines/seed-data.ts`

**Step 1: Add quarterly PO-SD deadlines**

Find the seed data file and add these deadlines:

```typescript
// PO-SD quarterly submission deadlines for 2025
{
  id: "posd-q1-2025",
  title: "PO-SD za Q1 2025",
  description: "Obrazac PO-SD za I. kvartal - predaja do 20. travnja",
  deadlineDate: "2025-04-20",
  deadlineType: "posd",
  appliesTo: ["pausalni"],
  severity: "high",
  legalBasis: "Zakon o porezu na dohodak",
},
{
  id: "posd-q2-2025",
  title: "PO-SD za Q2 2025",
  description: "Obrazac PO-SD za II. kvartal - predaja do 20. srpnja",
  deadlineDate: "2025-07-20",
  deadlineType: "posd",
  appliesTo: ["pausalni"],
  severity: "high",
  legalBasis: "Zakon o porezu na dohodak",
},
{
  id: "posd-q3-2025",
  title: "PO-SD za Q3 2025",
  description: "Obrazac PO-SD za III. kvartal - predaja do 20. listopada",
  deadlineDate: "2025-10-20",
  deadlineType: "posd",
  appliesTo: ["pausalni"],
  severity: "high",
  legalBasis: "Zakon o porezu na dohodak",
},
{
  id: "posd-q4-2025",
  title: "PO-SD za Q4 2025",
  description: "Obrazac PO-SD za IV. kvartal - predaja do 20. siječnja 2026",
  deadlineDate: "2026-01-20",
  deadlineType: "posd",
  appliesTo: ["pausalni"],
  severity: "high",
  legalBasis: "Zakon o porezu na dohodak",
},
```

**Step 2: Add monthly doprinosi deadlines (Jan-Dec 2025)**

```typescript
// Monthly contribution deadlines for paušalni obrt (2025)
...Array.from({ length: 12 }, (_, i) => {
  const month = i + 1
  const monthNames = ["siječanj", "veljača", "ožujak", "travanj", "svibanj", "lipanj",
                      "srpanj", "kolovoz", "rujan", "listopad", "studeni", "prosinac"]
  return {
    id: `doprinosi-${month}-2025`,
    title: `Uplata doprinosa za ${monthNames[i === 0 ? 11 : i - 1]}`,
    description: "Mjesečni doprinosi za MIO i zdravstveno osiguranje",
    deadlineDate: `2025-${String(month).padStart(2, "0")}-15`,
    deadlineType: "doprinosi",
    appliesTo: ["pausalni", "obrt"],
    severity: "high",
    legalBasis: "Zakon o doprinosima",
  }
}),
```

**Step 3: Commit**

```bash
git add src/lib/deadlines/seed-data.ts
git commit -m "feat(deadlines): add paušalni PO-SD and doprinosi deadlines for 2025"
```

---

## Phase 3: POS Fiscalization - Real FINA CIS Integration

### Task 3.1: Update pos-fiscalize.ts to Use Fiscal Pipeline

**Files:**

- Modify: `src/lib/fiscal/pos-fiscalize.ts`

**Step 1: Import fiscal pipeline**

Add imports at the top:

```typescript
import { executeFiscalRequest } from "./fiscal-pipeline"
import { FiscalRequestStatus, FiscalRequestMessageType } from "@prisma/client"
```

**Step 2: Replace TODO with real implementation**

Replace the current TODO section (lines 82-88) with:

```typescript
// Real fiscalization - create fiscal request and execute
try {
  // Create fiscal request record
  const fiscalRequest = await db.fiscalRequest.create({
    data: {
      companyId: company.id,
      invoiceId: invoice.id,
      certificateId: certificate.id,
      messageType: "RACUN" as FiscalRequestMessageType,
      status: "PROCESSING" as FiscalRequestStatus,
      attemptCount: 1,
      lastAttemptAt: new Date(),
    },
  })

  // Execute fiscalization
  const result = await executeFiscalRequest(fiscalRequest)

  // Update request with result
  await db.fiscalRequest.update({
    where: { id: fiscalRequest.id },
    data: {
      status: result.success ? "COMPLETED" : "FAILED",
      jir: result.jir,
      zki: result.zki || zki,
      responseXml: result.responseXml,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    },
  })

  // Update invoice with JIR
  if (result.success && result.jir) {
    await db.eInvoice.update({
      where: { id: invoice.id },
      data: {
        jir: result.jir,
        zki: result.zki || zki,
        fiscalStatus: "FISCALIZED",
        fiscalizedAt: new Date(),
      },
    })
  }

  return {
    success: result.success,
    jir: result.jir,
    zki: result.zki || zki,
    error: result.errorMessage,
  }
} catch (error: any) {
  console.error("POS fiscalization error:", error)

  // Queue for retry if it's a temporary failure
  if (error?.poreznaCode !== "p001" && error?.poreznaCode !== "p002") {
    await queueFiscalRetry(invoice.id)
  }

  return {
    success: false,
    zki,
    error: error?.message || "Greška kod fiskalizacije",
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/fiscal/pos-fiscalize.ts
git commit -m "feat(pos): integrate real FINA fiscalization pipeline"
```

---

### Task 3.2: Add Environment Toggle for Demo Mode

**Files:**

- Modify: `src/lib/fiscal/pos-fiscalize.ts`

**Step 1: Add environment check**

Near the top after imports, add:

```typescript
const FORCE_DEMO_MODE = process.env.FISCAL_DEMO_MODE === "true"
```

**Step 2: Update fiscalization check**

Replace the `if (!company.fiscalEnabled)` check with:

```typescript
// Check if real fiscalization is enabled
// Demo mode if: explicitly disabled, or FISCAL_DEMO_MODE env is set
if (!company.fiscalEnabled || FORCE_DEMO_MODE) {
  // Demo mode - return mock JIR
  const demoJir = `DEMO-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Still update invoice with demo data for testing
  await db.eInvoice.update({
    where: { id: invoice.id },
    data: {
      zki,
      jir: demoJir,
      fiscalStatus: "FISCALIZED",
      fiscalizedAt: new Date(),
    },
  })

  return {
    success: true,
    jir: demoJir,
    zki,
  }
}
```

**Step 3: Add to .env.example**

```bash
# Fiscal Demo Mode (set to "true" to bypass real FINA API)
FISCAL_DEMO_MODE=true
```

**Step 4: Commit**

```bash
git add src/lib/fiscal/pos-fiscalize.ts .env.example
git commit -m "feat(pos): add FISCAL_DEMO_MODE environment toggle"
```

---

### Task 3.3: Add Fiscal Retry Processing

**Files:**

- Create: `src/app/api/cron/fiscal-retry/route.ts`

**Step 1: Create the cron route**

```typescript
// src/app/api/cron/fiscal-retry/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { executeFiscalRequest } from "@/lib/fiscal/fiscal-pipeline"

const MAX_ATTEMPTS = 5
const RETRY_DELAYS = [60, 300, 900, 3600, 7200] // seconds: 1min, 5min, 15min, 1hr, 2hr

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Find pending fiscal requests that are due for retry
    const pendingRequests = await db.fiscalRequest.findMany({
      where: {
        status: { in: ["QUEUED", "FAILED"] },
        attemptCount: { lt: MAX_ATTEMPTS },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    })

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const request of pendingRequests) {
      // Check if enough time has passed since last attempt
      const retryDelay = RETRY_DELAYS[Math.min(request.attemptCount, RETRY_DELAYS.length - 1)]
      const nextRetryTime = new Date(request.lastAttemptAt!.getTime() + retryDelay * 1000)

      if (new Date() < nextRetryTime) {
        continue // Not time to retry yet
      }

      // Update attempt count
      await db.fiscalRequest.update({
        where: { id: request.id },
        data: {
          status: "PROCESSING",
          attemptCount: request.attemptCount + 1,
          lastAttemptAt: new Date(),
        },
      })

      try {
        const result = await executeFiscalRequest(request)

        await db.fiscalRequest.update({
          where: { id: request.id },
          data: {
            status: result.success ? "COMPLETED" : "FAILED",
            jir: result.jir,
            zki: result.zki,
            responseXml: result.responseXml,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          },
        })

        // Update invoice if successful
        if (result.success && result.jir && request.invoiceId) {
          await db.eInvoice.update({
            where: { id: request.invoiceId },
            data: {
              jir: result.jir,
              zki: result.zki,
              fiscalStatus: "FISCALIZED",
              fiscalizedAt: new Date(),
            },
          })
        }

        results.push({ id: request.id, success: result.success, error: result.errorMessage })
      } catch (error: any) {
        const isFinalAttempt = request.attemptCount + 1 >= MAX_ATTEMPTS

        await db.fiscalRequest.update({
          where: { id: request.id },
          data: {
            status: isFinalAttempt ? "DEAD" : "FAILED",
            errorCode: error?.poreznaCode,
            errorMessage: error?.message,
          },
        })

        results.push({ id: request.id, success: false, error: error?.message })
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error) {
    console.error("Fiscal retry cron error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/fiscal-retry/route.ts
git commit -m "feat(cron): add fiscal retry processing job"
```

---

### Task 3.4: Add POS Fiscalization Status UI

**Files:**

- Modify: `src/app/(dashboard)/pos/components/receipt-modal.tsx`

**Step 1: Add fiscalization status display**

In the receipt modal, ensure fiscalization status is shown:

```typescript
// Add to the receipt display section
{fiscalResult && (
  <div className="mt-4 p-3 rounded-lg bg-muted/50">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">ZKI:</span>
      <code className="text-xs">{fiscalResult.zki?.substring(0, 20)}...</code>
    </div>
    <div className="flex items-center justify-between text-sm mt-1">
      <span className="text-muted-foreground">JIR:</span>
      {fiscalResult.jir?.startsWith("DEMO") ? (
        <Badge variant="outline" className="text-amber-600">
          Demo: {fiscalResult.jir}
        </Badge>
      ) : (
        <code className="text-xs text-green-600">{fiscalResult.jir}</code>
      )}
    </div>
  </div>
)}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/pos/components/receipt-modal.tsx
git commit -m "feat(pos): display fiscalization status on receipt"
```

---

## Phase 4: Navigation & Discoverability

### Task 4.1: Add PO-SD Link to Sidebar

**Files:**

- Modify: `src/components/layout/sidebar.tsx` (or equivalent navigation file)

**Step 1: Find navigation config and add paušalni reports link**

```typescript
// Add to reports section, conditionally shown for OBRT_PAUSAL
{
  title: "PO-SD izvještaj",
  href: "/reports/pausalni-obrt",
  icon: FileText,
  badge: "Paušal",
  showFor: ["OBRT_PAUSAL"],
}
```

**Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): add PO-SD report link for paušalni users"
```

---

### Task 4.2: Add Badge Component Variant (if missing)

**Files:**

- Check: `src/components/ui/badge.tsx`

Ensure "warning" variant exists:

```typescript
const badgeVariants = cva(
  // ... existing
  {
    variants: {
      variant: {
        // ... existing variants
        warning: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      },
    },
  }
)
```

**Step 1: Commit if changed**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat(ui): add warning variant to Badge component"
```

---

## Testing Checklist

After implementation, verify:

1. **Dashboard:**
   - [ ] Paušalni users see the PausalniStatusCard
   - [ ] VAT threshold progress bar works correctly
   - [ ] DeadlineCountdownCard shows upcoming deadlines
   - [ ] Deadlines are filtered by business type

2. **Notifications:**
   - [ ] Deadline alerts appear in notification center
   - [ ] Alerts show correct urgency (7/3/1 days)
   - [ ] "Kalendar" action link works

3. **Email Reminders:**
   - [ ] Cron job runs without errors
   - [ ] Emails are sent to company owners
   - [ ] Email template renders correctly

4. **POS Fiscalization:**
   - [ ] Demo mode works when FISCAL_DEMO_MODE=true
   - [ ] Real mode attempts FINA API when enabled
   - [ ] Failed requests are queued for retry
   - [ ] Receipt shows ZKI/JIR correctly

5. **Navigation:**
   - [ ] PO-SD link visible for paušalni users
   - [ ] Reports page loads correctly

---

## Environment Variables Required

```bash
# Add to production .env
CRON_SECRET=<secure-random-string>
FISCAL_DEMO_MODE=false  # Set to true for testing
RESEND_API_KEY=<your-resend-key>
```

---

## Deployment Notes

1. Run deadline seed after deployment:

   ```bash
   npx tsx scripts/seed-deadlines.ts
   ```

2. Configure Vercel/Coolify cron jobs:
   - `/api/cron/deadline-reminders` - Daily at 08:00
   - `/api/cron/fiscal-retry` - Every 5 minutes

3. Test in staging with `FISCAL_DEMO_MODE=true` first

---

**Total Tasks:** 14
**Estimated Implementation Time:** 4-6 hours
