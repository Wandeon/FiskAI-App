# Phase 4: Sidebar & Notifications - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add checklist mini-view to sidebar, integrate checklist items into notification center, and implement email digest system.

**Prerequisites:** Phase 1-3 complete (schema, API, UI, context)

**Existing Infrastructure:**

- Sidebar: `src/components/layout/sidebar.tsx` - collapsible with user profile card
- Notifications: `src/lib/notifications.ts` - generates feed from multiple sources
- Notification Center: `src/components/ui/notification-center.tsx` - bell icon + dropdown
- Email: `src/lib/email.ts` - Resend + React Email templates
- Cron: `src/app/api/cron/deadline-reminders/route.ts` - existing job pattern

---

## Task 4.1: Create Sidebar Checklist Mini-View Component

**Files:**

- Create: `src/components/guidance/ChecklistMiniView.tsx`
- Update: `src/components/guidance/index.ts`

**Step 1: Create the component**

```typescript
// src/components/guidance/ChecklistMiniView.tsx
"use client"

import { useState, useEffect } from "react"
import { CheckCircle2, Circle, ChevronRight, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface ChecklistStats {
  total: number
  completed: number
  critical: number
  soon: number
}

interface ChecklistMiniViewProps {
  collapsed?: boolean
  className?: string
}

export function ChecklistMiniView({ collapsed = false, className }: ChecklistMiniViewProps) {
  const [stats, setStats] = useState<ChecklistStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/guidance/checklist")
        if (res.ok) {
          const data = await res.json()
          const items = data.items || []
          setStats({
            total: items.length,
            completed: items.filter((i: any) => i.completedAt).length,
            critical: items.filter((i: any) => i.urgency === "critical" && !i.completedAt).length,
            soon: items.filter((i: any) => i.urgency === "soon" && !i.completedAt).length,
          })
        }
      } catch (error) {
        console.error("Failed to fetch checklist stats:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const pending = stats ? stats.total - stats.completed : 0
  const progress = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

  if (collapsed) {
    // Collapsed mini icon view
    return (
      <Link
        href="/checklist"
        className={cn(
          "relative flex items-center justify-center rounded-xl p-2 transition-colors",
          "hover:bg-white/5",
          pending > 0 ? "text-amber-400" : "text-emerald-400",
          className
        )}
        title={`${pending} zadataka`}
      >
        <ListTodo className="h-5 w-5" />
        {pending > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
            {pending > 9 ? "9+" : pending}
          </span>
        )}
      </Link>
    )
  }

  // Expanded view
  return (
    <div className={cn("rounded-2xl surface-glass p-3", className)}>
      <Link
        href="/checklist"
        className="flex items-center justify-between group"
      >
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-[var(--muted)]" />
          <span className="text-sm font-medium text-[var(--foreground)]">Zadaci</span>
        </div>
        <ChevronRight className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors" />
      </Link>

      {isLoading ? (
        <div className="mt-3 h-2 rounded-full bg-white/5 animate-pulse" />
      ) : stats ? (
        <>
          {/* Progress bar */}
          <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress === 100 ? "bg-emerald-500" : "bg-brand-500"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[var(--muted)]">
              {stats.completed}/{stats.total} dovršeno
            </span>
            <span className={cn(
              "font-medium",
              progress === 100 ? "text-emerald-400" : "text-[var(--foreground)]"
            )}>
              {progress}%
            </span>
          </div>

          {/* Urgency indicators */}
          {(stats.critical > 0 || stats.soon > 0) && (
            <div className="mt-2 flex gap-2">
              {stats.critical > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-red-400">
                  <Circle className="h-2 w-2 fill-red-400" />
                  {stats.critical} hitno
                </span>
              )}
              {stats.soon > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                  <Circle className="h-2 w-2 fill-amber-400" />
                  {stats.soon} uskoro
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-[var(--muted)]">Nema podataka</p>
      )}
    </div>
  )
}
```

**Step 2: Update exports**

Add to `src/components/guidance/index.ts`:

```typescript
export * from "./ChecklistMiniView"
```

**Step 3: Commit**

```bash
git add src/components/guidance/
git commit -m "feat(guidance): add ChecklistMiniView component for sidebar"
```

---

## Task 4.2: Add Mini-View to Sidebar

**Files:**

- Modify: `src/components/layout/sidebar.tsx`

**Step 1: Add import**

```typescript
import { ChecklistMiniView } from "@/components/guidance"
```

**Step 2: Add ChecklistMiniView to sidebar**

Find the profile card section and add the mini-view after it:

```tsx
{
  /* After profile card, before navigation */
}
;<ChecklistMiniView collapsed={collapsed} className="mt-4" />
```

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(guidance): add ChecklistMiniView to sidebar"
```

---

## Task 4.3: Integrate Checklist into Notification Feed

**Files:**

- Modify: `src/lib/notifications.ts`

**Step 1: Import checklist utilities**

```typescript
import { getChecklistItems } from "@/lib/guidance/checklist"
```

**Step 2: Add checklist notifications to feed**

In the `getNotificationFeed` function, add checklist items:

```typescript
// Add after existing notification sources

// Checklist deadlines
try {
  const checklistItems = await getChecklistItems(companyId)
  const urgentItems = checklistItems.filter(
    (item) =>
      !item.completedAt &&
      !item.dismissedAt &&
      (item.urgency === "critical" || item.urgency === "soon")
  )

  for (const item of urgentItems.slice(0, 3)) {
    const isOverdue = item.urgency === "critical"
    alerts.push({
      id: `checklist-${item.id}`,
      type: isOverdue ? "warning" : "info",
      title: item.title,
      description: item.description,
      timestamp: item.dueDate ? formatRelativeDate(new Date(item.dueDate)) : undefined,
      action: item.action?.href
        ? { label: "Otvori", href: item.action.href }
        : { label: "Pogledaj", href: "/checklist" },
    })
  }
} catch (error) {
  console.error("Failed to fetch checklist for notifications:", error)
}
```

**Step 3: Add helper function if needed**

```typescript
function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return `${Math.abs(diffDays)} dana kasni`
  if (diffDays === 0) return "Danas"
  if (diffDays === 1) return "Sutra"
  return `Za ${diffDays} dana`
}
```

**Step 4: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat(guidance): integrate checklist items into notification feed"
```

---

## Task 4.4: Create Email Digest Template

**Files:**

- Create: `src/lib/email/templates/checklist-digest-email.tsx`

**Step 1: Create the template**

```typescript
// src/lib/email/templates/checklist-digest-email.tsx
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components"

interface ChecklistDigestItem {
  title: string
  description?: string
  dueDate?: string
  urgency: "critical" | "soon" | "upcoming" | "optional"
  href?: string
}

interface ChecklistDigestEmailProps {
  userName?: string
  companyName: string
  period: "daily" | "weekly"
  items: ChecklistDigestItem[]
  completedCount: number
  dashboardUrl: string
}

const urgencyColors = {
  critical: "#ef4444",
  soon: "#f59e0b",
  upcoming: "#3b82f6",
  optional: "#6b7280",
}

const urgencyLabels = {
  critical: "Hitno",
  soon: "Uskoro",
  upcoming: "Nadolazeće",
  optional: "Opcionalno",
}

export default function ChecklistDigestEmail({
  userName,
  companyName,
  period,
  items,
  completedCount,
  dashboardUrl,
}: ChecklistDigestEmailProps) {
  const periodLabel = period === "daily" ? "Dnevni" : "Tjedni"
  const previewText = `${periodLabel} pregled: ${items.length} zadataka za ${companyName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>
            {periodLabel} pregled zadataka
          </Heading>

          <Text style={paragraph}>
            {userName ? `Pozdrav ${userName},` : "Pozdrav,"}
          </Text>

          <Text style={paragraph}>
            Evo pregleda vaših obveza za <strong>{companyName}</strong>.
          </Text>

          {completedCount > 0 && (
            <Section style={successBox}>
              <Text style={successText}>
                ✓ Dovršili ste {completedCount} zadataka{" "}
                {period === "daily" ? "danas" : "ovaj tjedan"}!
              </Text>
            </Section>
          )}

          {items.length > 0 ? (
            <>
              <Heading as="h2" style={subheading}>
                Zadaci koji zahtijevaju pažnju ({items.length})
              </Heading>

              {items.map((item, index) => (
                <Section key={index} style={itemBox}>
                  <div style={itemHeader}>
                    <span
                      style={{
                        ...urgencyBadge,
                        backgroundColor: urgencyColors[item.urgency],
                      }}
                    >
                      {urgencyLabels[item.urgency]}
                    </span>
                    {item.dueDate && (
                      <span style={dueDateText}>{item.dueDate}</span>
                    )}
                  </div>
                  <Text style={itemTitle}>{item.title}</Text>
                  {item.description && (
                    <Text style={itemDescription}>{item.description}</Text>
                  )}
                  {item.href && (
                    <Link href={item.href} style={itemLink}>
                      Otvori →
                    </Link>
                  )}
                </Section>
              ))}
            </>
          ) : (
            <Section style={emptyBox}>
              <Text style={emptyText}>
                🎉 Sve je pod kontrolom! Nemate hitnih zadataka.
              </Text>
            </Section>
          )}

          <Hr style={hr} />

          <Link href={dashboardUrl} style={ctaButton}>
            Otvori kontrolnu ploču
          </Link>

          <Text style={footer}>
            Ovaj email je automatski generiran iz FiskAI sustava.
            <br />
            Postavke obavijesti možete promijeniti u{" "}
            <Link href={`${dashboardUrl}/settings/guidance`} style={footerLink}>
              postavkama
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
}

const heading = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "700",
  textAlign: "center" as const,
  margin: "0 0 24px",
}

const subheading = {
  color: "#0f172a",
  fontSize: "18px",
  fontWeight: "600",
  margin: "24px 0 16px",
}

const paragraph = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
}

const successBox = {
  backgroundColor: "#ecfdf5",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
}

const successText = {
  color: "#059669",
  fontSize: "14px",
  margin: "0",
}

const itemBox = {
  backgroundColor: "#f8fafc",
  borderRadius: "8px",
  padding: "16px",
  margin: "12px 0",
  borderLeft: "4px solid #e2e8f0",
}

const itemHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "8px",
}

const urgencyBadge = {
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: "600",
  padding: "2px 8px",
  borderRadius: "4px",
  textTransform: "uppercase" as const,
}

const dueDateText = {
  color: "#64748b",
  fontSize: "12px",
}

const itemTitle = {
  color: "#0f172a",
  fontSize: "15px",
  fontWeight: "600",
  margin: "0 0 4px",
}

const itemDescription = {
  color: "#64748b",
  fontSize: "13px",
  margin: "0 0 8px",
}

const itemLink = {
  color: "#0ea5e9",
  fontSize: "13px",
  fontWeight: "500",
}

const emptyBox = {
  backgroundColor: "#f0fdf4",
  borderRadius: "8px",
  padding: "24px",
  margin: "24px 0",
  textAlign: "center" as const,
}

const emptyText = {
  color: "#166534",
  fontSize: "16px",
  margin: "0",
}

const hr = {
  borderColor: "#e2e8f0",
  margin: "32px 0",
}

const ctaButton = {
  backgroundColor: "#0ea5e9",
  borderRadius: "8px",
  color: "#ffffff",
  display: "block",
  fontSize: "16px",
  fontWeight: "600",
  padding: "12px 24px",
  textAlign: "center" as const,
  textDecoration: "none",
  margin: "0 auto",
  width: "fit-content",
}

const footer = {
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: "20px",
  textAlign: "center" as const,
  margin: "32px 0 0",
}

const footerLink = {
  color: "#0ea5e9",
}
```

**Step 2: Commit**

```bash
git add src/lib/email/templates/
git commit -m "feat(guidance): add checklist digest email template"
```

---

## Task 4.5: Create Email Digest Cron Job

**Files:**

- Create: `src/app/api/cron/checklist-digest/route.ts`

**Step 1: Create the cron endpoint**

```typescript
// src/app/api/cron/checklist-digest/route.ts
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { drizzleDb } from "@/lib/db/drizzle"
import { userGuidancePreferences } from "@/lib/db/schema/guidance"
import { getChecklistItems } from "@/lib/guidance/checklist"
import { sendEmail } from "@/lib/email"
import ChecklistDigestEmail from "@/lib/email/templates/checklist-digest-email"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const maxDuration = 300 // 5 minutes

/**
 * GET /api/cron/checklist-digest
 *
 * Sends checklist digest emails to users based on their preferences.
 * Run daily at 8:00 AM for daily digests, Mondays for weekly.
 *
 * Protected by CRON_SECRET header.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isMonday = new Date().getDay() === 1
  const digestTypes: ("daily" | "weekly")[] = isMonday ? ["daily", "weekly"] : ["daily"]

  let sent = 0
  let errors = 0

  try {
    // Get all users with their guidance preferences
    const users = await db.user.findMany({
      where: {
        emailVerified: { not: null },
      },
      include: {
        companies: {
          where: { role: { in: ["OWNER", "ADMIN"] } },
          include: { company: true },
        },
      },
    })

    for (const user of users) {
      // Get user's guidance preferences
      const [prefs] = await drizzleDb
        .select()
        .from(userGuidancePreferences)
        .where(eq(userGuidancePreferences.userId, user.id))
        .limit(1)

      // Skip if user disabled email digest
      const digestPref = prefs?.emailDigest || "weekly"
      if (digestPref === "none") continue
      if (!digestTypes.includes(digestPref)) continue

      // Process each company the user manages
      for (const companyUser of user.companies) {
        try {
          const items = await getChecklistItems(companyUser.companyId)

          // Filter pending urgent items
          const pendingItems = items
            .filter((item) => !item.completedAt && !item.dismissedAt)
            .filter(
              (item) =>
                item.urgency === "critical" ||
                item.urgency === "soon" ||
                (digestPref === "weekly" && item.urgency === "upcoming")
            )
            .slice(0, 10)
            .map((item) => ({
              title: item.title,
              description: item.description,
              dueDate: item.dueDate
                ? new Date(item.dueDate).toLocaleDateString("hr-HR")
                : undefined,
              urgency: item.urgency,
              href: item.action?.href
                ? `${process.env.NEXTAUTH_URL}${item.action.href}`
                : undefined,
            }))

          // Count completed items in the period
          const periodStart =
            digestPref === "daily"
              ? new Date(Date.now() - 24 * 60 * 60 * 1000)
              : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

          const completedCount = items.filter(
            (item) => item.completedAt && new Date(item.completedAt) >= periodStart
          ).length

          // Skip if no items to report and no completions
          if (pendingItems.length === 0 && completedCount === 0) continue

          const baseUrl = process.env.NEXTAUTH_URL || "https://app.fiskai.hr"

          await sendEmail({
            to: user.email,
            subject: `[FiskAI] ${digestPref === "daily" ? "Dnevni" : "Tjedni"} pregled zadataka - ${companyUser.company.name}`,
            react: ChecklistDigestEmail({
              userName: user.name || undefined,
              companyName: companyUser.company.name,
              period: digestPref,
              items: pendingItems,
              completedCount,
              dashboardUrl: `${baseUrl}/dashboard`,
            }),
          })

          sent++
        } catch (err) {
          console.error(
            `Failed to send digest to ${user.email} for company ${companyUser.companyId}:`,
            err
          )
          errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      errors,
      digestTypes,
    })
  } catch (error) {
    console.error("Checklist digest cron error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/
git commit -m "feat(guidance): add checklist digest cron job"
```

---

## Task 4.6: Add Digest Settings to Guidance Settings Page

**Files:**

- Modify: `src/app/(dashboard)/settings/guidance/GuidanceSettingsClient.tsx`

**Step 1: Add email digest section**

After the competence level section, add:

```tsx
{
  /* Email Digest Settings */
}
;<GlassCard>
  <div className="flex items-center gap-3 mb-4">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10">
      <Mail className="h-5 w-5 text-brand-400" />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-white">Email obavijesti</h3>
      <p className="text-sm text-white/60">Primajte preglede zadataka na email</p>
    </div>
  </div>

  <div className="space-y-3">
    {[
      { value: "daily", label: "Dnevno", description: "Svaki dan u 8:00" },
      { value: "weekly", label: "Tjedno", description: "Svaki ponedjeljak u 8:00" },
      { value: "none", label: "Nikada", description: "Ne šalji email obavijesti" },
    ].map((option) => (
      <button
        key={option.value}
        onClick={() => handleEmailDigestChange(option.value as "daily" | "weekly" | "none")}
        className={cn(
          "w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all",
          preferences?.emailDigest === option.value
            ? "bg-brand-500/20 border border-brand-500/30"
            : "bg-white/5 border border-white/10 hover:bg-white/10"
        )}
      >
        <div className="text-left">
          <div className="font-medium text-white">{option.label}</div>
          <div className="text-sm text-white/60">{option.description}</div>
        </div>
        {preferences?.emailDigest === option.value && <Check className="h-5 w-5 text-brand-400" />}
      </button>
    ))}
  </div>
</GlassCard>
```

**Step 2: Add handler function**

```typescript
const handleEmailDigestChange = async (value: "daily" | "weekly" | "none") => {
  try {
    const res = await fetch("/api/guidance/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailDigest: value }),
    })
    if (res.ok) {
      const data = await res.json()
      setPreferences(data.preferences)
      toast.success("Postavke spremljene")
    }
  } catch (error) {
    toast.error("Greška pri spremanju")
  }
}
```

**Step 3: Add Mail and Check imports**

```typescript
import { Mail, Check } from "lucide-react"
```

**Step 4: Commit**

```bash
git add src/app/(dashboard)/settings/guidance/
git commit -m "feat(guidance): add email digest settings to guidance settings page"
```

---

## Task 4.7: Build Verification and Push

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
git commit -m "feat(guidance): complete Phase 4 - Sidebar & Notifications"
git push origin main
```

---

## Quick Reference

**New files created:**

- `src/components/guidance/ChecklistMiniView.tsx` - Sidebar widget
- `src/lib/email/templates/checklist-digest-email.tsx` - Email template
- `src/app/api/cron/checklist-digest/route.ts` - Cron job

**Modified files:**

- `src/components/layout/sidebar.tsx` - Added mini-view
- `src/lib/notifications.ts` - Added checklist to feed
- `src/components/guidance/index.ts` - New exports
- `src/app/(dashboard)/settings/guidance/GuidanceSettingsClient.tsx` - Email settings

**Cron schedule (configure in hosting):**

- Daily at 8:00 AM: `0 8 * * *`
- Triggers both daily and weekly (Monday) digests

**Email digest behavior:**

- Daily: Critical + Soon items
- Weekly: Critical + Soon + Upcoming items
- Includes completion stats for motivation
