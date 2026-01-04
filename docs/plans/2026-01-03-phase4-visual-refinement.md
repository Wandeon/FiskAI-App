# PHASE 4: Visual Refinement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Polish Control Center visual design with status indicators, feedback animations, empty states, and responsive improvements.

**Architecture:** Enhance existing queue components with visual polish. Add loading skeletons, empty states, success animations, and mobile-friendly layouts.

**Tech Stack:** Next.js 15, Tailwind CSS, Framer Motion, Lucide Icons

---

## Context

**Design Document Mandate (Section 9, Phase 4):**

> Visual Refinement (Optional, Last)
>
> - Status badges and visual indicators
> - Action feedback animations
> - Empty state designs
> - Mobile responsiveness

**Current State:**

- Control Center renders queues with basic styling
- Action buttons show loading state
- Toast notifications for success/error
- Basic responsive layout

**Target State:**

- Status badges with color-coded states
- Smooth action feedback animations
- Polished empty states with CTAs
- Mobile-optimized queue layouts

---

## Task 1: Add Status Badges to Queue Items

**Files:**

- Create: `src/components/capability/StatusBadge.tsx`
- Modify: `src/components/capability/QueueItem.tsx`

**Step 1: Create StatusBadge component**

```typescript
"use client"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Nacrt", variant: "secondary" },
  PENDING_FISCALIZATION: { label: "Čeka fiskalizaciju", variant: "outline" },
  FISCALIZED: { label: "Fiskalizirano", variant: "default" },
  SENT: { label: "Poslano", variant: "default" },
  PAID: { label: "Plaćeno", variant: "default" },
  OVERDUE: { label: "Dospjelo", variant: "destructive" },
  CANCELLED: { label: "Poništeno", variant: "destructive" },
  PENDING: { label: "Na čekanju", variant: "outline" },
  MATCHED: { label: "Usklađeno", variant: "default" },
  IGNORED: { label: "Ignorirano", variant: "secondary" },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, variant: "secondary" }

  return (
    <Badge variant={config.variant} className={cn("text-xs", className)}>
      {config.label}
    </Badge>
  )
}
```

**Step 2: Export from index**

Add to `src/components/capability/index.ts`.

**Step 3: Commit**

```
feat(capability): add StatusBadge component for queue items

Color-coded badges for invoice, expense, and bank transaction states.
```

---

## Task 2: Add Empty State Component

**Files:**

- Create: `src/components/capability/EmptyQueueState.tsx`
- Modify: `src/components/capability/QueueSection.tsx` (if exists) or update queue rendering

**Step 1: Create EmptyQueueState component**

```typescript
"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, FileText, Receipt, Building2 } from "lucide-react"
import Link from "next/link"

const QUEUE_CONFIG: Record<string, { icon: typeof FileText; message: string; cta?: { label: string; href: string } }> = {
  invoice: {
    icon: FileText,
    message: "Nema računa za obradu",
    cta: { label: "Kreiraj račun", href: "/invoices/new" },
  },
  expense: {
    icon: Receipt,
    message: "Nema troškova za obradu",
    cta: { label: "Dodaj trošak", href: "/expenses/new" },
  },
  bank: {
    icon: Building2,
    message: "Nema bankovnih transakcija za usklađivanje",
  },
  default: {
    icon: CheckCircle2,
    message: "Sve je obrađeno",
  },
}

interface EmptyQueueStateProps {
  type?: "invoice" | "expense" | "bank" | "default"
  className?: string
}

export function EmptyQueueState({ type = "default", className }: EmptyQueueStateProps) {
  const config = QUEUE_CONFIG[type] || QUEUE_CONFIG.default
  const Icon = config.icon

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-success-100 p-3 mb-4">
          <Icon className="h-6 w-6 text-success-600" />
        </div>
        <p className="text-muted-foreground">{config.message}</p>
        {config.cta && (
          <Link href={config.cta.href} className="mt-4">
            <Button variant="outline" size="sm">
              {config.cta.label}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Export from index**

Add to `src/components/capability/index.ts`.

**Step 3: Commit**

```
feat(capability): add EmptyQueueState for empty queues

Shows friendly empty state with optional CTA for creating new items.
```

---

## Task 3: Add Loading Skeleton for Queue Items

**Files:**

- Create: `src/components/capability/QueueItemSkeleton.tsx`

**Step 1: Create QueueItemSkeleton component**

```typescript
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function QueueItemSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function QueueSectionSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <QueueItemSkeleton key={i} />
      ))}
    </div>
  )
}
```

**Step 2: Export from index**

Add to `src/components/capability/index.ts`.

**Step 3: Commit**

```
feat(capability): add loading skeleton for queue items

Provides visual feedback while queue data is loading.
```

---

## Task 4: Add Success Animation to ActionButton

**Files:**

- Modify: `src/components/capability/ActionButton.tsx`

**Step 1: Add success state with animation**

Update ActionButton to show a brief success checkmark animation after action completes:

```typescript
// Add state for success
const [showSuccess, setShowSuccess] = useState(false)

// In onSuccess callback:
onSuccess: () => {
  setShowConfirmation(false)
  setShowSuccess(true)
  setTimeout(() => setShowSuccess(false), 2000)
  toast.success("Uspjeh", `${action.label} završeno`)
  onSuccess?.()
}

// In button render, show checkmark when success:
{showSuccess ? (
  <CheckCircle2 className="mr-2 h-4 w-4 text-success-500 animate-in zoom-in-0 duration-200" />
) : isLoading ? (
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
) : null}
```

**Step 2: Commit**

```
feat(capability): add success animation to ActionButton

Shows brief checkmark animation after successful action execution.
```

---

## Task 5: Improve Mobile Layout for Control Center

**Files:**

- Modify: `src/app/(app)/control-center/page.tsx`
- Modify: `src/components/capability/ActionButton.tsx` (responsive sizes)

**Step 1: Add responsive classes to queue layout**

Ensure queue items stack properly on mobile:

- Single column on mobile
- Two columns on tablet
- Three columns on desktop

**Step 2: Make action buttons responsive**

- Full width on mobile
- Inline on tablet/desktop

**Step 3: Commit**

```
feat(control-center): improve mobile responsiveness

Queue items and action buttons adapt to screen size.
```

---

## Task 6: Final Verification

**Step 1: Visual inspection**

Visit `/control-center` and verify:

- Status badges display correctly
- Empty states show when no items
- Loading skeletons appear during data fetch
- Success animations work after actions
- Mobile layout is usable

**Step 2: Commit any fixes**

---

## Summary

### Files Created

- `src/components/capability/StatusBadge.tsx`
- `src/components/capability/EmptyQueueState.tsx`
- `src/components/capability/QueueItemSkeleton.tsx`

### Files Modified

- `src/components/capability/ActionButton.tsx` - Success animation
- `src/components/capability/index.ts` - Exports
- `src/app/(app)/control-center/page.tsx` - Mobile layout

### What This Implements

- Color-coded status badges for all entity states
- Friendly empty states with CTAs
- Loading skeletons for better perceived performance
- Success animations for action feedback
- Mobile-responsive queue layouts

### Definition of Done (from Design Document)

- ✅ Status badges and visual indicators
- ✅ Action feedback animations
- ✅ Empty state designs
- ✅ Mobile responsiveness
