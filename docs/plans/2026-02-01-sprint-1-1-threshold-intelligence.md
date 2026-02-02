# Sprint 1.1: Threshold Intelligence - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Paušalni Obrt users see real-time 60,000€ threshold progress with smart alerts at 50%, 75%, 90%, 100% and receive proactive notifications with "what happens next" guidance.

**Architecture:** Extend the existing pausalni dashboard with a new threshold intelligence service that calculates YTD progress, projects annual revenue, and triggers alerts at key thresholds. Alerts integrate with the existing AdminAlert system and display in-dashboard via a new ThresholdAlertBanner component.

**Tech Stack:** TypeScript, React, Prisma, Next.js App Router, Vitest

---

## Context for Implementer

### Key Files to Reference

| File                                                | Purpose                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `src/components/pausalni/pausalni-dashboard.tsx`    | Main dashboard - add threshold alert banner here |
| `src/components/dashboard/pausalni-status-card.tsx` | Existing status card with progress bar           |
| `src/lib/admin/alerts.ts`                           | Alert system - extend AlertType enum             |
| `src/lib/fiscal-data/data/thresholds.ts`            | THRESHOLDS.pausalni.value = 60000                |
| `src/app/(app)/pausalni/page.tsx`                   | Server component that fetches YTD revenue        |

### Existing Patterns

- **Revenue calculation**: `db.eInvoice.aggregate()` with status filter
- **Money handling**: Always use cents internally, convert at display
- **Alert types**: kebab-case strings like `"approaching-limit"`
- **Croatian text**: All user-facing strings in Croatian

### Threshold Definitions

| Threshold | Percentage | Alert Level | Message                 |
| --------- | ---------- | ----------- | ----------------------- |
| Attention | 50%        | info        | "Polovica praga"        |
| Warning   | 75%        | warning     | "Približavate se pragu" |
| Critical  | 90%        | critical    | "Blizu praga!"          |
| Exceeded  | 100%       | critical    | "Prag premašen!"        |

---

## Task 1: Create Threshold Intelligence Service

**Files:**

- Create: `src/lib/pausalni/threshold-intelligence.ts`
- Test: `src/lib/pausalni/__tests__/threshold-intelligence.test.ts`

**Step 1: Write the failing tests**

Create `src/lib/pausalni/__tests__/threshold-intelligence.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
  calculateThresholdStatus,
  projectAnnualRevenue,
  getThresholdAlertLevel,
  formatThresholdGuidance,
  type ThresholdStatus,
} from "../threshold-intelligence"

describe("calculateThresholdStatus", () => {
  const LIMIT_CENTS = 6000000 // 60,000 EUR in cents

  it("returns 'safe' status when below 50%", () => {
    const result = calculateThresholdStatus(2000000, LIMIT_CENTS) // 20,000 EUR
    expect(result.status).toBe("safe")
    expect(result.percentage).toBeCloseTo(33.33, 1)
    expect(result.remainingCents).toBe(4000000)
  })

  it("returns 'attention' status at 50%", () => {
    const result = calculateThresholdStatus(3000000, LIMIT_CENTS) // 30,000 EUR
    expect(result.status).toBe("attention")
    expect(result.percentage).toBe(50)
  })

  it("returns 'warning' status at 75%", () => {
    const result = calculateThresholdStatus(4500000, LIMIT_CENTS) // 45,000 EUR
    expect(result.status).toBe("warning")
    expect(result.percentage).toBe(75)
  })

  it("returns 'critical' status at 90%", () => {
    const result = calculateThresholdStatus(5400000, LIMIT_CENTS) // 54,000 EUR
    expect(result.status).toBe("critical")
    expect(result.percentage).toBe(90)
  })

  it("returns 'exceeded' status above 100%", () => {
    const result = calculateThresholdStatus(6500000, LIMIT_CENTS) // 65,000 EUR
    expect(result.status).toBe("exceeded")
    expect(result.percentage).toBeCloseTo(108.33, 1)
    expect(result.remainingCents).toBe(0)
  })
})

describe("projectAnnualRevenue", () => {
  it("projects annual revenue based on YTD and days elapsed", () => {
    // 30,000 EUR after 6 months (182 days) = 60,000 EUR projected
    const result = projectAnnualRevenue(3000000, 182)
    expect(result).toBeCloseTo(6021978, -3) // ~60,220 EUR
  })

  it("returns YTD if at end of year", () => {
    const result = projectAnnualRevenue(5000000, 365)
    expect(result).toBe(5000000)
  })

  it("handles January correctly", () => {
    // 5,000 EUR after 31 days = ~59,000 EUR projected
    const result = projectAnnualRevenue(500000, 31)
    expect(result).toBeCloseTo(5887097, -3)
  })
})

describe("getThresholdAlertLevel", () => {
  it("returns null for safe status", () => {
    expect(getThresholdAlertLevel("safe")).toBeNull()
  })

  it("returns info for attention status", () => {
    expect(getThresholdAlertLevel("attention")).toBe("info")
  })

  it("returns warning for warning status", () => {
    expect(getThresholdAlertLevel("warning")).toBe("warning")
  })

  it("returns critical for critical and exceeded", () => {
    expect(getThresholdAlertLevel("critical")).toBe("critical")
    expect(getThresholdAlertLevel("exceeded")).toBe("critical")
  })
})

describe("formatThresholdGuidance", () => {
  it("returns appropriate message for attention level", () => {
    const guidance = formatThresholdGuidance("attention", 3000000, 6000000)
    expect(guidance.title).toBe("Polovica praga")
    expect(guidance.description).toContain("30.000")
  })

  it("returns appropriate message for exceeded level", () => {
    const guidance = formatThresholdGuidance("exceeded", 6500000, 6000000)
    expect(guidance.title).toBe("Prag premašen!")
    expect(guidance.description).toContain("obvezni")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx pnpm test src/lib/pausalni/__tests__/threshold-intelligence.test.ts`
Expected: FAIL with "Cannot find module '../threshold-intelligence'"

**Step 3: Write minimal implementation**

Create `src/lib/pausalni/threshold-intelligence.ts`:

```typescript
// src/lib/pausalni/threshold-intelligence.ts

import { THRESHOLDS } from "@/lib/fiscal-data/data/thresholds"

export type ThresholdStatusLevel = "safe" | "attention" | "warning" | "critical" | "exceeded"

export interface ThresholdStatus {
  status: ThresholdStatusLevel
  percentage: number
  currentCents: number
  limitCents: number
  remainingCents: number
}

export interface ThresholdGuidance {
  title: string
  description: string
  actionLabel: string
  actionUrl: string
}

// Threshold percentages
const THRESHOLDS_PERCENTAGES = {
  attention: 50,
  warning: 75,
  critical: 90,
  exceeded: 100,
} as const

/**
 * Calculate threshold status based on current revenue vs limit
 */
export function calculateThresholdStatus(
  currentCents: number,
  limitCents: number
): ThresholdStatus {
  const percentage = (currentCents / limitCents) * 100
  const remainingCents = Math.max(0, limitCents - currentCents)

  let status: ThresholdStatusLevel
  if (percentage >= THRESHOLDS_PERCENTAGES.exceeded) {
    status = "exceeded"
  } else if (percentage >= THRESHOLDS_PERCENTAGES.critical) {
    status = "critical"
  } else if (percentage >= THRESHOLDS_PERCENTAGES.warning) {
    status = "warning"
  } else if (percentage >= THRESHOLDS_PERCENTAGES.attention) {
    status = "attention"
  } else {
    status = "safe"
  }

  return {
    status,
    percentage,
    currentCents,
    limitCents,
    remainingCents,
  }
}

/**
 * Project annual revenue based on YTD and days elapsed
 */
export function projectAnnualRevenue(ytdCents: number, daysElapsed: number): number {
  if (daysElapsed >= 365) {
    return ytdCents
  }
  if (daysElapsed <= 0) {
    return 0
  }
  const dailyRate = ytdCents / daysElapsed
  return Math.round(dailyRate * 365)
}

/**
 * Get days elapsed in current year
 */
export function getDaysElapsedInYear(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const diffMs = date.getTime() - startOfYear.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1
}

/**
 * Get days remaining in current year
 */
export function getDaysRemainingInYear(date: Date = new Date()): number {
  const endOfYear = new Date(date.getFullYear(), 11, 31)
  const diffMs = endOfYear.getTime() - date.getTime()
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
}

/**
 * Map threshold status to alert level
 */
export function getThresholdAlertLevel(
  status: ThresholdStatusLevel
): "info" | "warning" | "critical" | null {
  switch (status) {
    case "safe":
      return null
    case "attention":
      return "info"
    case "warning":
      return "warning"
    case "critical":
    case "exceeded":
      return "critical"
  }
}

/**
 * Format currency in Croatian format (EUR)
 */
function formatEurCents(cents: number): string {
  const euros = cents / 100
  return euros.toLocaleString("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

/**
 * Get guidance message based on threshold status
 */
export function formatThresholdGuidance(
  status: ThresholdStatusLevel,
  currentCents: number,
  limitCents: number
): ThresholdGuidance {
  const remainingCents = Math.max(0, limitCents - currentCents)
  const remainingFormatted = formatEurCents(remainingCents)
  const currentFormatted = formatEurCents(currentCents)

  switch (status) {
    case "safe":
      return {
        title: "U redu",
        description: `Vaš prihod od ${currentFormatted} € je ispod 50% praga.`,
        actionLabel: "Pogledaj detalje",
        actionUrl: "/reports/pausalni-obrt",
      }
    case "attention":
      return {
        title: "Polovica praga",
        description: `Ostvarili ste ${currentFormatted} € (50% praga). Još ${remainingFormatted} € do praga od 60.000 €.`,
        actionLabel: "Provjerite projekciju",
        actionUrl: "/pausalni/threshold",
      }
    case "warning":
      return {
        title: "Približavate se pragu",
        description: `Ostvarili ste ${currentFormatted} € (75% praga). Preostalo vam je ${remainingFormatted} € do praga.`,
        actionLabel: "Saznajte što dalje",
        actionUrl: "/pausalni/threshold",
      }
    case "critical":
      return {
        title: "Blizu praga!",
        description: `Ostvarili ste ${currentFormatted} € (90% praga). Preostalo samo ${remainingFormatted} €. Razmislite o prelasku na stvarni dohodak.`,
        actionLabel: "Što ako pređem prag?",
        actionUrl: "/pausalni/threshold",
      }
    case "exceeded":
      return {
        title: "Prag premašen!",
        description: `Premašili ste prag od 60.000 €. Obvezni ste prijeći na oporezivanje po stvarnom dohotku ili PDV sustav.`,
        actionLabel: "Koraci za prelazak",
        actionUrl: "/pausalni/threshold",
      }
  }
}

/**
 * Get the pausalni limit in cents for a given year
 */
export function getPausalniLimitCents(year: number = new Date().getFullYear()): number {
  // Use the threshold from fiscal-data
  return THRESHOLDS.pausalni.value * 100
}
```

**Step 4: Run test to verify it passes**

Run: `npx pnpm test src/lib/pausalni/__tests__/threshold-intelligence.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/lib/pausalni/threshold-intelligence.ts src/lib/pausalni/__tests__/threshold-intelligence.test.ts
git commit -m "feat(pausalni): add threshold intelligence service

- calculateThresholdStatus: determine status based on YTD vs limit
- projectAnnualRevenue: forecast annual revenue from YTD
- formatThresholdGuidance: Croatian guidance messages per status
- Threshold levels: safe (<50%), attention (50%), warning (75%), critical (90%), exceeded (100%)"
```

---

## Task 2: Create Threshold Alert Banner Component

**Files:**

- Create: `src/components/pausalni/threshold-alert-banner.tsx`
- Test: `src/components/pausalni/__tests__/threshold-alert-banner.test.tsx`

**Step 1: Write the failing tests**

Create `src/components/pausalni/__tests__/threshold-alert-banner.test.tsx`:

```typescript
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ThresholdAlertBanner } from "../threshold-alert-banner"

describe("ThresholdAlertBanner", () => {
  it("renders nothing when status is safe", () => {
    const { container } = render(
      <ThresholdAlertBanner
        status="safe"
        percentage={30}
        currentCents={1800000}
        limitCents={6000000}
        projectedAnnualCents={3600000}
        daysRemaining={182}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders info banner at attention threshold", () => {
    render(
      <ThresholdAlertBanner
        status="attention"
        percentage={50}
        currentCents={3000000}
        limitCents={6000000}
        projectedAnnualCents={6000000}
        daysRemaining={182}
      />
    )
    expect(screen.getByText("Polovica praga")).toBeInTheDocument()
  })

  it("renders warning banner at warning threshold", () => {
    render(
      <ThresholdAlertBanner
        status="warning"
        percentage={75}
        currentCents={4500000}
        limitCents={6000000}
        projectedAnnualCents={6500000}
        daysRemaining={91}
      />
    )
    expect(screen.getByText("Približavate se pragu")).toBeInTheDocument()
  })

  it("renders critical banner when exceeded", () => {
    render(
      <ThresholdAlertBanner
        status="exceeded"
        percentage={110}
        currentCents={6600000}
        limitCents={6000000}
        projectedAnnualCents={7200000}
        daysRemaining={30}
      />
    )
    expect(screen.getByText("Prag premašen!")).toBeInTheDocument()
    expect(screen.getByText(/obvezni/i)).toBeInTheDocument()
  })

  it("shows projected annual when above safe", () => {
    render(
      <ThresholdAlertBanner
        status="warning"
        percentage={75}
        currentCents={4500000}
        limitCents={6000000}
        projectedAnnualCents={7000000}
        daysRemaining={91}
      />
    )
    expect(screen.getByText(/projekcija/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx pnpm test src/components/pausalni/__tests__/threshold-alert-banner.test.tsx`
Expected: FAIL with "Cannot find module '../threshold-alert-banner'"

**Step 3: Write minimal implementation**

Create `src/components/pausalni/threshold-alert-banner.tsx`:

```typescript
"use client"

import { AlertTriangle, Info, TrendingUp, ArrowRight } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  type ThresholdStatusLevel,
  formatThresholdGuidance,
} from "@/lib/pausalni/threshold-intelligence"

interface ThresholdAlertBannerProps {
  status: ThresholdStatusLevel
  percentage: number
  currentCents: number
  limitCents: number
  projectedAnnualCents: number
  daysRemaining: number
  className?: string
}

export function ThresholdAlertBanner({
  status,
  percentage,
  currentCents,
  limitCents,
  projectedAnnualCents,
  daysRemaining,
  className,
}: ThresholdAlertBannerProps) {
  // Don't show banner for safe status
  if (status === "safe") {
    return null
  }

  const guidance = formatThresholdGuidance(status, currentCents, limitCents)
  const projectedFormatted = (projectedAnnualCents / 100).toLocaleString("hr-HR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

  const variantMap: Record<ThresholdStatusLevel, "default" | "destructive"> = {
    safe: "default",
    attention: "default",
    warning: "default",
    critical: "destructive",
    exceeded: "destructive",
  }

  const iconMap: Record<ThresholdStatusLevel, React.ReactNode> = {
    safe: null,
    attention: <Info className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    critical: <AlertTriangle className="h-4 w-4" />,
    exceeded: <AlertTriangle className="h-4 w-4" />,
  }

  const borderColorMap: Record<ThresholdStatusLevel, string> = {
    safe: "",
    attention: "border-info/50",
    warning: "border-warning/50",
    critical: "border-destructive/50",
    exceeded: "border-destructive/50",
  }

  return (
    <Alert
      variant={variantMap[status]}
      className={`${borderColorMap[status]} ${className || ""}`}
    >
      {iconMap[status]}
      <AlertTitle className="flex items-center gap-2">
        {guidance.title}
        <span className="text-sm font-normal text-muted-foreground">
          ({percentage.toFixed(0)}% praga)
        </span>
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{guidance.description}</p>

        {/* Projection info */}
        <div className="flex items-center gap-2 text-sm">
          <TrendingUp className="h-4 w-4" />
          <span>
            Projekcija do kraja godine: <strong>{projectedFormatted} €</strong>
            {projectedAnnualCents > limitCents && (
              <span className="text-destructive ml-1">(prelazi prag!)</span>
            )}
          </span>
        </div>

        {/* Days remaining */}
        <p className="text-sm text-muted-foreground">
          Preostalo dana u godini: {daysRemaining}
        </p>

        {/* Action button */}
        <Button variant="outline" size="sm" asChild>
          <Link href={guidance.actionUrl}>
            {guidance.actionLabel}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </AlertDescription>
    </Alert>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `npx pnpm test src/components/pausalni/__tests__/threshold-alert-banner.test.tsx`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/components/pausalni/threshold-alert-banner.tsx src/components/pausalni/__tests__/threshold-alert-banner.test.tsx
git commit -m "feat(pausalni): add threshold alert banner component

- Shows alert banner when revenue reaches 50%, 75%, 90%, 100% thresholds
- Includes projected annual revenue calculation
- Croatian guidance messages with actionable links
- Hidden for safe status (<50%)"
```

---

## Task 3: Create Projections API Route

**Files:**

- Create: `src/app/api/pausalni/projections/route.ts`
- Test: `src/app/api/pausalni/projections/__tests__/route.test.ts`

**Step 1: Write the failing tests**

Create `src/app/api/pausalni/projections/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock auth
vi.mock("@/lib/auth-utils", () => ({
  getServerSession: vi.fn(),
}))

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findFirst: vi.fn(),
    },
    eInvoice: {
      aggregate: vi.fn(),
    },
  },
}))

import { GET } from "../route"
import { getServerSession } from "@/lib/auth-utils"
import { db } from "@/lib/db"

describe("GET /api/pausalni/projections", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    const request = new NextRequest("http://localhost/api/pausalni/projections")
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it("returns 403 when company is not OBRT_PAUSAL", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", companyId: "company-1" },
    } as any)

    vi.mocked(db.company.findFirst).mockResolvedValue({
      id: "company-1",
      legalForm: "DOO",
    } as any)

    const request = new NextRequest("http://localhost/api/pausalni/projections")
    const response = await GET(request)

    expect(response.status).toBe(403)
  })

  it("returns projection data for OBRT_PAUSAL company", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", companyId: "company-1" },
    } as any)

    vi.mocked(db.company.findFirst).mockResolvedValue({
      id: "company-1",
      legalForm: "OBRT_PAUSAL",
    } as any)

    vi.mocked(db.eInvoice.aggregate).mockResolvedValue({
      _sum: { totalAmount: 30000 }, // 30,000 EUR
    } as any)

    const request = new NextRequest("http://localhost/api/pausalni/projections")
    const response = await GET(request)

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.currentCents).toBe(3000000)
    expect(data.limitCents).toBe(6000000)
    expect(data.status).toBeDefined()
    expect(data.projectedAnnualCents).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx pnpm test src/app/api/pausalni/projections/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '../route'"

**Step 3: Write minimal implementation**

Create `src/app/api/pausalni/projections/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import {
  calculateThresholdStatus,
  projectAnnualRevenue,
  getDaysElapsedInYear,
  getDaysRemainingInYear,
  getPausalniLimitCents,
} from "@/lib/pausalni/threshold-intelligence"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()

    if (!session?.user?.companyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const company = await db.company.findFirst({
      where: { id: session.user.companyId },
      select: { id: true, legalForm: true },
    })

    if (!company || company.legalForm !== "OBRT_PAUSAL") {
      return NextResponse.json(
        { error: "This endpoint is only for paušalni obrt" },
        { status: 403 }
      )
    }

    const year = new Date().getFullYear()
    const limitCents = getPausalniLimitCents(year)

    // Get YTD revenue
    const ytdRevenueResult = await db.eInvoice.aggregate({
      where: {
        companyId: company.id,
        status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
        createdAt: {
          gte: new Date(year, 0, 1),
        },
      },
      _sum: { totalAmount: true },
    })

    const currentCents = Math.round(Number(ytdRevenueResult._sum.totalAmount || 0) * 100)

    // Calculate status
    const thresholdStatus = calculateThresholdStatus(currentCents, limitCents)

    // Calculate projection
    const daysElapsed = getDaysElapsedInYear()
    const daysRemaining = getDaysRemainingInYear()
    const projectedAnnualCents = projectAnnualRevenue(currentCents, daysElapsed)

    return NextResponse.json({
      year,
      currentCents,
      limitCents,
      ...thresholdStatus,
      projectedAnnualCents,
      daysElapsed,
      daysRemaining,
    })
  } catch (error) {
    console.error("Error fetching projections:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx pnpm test src/app/api/pausalni/projections/__tests__/route.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add src/app/api/pausalni/projections/route.ts src/app/api/pausalni/projections/__tests__/route.test.ts
git commit -m "feat(api): add pausalni projections endpoint

- GET /api/pausalni/projections returns threshold status
- Includes YTD revenue, projection, days remaining
- Restricted to OBRT_PAUSAL companies only"
```

---

## Task 4: Integrate Alert Banner into Dashboard

**Files:**

- Modify: `src/app/(app)/pausalni/page.tsx`
- Modify: `src/components/pausalni/pausalni-dashboard.tsx`

**Step 1: Update the pausalni page server component**

Edit `src/app/(app)/pausalni/page.tsx` to calculate threshold data:

Add after line 39 (after `ytdRevenueCents` calculation):

```typescript
// Calculate threshold intelligence
import {
  calculateThresholdStatus,
  projectAnnualRevenue,
  getDaysElapsedInYear,
  getDaysRemainingInYear,
} from "@/lib/pausalni/threshold-intelligence"

// ... existing code ...

// After ytdRevenueCents calculation, add:
const thresholdStatus = calculateThresholdStatus(ytdRevenueCents, pausalLimitCents)
const daysElapsed = getDaysElapsedInYear()
const daysRemaining = getDaysRemainingInYear()
const projectedAnnualCents = projectAnnualRevenue(ytdRevenueCents, daysElapsed)
```

Update the return statement to pass new props:

```typescript
return (
  <PausalniDashboard
    companyId={company.id}
    companyName={company.name}
    complianceStatus={complianceStatus}
    ytdRevenueCents={ytdRevenueCents}
    pausalLimitCents={pausalLimitCents}
    year={year}
    lastUpdated={lastInvoice?.createdAt || new Date()}
    deadlines={deadlines}
    thresholdStatus={thresholdStatus}
    projectedAnnualCents={projectedAnnualCents}
    daysRemaining={daysRemaining}
  />
)
```

**Step 2: Update the dashboard component**

Edit `src/components/pausalni/pausalni-dashboard.tsx`:

Add import at top:

```typescript
import { ThresholdAlertBanner } from "./threshold-alert-banner"
import type { ThresholdStatus } from "@/lib/pausalni/threshold-intelligence"
```

Update Props interface:

```typescript
interface Props {
  companyId: string
  companyName: string
  complianceStatus: ComplianceStatus
  ytdRevenueCents: number
  pausalLimitCents: number
  year: number
  lastUpdated: Date
  deadlines: Deadline[]
  thresholdStatus: ThresholdStatus
  projectedAnnualCents: number
  daysRemaining: number
}
```

Add to function parameters:

```typescript
export function PausalniDashboard({
  companyId,
  companyName,
  complianceStatus,
  ytdRevenueCents,
  pausalLimitCents,
  year,
  lastUpdated,
  deadlines,
  thresholdStatus,
  projectedAnnualCents,
  daysRemaining,
}: Props) {
```

Add banner after header, before ComplianceStatusCard (around line 135):

```typescript
{/* Threshold Alert Banner - shows when approaching/exceeding threshold */}
<ThresholdAlertBanner
  status={thresholdStatus.status}
  percentage={thresholdStatus.percentage}
  currentCents={thresholdStatus.currentCents}
  limitCents={thresholdStatus.limitCents}
  projectedAnnualCents={projectedAnnualCents}
  daysRemaining={daysRemaining}
/>
```

**Step 3: Run existing tests**

Run: `npx pnpm test src/components/pausalni/`
Expected: PASS (existing tests should still pass)

**Step 4: Run full build to verify**

Run: `npx pnpm build`
Expected: Build successful

**Step 5: Commit**

```bash
git add src/app/(app)/pausalni/page.tsx src/components/pausalni/pausalni-dashboard.tsx
git commit -m "feat(pausalni): integrate threshold alert banner into dashboard

- Calculate threshold status in server component
- Pass threshold data to dashboard client component
- Display alert banner when approaching/exceeding 60k threshold"
```

---

## Task 5: Add Threshold Detail Page

**Files:**

- Create: `src/app/(app)/pausalni/threshold/page.tsx`

**Step 1: Create the threshold detail page**

Create `src/app/(app)/pausalni/threshold/page.tsx`:

```typescript
import { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { db } from "@/lib/db"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import {
  calculateThresholdStatus,
  projectAnnualRevenue,
  getDaysElapsedInYear,
  getDaysRemainingInYear,
  getPausalniLimitCents,
} from "@/lib/pausalni/threshold-intelligence"

export const metadata: Metadata = {
  title: "Praćenje praga 60.000 € | FiskAI",
  description: "Detaljan pregled vašeg prihoda u odnosu na prag za paušalno oporezivanje",
}

export default async function ThresholdPage() {
  const user = await requireAuth()
  const company = await requireCompany(user.id!)

  if (company.legalForm !== "OBRT_PAUSAL") {
    redirect("/")
  }

  const year = new Date().getFullYear()
  const limitCents = getPausalniLimitCents(year)

  // Get YTD revenue
  const ytdRevenueResult = await db.eInvoice.aggregate({
    where: {
      companyId: company.id,
      status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      createdAt: {
        gte: new Date(year, 0, 1),
      },
    },
    _sum: { totalAmount: true },
  })

  const currentCents = Math.round(Number(ytdRevenueResult._sum.totalAmount || 0) * 100)
  const thresholdStatus = calculateThresholdStatus(currentCents, limitCents)
  const daysElapsed = getDaysElapsedInYear()
  const daysRemaining = getDaysRemainingInYear()
  const projectedAnnualCents = projectAnnualRevenue(currentCents, daysElapsed)

  // Get monthly breakdown
  const monthlyData = await db.eInvoice.groupBy({
    by: ["createdAt"],
    where: {
      companyId: company.id,
      status: { in: ["FISCALIZED", "SENT", "DELIVERED", "ACCEPTED"] },
      createdAt: {
        gte: new Date(year, 0, 1),
      },
    },
    _sum: { totalAmount: true },
  })

  const formatEur = (cents: number) =>
    (cents / 100).toLocaleString("hr-HR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })

  const statusVariant = {
    safe: "secondary",
    attention: "secondary",
    warning: "warning",
    critical: "destructive",
    exceeded: "destructive",
  } as const

  const statusLabel = {
    safe: "U redu",
    attention: "50% praga",
    warning: "75% praga",
    critical: "90% praga",
    exceeded: "Prag premašen",
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pausalni">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Natrag
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Praćenje praga 60.000 €</h1>
          <p className="text-muted-foreground">Godina {year}</p>
        </div>
      </div>

      {/* Main Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Trenutni status</CardTitle>
            <Badge variant={statusVariant[thresholdStatus.status]}>
              {statusLabel[thresholdStatus.status]}
            </Badge>
          </div>
          <CardDescription>
            Prihod u odnosu na godišnji prag od 60.000 €
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Ostvareno: {formatEur(currentCents)} €</span>
              <span className="font-medium">{thresholdStatus.percentage.toFixed(1)}%</span>
            </div>
            <ProgressBar
              value={Math.min(thresholdStatus.percentage, 100)}
              variant={
                thresholdStatus.status === "exceeded" || thresholdStatus.status === "critical"
                  ? "danger"
                  : thresholdStatus.status === "warning"
                    ? "warning"
                    : "default"
              }
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0 €</span>
              <span>60.000 €</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Projekcija za godinu
              </div>
              <div className="mt-2 text-2xl font-bold">
                {formatEur(projectedAnnualCents)} €
              </div>
              {projectedAnnualCents > limitCents && (
                <p className="text-sm text-destructive mt-1">
                  Projicirano prelaženje praga za {formatEur(projectedAnnualCents - limitCents)} €
                </p>
              )}
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Preostalo dana
              </div>
              <div className="mt-2 text-2xl font-bold">{daysRemaining}</div>
              <p className="text-sm text-muted-foreground mt-1">
                do kraja {year}. godine
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {thresholdStatus.remainingCents > 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                )}
                Preostalo do praga
              </div>
              <div className="mt-2 text-2xl font-bold">
                {thresholdStatus.remainingCents > 0
                  ? `${formatEur(thresholdStatus.remainingCents)} €`
                  : "Premašeno"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Happens If You Exceed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Što ako pređem prag?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Ako vaš godišnji primitak prijeđe 60.000 €, dužni ste:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>
              <strong>Prijeći na oporezivanje po stvarnom dohotku</strong> - od sljedeće godine
              vodite poslovne knjige i obračunavate porez na stvarnu dobit.
            </li>
            <li>
              <strong>Upisati se u sustav PDV-a</strong> - ako premašite prag, obvezni ste se
              upisati u registar obveznika PDV-a.
            </li>
            <li>
              <strong>Podnijeti prijavu Poreznoj upravi</strong> - u roku od 8 dana od dana
              prelaska praga.
            </li>
          </ol>
          <div className="flex gap-3 pt-4">
            <Button variant="outline" asChild>
              <Link href="/alati/posd-kalkulator">
                Kalkulator prelaska
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/pausalno_oporezivanje.aspx" target="_blank">
                Službene informacije
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Run build to verify**

Run: `npx pnpm build`
Expected: Build successful

**Step 3: Commit**

```bash
git add src/app/(app)/pausalni/threshold/page.tsx
git commit -m "feat(pausalni): add threshold detail page

- Shows detailed threshold progress with projections
- Displays what happens if threshold is exceeded
- Links to calculator and official resources"
```

---

## Task 6: Add Alert Type Extensions

**Files:**

- Modify: `src/lib/admin/alerts.ts`

**Step 1: Extend AlertType**

Edit `src/lib/admin/alerts.ts`, update the AlertType:

```typescript
export type AlertType =
  | "onboarding-stuck"
  | "approaching-limit"
  | "critical-limit"
  | "cert-expiring"
  | "cert-expired"
  | "inactive"
  | "support-ticket"
  // New threshold intelligence types
  | "threshold-50"
  | "threshold-75"
  | "threshold-90"
  | "threshold-exceeded"
```

**Step 2: Run lint**

Run: `npx pnpm lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/admin/alerts.ts
git commit -m "feat(alerts): add threshold intelligence alert types

- threshold-50: 50% of pausalni limit reached
- threshold-75: 75% of pausalni limit reached
- threshold-90: 90% of pausalni limit reached
- threshold-exceeded: pausalni limit exceeded"
```

---

## Task 7: Final Integration Test

**Step 1: Run all tests**

Run: `npx pnpm test`
Expected: All tests pass

**Step 2: Run lint and typecheck**

Run: `npx pnpm lint && npx pnpm typecheck`
Expected: No errors

**Step 3: Run build**

Run: `npx pnpm build`
Expected: Build successful

**Step 4: Manual verification checklist**

- [ ] Navigate to `/pausalni` as OBRT_PAUSAL user
- [ ] Verify threshold alert banner appears when revenue >= 50%
- [ ] Verify progress bar shows correct percentage
- [ ] Click through to `/pausalni/threshold` detail page
- [ ] Verify projection calculation is reasonable
- [ ] Verify "What happens next" section displays

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat(pausalni): complete Sprint 1.1 Threshold Intelligence

Sprint 1.1 complete:
- Real-time 60,000€ threshold tracker with visual progress bar
- Smart alerts at 50%, 75%, 90%, 100% of threshold
- Monthly income projections based on current trajectory
- 'What happens next' guidance when approaching/exceeding threshold

Gate: User can see their YTD progress, receives proactive alerts,
understands consequences of exceeding threshold."
```

---

## Summary

| Task | Files                                                | Purpose                |
| ---- | ---------------------------------------------------- | ---------------------- |
| 1    | `src/lib/pausalni/threshold-intelligence.ts`         | Core calculation logic |
| 2    | `src/components/pausalni/threshold-alert-banner.tsx` | Alert banner UI        |
| 3    | `src/app/api/pausalni/projections/route.ts`          | API endpoint           |
| 4    | `page.tsx` + `pausalni-dashboard.tsx`                | Integration            |
| 5    | `src/app/(app)/pausalni/threshold/page.tsx`          | Detail page            |
| 6    | `src/lib/admin/alerts.ts`                            | Alert types            |
| 7    | -                                                    | Final verification     |

**Total commits:** 7
**Estimated time:** 2-3 hours

---

Plan complete and saved to `docs/plans/2026-02-01-sprint-1-1-threshold-intelligence.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
