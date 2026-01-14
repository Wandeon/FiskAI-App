# Guidance System

[← Back to Index](./00-INDEX.md)

---

## 14. Guidance System Overview

> **Last Audit:** 2026-01-14 | **Status:** Implemented & Verified

The Guidance System is FiskAI's adaptive help and task management layer that personalizes the user experience based on competence levels. It reduces cognitive load for beginners while providing efficiency for experienced users.

**Architecture Status:** Fully implemented with React Context, Help Density configs, Pattern Detection AI, and Email Digest system.

### 14.1 System Purpose & User Benefit

**Problem Solved:** New business owners are overwhelmed by accounting software, while experienced users find excessive hand-holding annoying.

**Solution:** A three-tier competence system that adapts:

- **UI Complexity** - Show/hide tooltips, confirmations, explanations
- **Notification Frequency** - More reminders for beginners, fewer for pros
- **Checklist Visibility** - Comprehensive for beginners, minimal for pros
- **Help Density** - Full guidance vs. minimal interface

**Key Benefits:**

| Persona          | Benefit                                                           |
| ---------------- | ----------------------------------------------------------------- |
| Marko (Beginner) | Step-by-step guidance, frequent reminders, full explanations      |
| Ana (Average)    | Balanced interface, key reminders only, context when needed       |
| Ivan (Pro)       | Clean interface, keyboard shortcuts visible, critical alerts only |

### 14.2 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      GUIDANCE SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│  PREFERENCE LAYER                                                │
│  ├── User Preferences (DB: user_guidance_preferences)           │
│  ├── Per-Category Levels (fakturiranje, financije, eu)          │
│  └── Global Level Override                                       │
├─────────────────────────────────────────────────────────────────┤
│  HELP DENSITY LAYER                                              │
│  ├── Field Tooltips (all/key/none)                              │
│  ├── Action Confirmations (always/destructive/never)            │
│  ├── Success Explanations (detailed/brief/toast)                │
│  └── Keyboard Shortcuts (hidden/hover/visible)                  │
├─────────────────────────────────────────────────────────────────┤
│  CHECKLIST LAYER                                                 │
│  ├── Payment Obligations                                         │
│  ├── Compliance Deadlines                                        │
│  ├── Onboarding Tasks                                            │
│  ├── Seasonal Tasks                                              │
│  └── AI-Detected Patterns (Suggestions)                         │
├─────────────────────────────────────────────────────────────────┤
│  INSIGHTS LAYER (AI-Powered)                                     │
│  ├── Invoice Reminders ("You usually invoice X around now")     │
│  ├── Expense Patterns ("Spending 50% higher than usual")        │
│  └── Revenue Trends ("Revenue down 20% vs last quarter")        │
└─────────────────────────────────────────────────────────────────┘
```

**File Locations:**

| Component        | Location                                          |
| ---------------- | ------------------------------------------------- |
| Core Library     | `/src/lib/guidance/`                              |
| API Routes       | `/src/app/api/guidance/`                          |
| Components       | `/src/components/guidance/`                       |
| Settings Page    | `/src/app/(app)/settings/guidance/`               |
| DB Schema        | `/src/lib/db/schema/guidance.ts`                  |
| Context Provider | `/src/contexts/GuidanceContext.tsx`               |
| Types (Shared)   | `/src/lib/types/competence.ts`                    |
| Email Templates  | `/src/lib/email/templates/checklist-digest-*.tsx` |
| Cron Jobs        | `/src/app/api/cron/checklist-digest/`             |

---

## 15. Preference Model

### 15.1 Competence Levels

Users can set their experience level globally or per-category:

| Level      | Croatian Label | Description                                                              |
| ---------- | -------------- | ------------------------------------------------------------------------ |
| `beginner` | Početnik       | Full help: step-by-step guides, tooltips, frequent reminders             |
| `average`  | Srednji        | Balanced: help only for risky actions and new features                   |
| `pro`      | Profesionalac  | Minimal: critical notifications only, fast interface, keyboard shortcuts |

**Implementation:**

```typescript
// src/lib/types/competence.ts (Single Source of Truth)
export const COMPETENCE_LEVELS = {
  BEGINNER: "beginner",
  AVERAGE: "average",
  PRO: "pro",
} as const

export type CompetenceLevel = (typeof COMPETENCE_LEVELS)[keyof typeof COMPETENCE_LEVELS]
```

This type is shared between:

- **Guidance System** (`/src/lib/guidance/constants.ts`) - Re-exports and adds labels
- **Visibility System** (`/src/lib/visibility/rules.ts`) - Uses for progression stage and feature gating
- **Onboarding** (`/src/components/onboarding/step-competence.tsx`) - Captures initial user competence

```typescript
// src/lib/guidance/constants.ts
export const LEVEL_DESCRIPTIONS: Record<CompetenceLevel, string> = {
  beginner: "Puna pomoć: korak-po-korak vodiči, tooltipovi, česti podsjetnici",
  average: "Uravnoteženo: pomoć samo kod rizičnih akcija i novih značajki",
  pro: "Minimalno: samo kritične obavijesti, brzo sučelje, prečaci na tipkovnici",
}
```

### 15.2 Guidance Categories

Competence can be set independently for three business domains:

| Category       | Croatian Label | Covers                                  |
| -------------- | -------------- | --------------------------------------- |
| `fakturiranje` | Fakturiranje   | Invoicing, e-invoices, fiscalization    |
| `financije`    | Financije      | Banking, expenses, contributions, taxes |
| `eu`           | EU poslovanje  | VAT, cross-border transactions          |

**Use Case:** A user might be experienced with invoicing but new to EU regulations.

### 15.3 Database Schema

```typescript
// src/lib/db/schema/guidance.ts
export const userGuidancePreferences = pgTable("user_guidance_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),

  // Per-category levels
  levelFakturiranje: varchar("level_fakturiranje", { length: 20 }).default("beginner"),
  levelFinancije: varchar("level_financije", { length: 20 }).default("beginner"),
  levelEu: varchar("level_eu", { length: 20 }).default("beginner"),

  // Global override (sets all categories)
  globalLevel: varchar("global_level", { length: 20 }),

  // Notification preferences
  emailDigest: varchar("email_digest", { length: 20 }).default("weekly"),
  pushEnabled: boolean("push_enabled").default(true),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
```

### 15.4 Preference Resolution

```typescript
// src/lib/guidance/preferences.ts
export function getEffectiveLevel(
  preferences: UserGuidancePreferences,
  category: GuidanceCategory
): CompetenceLevel {
  // Global level overrides per-category settings
  if (preferences.globalLevel) {
    return preferences.globalLevel as CompetenceLevel
  }

  switch (category) {
    case "fakturiranje":
      return preferences.levelFakturiranje
    case "financije":
      return preferences.levelFinancije
    case "eu":
      return preferences.levelEu
    default:
      return "beginner"
  }
}
```

---

## 16. Help Density Configuration

The help density system controls four UI aspects based on competence level:

### 16.1 Density Matrix

| Aspect                   | Beginner                      | Average                            | Pro                        |
| ------------------------ | ----------------------------- | ---------------------------------- | -------------------------- |
| **Field Tooltips**       | `all` - Every field           | `key` - Important fields only      | `none` - No tooltips       |
| **Action Confirmations** | `always` - All actions        | `destructive` - Delete/cancel only | `never` - No confirmations |
| **Success Explanations** | `detailed` - Full explanation | `brief` - Short message            | `toast` - Just a toast     |
| **Keyboard Shortcuts**   | `hidden` - Not shown          | `hover` - Shown on hover           | `visible` - Always visible |

**Implementation:**

```typescript
// src/lib/guidance/help-density.ts
export interface HelpDensityConfig {
  fieldTooltips: "all" | "key" | "none"
  actionConfirmations: "always" | "destructive" | "never"
  successExplanations: "detailed" | "brief" | "toast"
  keyboardShortcuts: "hidden" | "hover" | "visible"
}

export const HELP_DENSITY: Record<CompetenceLevel, HelpDensityConfig> = {
  beginner: {
    fieldTooltips: "all",
    actionConfirmations: "always",
    successExplanations: "detailed",
    keyboardShortcuts: "hidden",
  },
  average: {
    fieldTooltips: "key",
    actionConfirmations: "destructive",
    successExplanations: "brief",
    keyboardShortcuts: "hover",
  },
  pro: {
    fieldTooltips: "none",
    actionConfirmations: "never",
    successExplanations: "toast",
    keyboardShortcuts: "visible",
  },
}
```

### 16.2 Notification Frequency

Reminder frequency adapts to competence level:

| Level    | Reminder Schedule               |
| -------- | ------------------------------- |
| Beginner | 7 days, 3 days, 1 day, same day |
| Average  | 3 days, 1 day, same day         |
| Pro      | 1 day, same day only            |

```typescript
// src/lib/guidance/preferences.ts
export function getNotificationDays(level: CompetenceLevel): number[] {
  switch (level) {
    case "beginner":
      return [7, 3, 1, 0]
    case "average":
      return [3, 1, 0]
    case "pro":
      return [1, 0]
  }
}
```

### 16.3 Guidance Visibility

Controls which guidance elements appear:

```typescript
// src/lib/guidance/preferences.ts
export function shouldShowGuidance(
  preferences: UserGuidancePreferences,
  category: GuidanceCategory,
  guidanceType: "tooltip" | "wizard" | "notification" | "detailed_help"
): boolean {
  const level = getEffectiveLevel(preferences, category)

  switch (level) {
    case "beginner":
      return true // See everything

    case "average":
      return guidanceType !== "tooltip" // No constant tooltips

    case "pro":
      return guidanceType === "notification" // Critical only
  }
}
```

---

## 17. Checklist System

The checklist aggregates tasks from multiple sources into a unified "What do I need to do?" view.

### 17.1 Checklist Item Types

| Type         | Source                        | Example                              |
| ------------ | ----------------------------- | ------------------------------------ |
| `deadline`   | `complianceDeadlines` table   | "PO-SD due January 15"               |
| `payment`    | `paymentObligation` table     | "MIO I contribution - 107.88 EUR"    |
| `action`     | Draft invoices, pending items | "Complete draft invoice #123"        |
| `onboarding` | Company data gaps             | "Add company OIB and address"        |
| `seasonal`   | Calendar-based tasks          | "Prepare PO-SD form for 2024"        |
| `suggestion` | AI pattern detection          | "Invoice Client X (monthly pattern)" |

### 17.2 Urgency Levels

| Level      | Criteria                 | Visual                |
| ---------- | ------------------------ | --------------------- |
| `critical` | Overdue or due today     | 🔴 Red background     |
| `soon`     | Due within 3 days        | 🟡 Amber background   |
| `upcoming` | Due within 7 days        | 🔵 Blue background    |
| `optional` | Suggestions, no deadline | ⚪ Neutral background |

**Calculation:**

```typescript
// src/lib/guidance/checklist.ts
function calculateUrgency(dueDate: Date | null): UrgencyLevel {
  if (!dueDate) return "optional"

  const daysUntil = Math.ceil((due - today) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) return "critical" // Overdue
  if (daysUntil === 0) return "critical" // Due today
  if (daysUntil <= 3) return "soon"
  if (daysUntil <= 7) return "upcoming"
  return "optional"
}
```

### 17.3 Checklist Interactions

Users can interact with checklist items:

| Action     | Effect                       | Storage                                                     |
| ---------- | ---------------------------- | ----------------------------------------------------------- |
| `complete` | Remove from list permanently | `checklistInteractions` with action="completed"             |
| `dismiss`  | Remove from list permanently | `checklistInteractions` with action="dismissed"             |
| `snooze`   | Hide until specified date    | `checklistInteractions` with action="snoozed", snoozedUntil |

**Database Schema:**

```typescript
// src/lib/db/schema/guidance.ts
export const checklistInteractions = pgTable("checklist_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  companyId: text("company_id").notNull(),

  itemType: varchar("item_type", { length: 50 }).notNull(),
  itemReference: varchar("item_reference", { length: 100 }).notNull(),

  action: varchar("action", { length: 20 }).notNull(),
  snoozedUntil: timestamp("snoozed_until"),

  createdAt: timestamp("created_at").defaultNow(),
})
```

### 17.4 Item Reference Format

Checklist items use a reference pattern for tracking:

| Pattern                      | Example                                  |
| ---------------------------- | ---------------------------------------- |
| `obligation:{id}`            | `obligation:abc123`                      |
| `deadline:{id}`              | `deadline:xyz789`                        |
| `draft_invoice:{id}`         | `draft_invoice:inv456`                   |
| `onboarding:{task}`          | `onboarding:company_data`                |
| `seasonal:{task}:{year}`     | `seasonal:posd:2024`                     |
| `pattern-{type}-{timestamp}` | `pattern-invoice_reminder-1704067200000` |

### 17.5 Checklist Aggregation

The main `getChecklist()` function aggregates from all sources:

```typescript
// src/lib/guidance/checklist.ts
export async function getChecklist(params: GetChecklistParams): Promise<{
  items: ChecklistItem[]
  stats: {
    total: number
    critical: number
    soon: number
    upcoming: number
    optional: number
    byCategory: Record<GuidanceCategory, number>
  }
}> {
  // Get excluded items based on user interactions
  const excludeRefs = await getInteractedReferences(userId, companyId, excludeActions)

  // Aggregate from all sources in parallel
  const [obligations, deadlines, actions, onboarding, seasonal] = await Promise.all([
    getObligationItems(companyId, excludeRefs),
    getDeadlineItems(businessType, excludeRefs),
    getPendingActionItems(companyId, excludeRefs),
    getOnboardingItems(companyId, excludeRefs),
    getSeasonalItems(companyId, businessType, excludeRefs),
  ])

  // Add AI-detected patterns
  const patterns = await getAllPatternInsights(companyId)

  // Sort by urgency, then by due date
  return { items: sortedItems, stats }
}
```

---

## 18. Pattern Insights (AI-Powered)

The pattern detection system analyzes historical data to provide proactive suggestions.

### 18.1 Pattern Types

| Type               | Detection Logic                     | Confidence Threshold       |
| ------------------ | ----------------------------------- | -------------------------- |
| `invoice_reminder` | Monthly invoicing patterns by buyer | Low day variance (<5 days) |
| `expense_pattern`  | Spending anomalies by category      | 50%+ above average         |
| `revenue_trend`    | Revenue changes vs previous months  | 15%+ change                |
| `compliance_risk`  | Approaching thresholds              | 85%+ of limit              |

### 18.2 Invoice Pattern Detection

```typescript
// src/lib/guidance/patterns.ts
export async function detectInvoicePatterns(companyId: string): Promise<PatternInsight[]> {
  // Get invoices from last 6 months
  // Group by buyer
  // Analyze issue day patterns

  // If variance is low and we're near the usual invoice date:
  insights.push({
    type: "invoice_reminder",
    title: `Mjesečni račun za ${buyer.name}`,
    description: `Obično fakturirate ovom klijentu oko ${avgDay}. dana`,
    confidence: Math.round(100 - dayVariance * 10),
    suggestedAction: {
      label: "Izradi račun",
      href: `/invoices/new?buyerId=${buyerId}`,
    },
  })
}
```

### 18.3 Expense Pattern Detection

Alerts when spending in a category exceeds 50% of the historical average:

```typescript
// src/lib/guidance/patterns.ts
if (thisMonthAmount > avgAmount * 1.5 && thisMonthAmount > 100) {
  insights.push({
    type: "expense_pattern",
    title: `Povećani troškovi: ${category.name}`,
    description: `Ovaj mjesec ste potrošili ${percentIncrease}% više nego inače`,
    confidence: Math.min(90, 60 + pastMonths.length * 10),
    suggestedAction: {
      label: "Pregledaj troškove",
      href: `/expenses?category=${categoryId}`,
    },
  })
}
```

### 18.4 Revenue Trend Detection

Alerts on significant revenue changes:

```typescript
// src/lib/guidance/patterns.ts
if (trend < -15) {
  insights.push({
    type: "revenue_trend",
    title: "Prihodi u padu",
    description: `Prihodi su pali ${Math.abs(trend)}% u odnosu na prethodna 2 mjeseca`,
  })
} else if (trend > 20) {
  insights.push({
    type: "revenue_trend",
    title: "Prihodi rastu!",
    description: `Odlično! Prihodi su porasli ${trend}% u odnosu na prethodna 2 mjeseca`,
  })
}
```

### 18.5 Insight Filtering

Only high-confidence insights are shown:

```typescript
// src/lib/guidance/patterns.ts
export async function getAllPatternInsights(companyId: string) {
  const allInsights = [...invoicePatterns, ...expensePatterns, ...revenueTrends]

  return allInsights
    .filter((i) => i.confidence >= 60) // 60%+ confidence required
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5) // Max 5 insights shown
}
```

---

## 19. Relationship with Visibility System

The Guidance System works in conjunction with the Visibility System to create a cohesive adaptive experience.

### 19.1 System Boundary

| System                | Responsibility                                          |
| --------------------- | ------------------------------------------------------- |
| **Visibility System** | Controls what elements exist in the UI (show/hide/lock) |
| **Guidance System**   | Controls how much help surrounds those elements         |

### 19.2 Shared CompetenceLevel

Both systems use the same three-tier competence model from a single source of truth:

```typescript
// Both systems import from /src/lib/types/competence.ts
export const COMPETENCE_LEVELS = {
  BEGINNER: "beginner",
  AVERAGE: "average",
  PRO: "pro",
} as const

export type CompetenceLevel = (typeof COMPETENCE_LEVELS)[keyof typeof COMPETENCE_LEVELS]
```

**Visibility System Uses Competence For:**

- Hiding complex features for beginners (`COMPETENCE_HIDDEN`)
- Setting the starting progression stage (`COMPETENCE_STARTING_STAGE`)
- Pro users skip to "complete" stage automatically

**Guidance System Uses Competence For:**

- Controlling tooltip visibility
- Setting notification frequency
- Configuring confirmation dialogs

### 19.3 Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER PROFILE                             │
│                    (competence: "average")                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐  ┌─────────────────┐  ┌─────────────────────┐
│  VISIBILITY   │  │    GUIDANCE     │  │    HELP DENSITY     │
│    SYSTEM     │  │     SYSTEM      │  │      CONFIG         │
├───────────────┤  ├─────────────────┤  ├─────────────────────┤
│ Hide advanced │  │ Show key        │  │ Tooltips: key only  │
│ insights card │  │ reminders only  │  │ Confirmations:      │
│               │  │                 │  │   destructive only  │
│ Show API      │  │ 3-day, 1-day,   │  │ Success: brief      │
│ settings nav  │  │ same-day alerts │  │ Shortcuts: hover    │
└───────────────┘  └─────────────────┘  └─────────────────────┘
```

### 19.4 Dashboard Integration

The checklist and insights widgets are visibility-gated:

```typescript
// src/lib/visibility/rules.ts
export const BUSINESS_TYPE_HIDDEN: Record<LegalForm, ElementId[]> = {
  OBRT_PAUSAL: [
    // Paušalni sees checklist and insights
  ],
  OBRT_REAL: [
    "card:checklist-widget", // Hidden for non-paušalni
    "card:insights-widget", // Hidden for non-paušalni
  ],
  // ... other legal forms
}
```

---

## 20. React Context & Client Integration

### 20.1 GuidanceContext Provider

The Guidance System provides a React Context for client-side components to access guidance settings.

**Location:** `/src/contexts/GuidanceContext.tsx`

**Provider Setup:**

```tsx
// src/app/(app)/layout.tsx
import { GuidanceProvider } from "@/contexts"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <GuidanceProvider>
      {/* All dashboard pages have access to guidance context */}
      {children}
    </GuidanceProvider>
  )
}
```

**Context API:**

```typescript
interface GuidanceContextType {
  preferences: GuidancePreferences
  isLoading: boolean
  getLevel: (category: GuidanceCategory) => CompetenceLevel
  setLevel: (category: GuidanceCategory | "global", level: CompetenceLevel) => Promise<void>
  shouldShowTooltip: (category: GuidanceCategory) => boolean
  shouldShowWizard: (category: GuidanceCategory) => boolean
  isDenseMode: () => boolean
  getHelpDensity: (category: GuidanceCategory) => HelpDensityConfig
}
```

### 20.2 Client Hooks

**useGuidance()** - Access full guidance context:

```tsx
import { useGuidance } from "@/contexts/GuidanceContext"

function MyComponent() {
  const { getLevel, setLevel, getHelpDensity } = useGuidance()

  const currentLevel = getLevel("fakturiranje")
  const density = getHelpDensity("fakturiranje")

  return <button onClick={() => setLevel("fakturiranje", "average")}>Promijeni na Srednji</button>
}
```

**useGuidanceLevel(category)** - Shorthand for category-specific guidance:

```tsx
import { useGuidanceLevel } from "@/contexts/GuidanceContext"

function InvoiceForm() {
  const { level, showTooltip, showWizard } = useGuidanceLevel("fakturiranje")

  return (
    <div>
      {showWizard && <InvoiceWizard />}
      <form>{/* ... */}</form>
    </div>
  )
}
```

### 20.3 Component Integration Patterns

**HelpTooltip with Guidance:**

```tsx
import { HelpTooltip } from "@/components/guidance/HelpTooltip"

;<HelpTooltip
  title="OIB"
  content="Osobni identifikacijski broj - 11 znamenki"
  category="fakturiranje"
  isKeyField={true} // Shows for "key" and "all" field tooltip settings
>
  <label>OIB *</label>
</HelpTooltip>
```

**ConfirmationDialog with Guidance:**

```tsx
import { ConfirmationDialog } from "@/components/guidance/ConfirmationDialog"

;<ConfirmationDialog
  trigger={<Button variant="destructive">Obriši</Button>}
  title="Obriši račun?"
  description="Ova radnja se ne može poništiti."
  destructive={true}
  category="fakturiranje"
  onConfirm={handleDelete}
>
  {/* Shows based on actionConfirmations setting */}
</ConfirmationDialog>
```

**KeyboardShortcutHint with Guidance:**

```tsx
import { KeyboardShortcutHint } from "@/components/guidance/KeyboardShortcutHint"

;<KeyboardShortcutHint
  shortcut="Ctrl+S"
  description="Spremi"
  category="fakturiranje"
  // Visibility: hidden (beginner), hover (average), visible (pro)
/>
```

**Success Toast with Guidance:**

```tsx
import { showSuccessToast } from "@/lib/guidance/toast"
import { useGuidance } from "@/contexts/GuidanceContext"

function handleSave() {
  const { getHelpDensity } = useGuidance()

  await saveInvoice()

  showSuccessToast("Račun spremljen", {
    description: "Račun je uspješno spremljen.",
    detailedExplanation: "Račun je spremljen u bazu podataka i spreman je za slanje.",
    helpDensity: getHelpDensity("fakturiranje"),
  })
}
```

### 20.4 Initial Load & SSR

The `GuidanceProvider` fetches user preferences on mount:

```typescript
// Client-side fetch on mount
useEffect(() => {
  async function fetchPreferences() {
    const res = await fetch("/api/guidance/preferences")
    const data = await res.json()
    setPreferences(data.preferences)
  }
  fetchPreferences()
}, [])
```

For server-side rendering scenarios, components can still render with default values (`beginner`) until client hydration completes.

---

## 21. API Reference

### 21.1 GET /api/guidance/preferences

Get the current user's guidance preferences.

**Response:**

```json
{
  "preferences": {
    "id": "uuid",
    "userId": "cuid",
    "levelFakturiranje": "beginner",
    "levelFinancije": "average",
    "levelEu": "beginner",
    "globalLevel": null,
    "emailDigest": "weekly",
    "pushEnabled": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T00:00:00Z"
  },
  "meta": {
    "levels": { "BEGINNER": "beginner", "AVERAGE": "average", "PRO": "pro" },
    "levelLabels": { "beginner": "Početnik", "average": "Srednji", "pro": "Profesionalac" },
    "levelDescriptions": {
      "beginner": "Puna pomoć...",
      "average": "Uravnoteženo...",
      "pro": "Minimalno..."
    },
    "categoryLabels": {
      "fakturiranje": "Fakturiranje",
      "financije": "Financije",
      "eu": "EU poslovanje"
    }
  }
}
```

### 21.2 PUT /api/guidance/preferences

Update user's guidance preferences.

**Request Body (all fields optional):**

```json
{
  "levelFakturiranje": "average",
  "levelFinancije": "pro",
  "levelEu": "beginner",
  "globalLevel": "average",
  "emailDigest": "daily",
  "pushEnabled": false
}
```

**Notes:**

- If `globalLevel` is set, it overrides per-category levels
- To clear `globalLevel`, send `"globalLevel": null`

**Response:**

```json
{
  "preferences": {
    /* updated preferences object */
  }
}
```

### 21.3 GET /api/guidance/checklist

Get aggregated checklist items.

**Query Parameters:**

| Parameter          | Type   | Default | Description                    |
| ------------------ | ------ | ------- | ------------------------------ |
| `limit`            | number | 20      | Max items to return (max: 100) |
| `includeCompleted` | "true" | false   | Include completed items        |
| `includeDismissed` | "true" | false   | Include dismissed items        |

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "category": "financije",
      "type": "payment",
      "title": "MIO I - plaćanje",
      "description": "107.88 EUR za 12/2024",
      "dueDate": "2025-01-15T00:00:00Z",
      "urgency": "soon",
      "action": {
        "type": "link",
        "href": "/pausalni/obligations?highlight=uuid"
      },
      "reference": "obligation:abc123"
    }
  ],
  "stats": {
    "total": 8,
    "critical": 1,
    "soon": 2,
    "upcoming": 3,
    "optional": 2,
    "byCategory": {
      "fakturiranje": 2,
      "financije": 5,
      "eu": 1
    }
  },
  "meta": {
    "limit": 20,
    "returned": 8
  }
}
```

### 21.4 POST /api/guidance/checklist

Mark a checklist item as completed, dismissed, or snoozed.

**Request Body:**

```json
{
  "action": "complete",
  "itemType": "payment",
  "itemReference": "obligation:abc123",
  "snoozeUntil": "2025-01-20T00:00:00Z"
}
```

| Field           | Required        | Values                                                                              |
| --------------- | --------------- | ----------------------------------------------------------------------------------- |
| `action`        | Yes             | `"complete"`, `"dismiss"`, `"snooze"`                                               |
| `itemType`      | Yes             | `"deadline"`, `"payment"`, `"action"`, `"onboarding"`, `"seasonal"`, `"suggestion"` |
| `itemReference` | Yes             | The item's reference string                                                         |
| `snoozeUntil`   | Only for snooze | ISO date string                                                                     |

**Response:**

```json
{
  "success": true,
  "action": "complete",
  "itemReference": "obligation:abc123"
}
```

### 21.5 GET /api/guidance/insights

Get AI-powered pattern insights for the current company.

**Response:**

```json
{
  "insights": [
    {
      "type": "invoice_reminder",
      "title": "Mjesečni račun za Acme d.o.o.",
      "description": "Obično fakturirate ovom klijentu oko 15. dana u mjesecu",
      "confidence": 85,
      "data": {
        "buyerId": "uuid",
        "buyerName": "Acme d.o.o.",
        "avgDay": 15,
        "avgAmount": 1500
      },
      "suggestedAction": {
        "label": "Izradi račun",
        "href": "/invoices/new?buyerId=uuid"
      }
    }
  ]
}
```

### 21.6 GET /api/cron/checklist-digest

**Protected Endpoint** - Requires `CRON_SECRET` in Authorization header.

Sends email digests to users based on their `emailDigest` preference (`daily`, `weekly`, or `none`).

**Schedule:**

- **Daily:** Run every day at 8:00 AM for users with `emailDigest: "daily"`
- **Weekly:** Run every Monday at 8:00 AM for users with `emailDigest: "weekly"`

**Email Content:**

- Top 10 pending items (critical, soon, or upcoming)
- Completed items count in the period
- Direct links to action items

**Implementation:**

```typescript
// src/app/api/cron/checklist-digest/route.ts
export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const isMonday = new Date().getDay() === 1
  const digestTypes = isMonday ? ["daily", "weekly"] : ["daily"]

  // For each user with matching digest preference:
  // 1. Fetch their checklist items
  // 2. Filter urgent items (critical, soon, upcoming)
  // 3. Send email with ChecklistDigestEmail template

  return NextResponse.json({ success: true, sent, errors })
}
```

**Email Template:** `/src/lib/email/templates/checklist-digest-email.tsx`

---

## 22. UI Component Inventory

### 22.1 Component Catalog

| Component              | Location                                            | Description                                     |
| ---------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `CompetenceSelector`   | `/src/components/guidance/CompetenceSelector.tsx`   | Full or compact competence level selector       |
| `ChecklistWidget`      | `/src/components/guidance/ChecklistWidget.tsx`      | Dashboard widget showing top 5 checklist items  |
| `ChecklistItem`        | `/src/components/guidance/ChecklistItem.tsx`        | Individual checklist item with urgency styling  |
| `ChecklistMiniView`    | `/src/components/guidance/ChecklistMiniView.tsx`    | Compact inline checklist view                   |
| `HelpTooltip`          | `/src/components/guidance/HelpTooltip.tsx`          | Contextual help tooltip with positioning        |
| `QuickLevelToggle`     | `/src/components/guidance/QuickLevelToggle.tsx`     | Header dropdown for quick level switching       |
| `InsightsWidget`       | `/src/components/guidance/InsightsWidget.tsx`       | Dashboard widget showing AI insights            |
| `ConfirmationDialog`   | `/src/components/guidance/ConfirmationDialog.tsx`   | Adaptive confirmation dialog                    |
| `KeyboardShortcutHint` | `/src/components/guidance/KeyboardShortcutHint.tsx` | Keyboard shortcut badge with visibility control |

### 22.2 CompetenceSelector

Two variants for different contexts:

**Full Variant (Settings Page):**

```tsx
<CompetenceSelector
  variant="full"
  levels={{
    fakturiranje: "beginner",
    financije: "average",
    eu: "beginner",
  }}
  globalLevel={null}
  onChange={(category, level) => {
    /* update */
  }}
/>
```

**Compact Variant (Header):**

```tsx
<CompetenceSelector
  variant="compact"
  globalLevel="average"
  onChange={(_, level) => setGlobalLevel(level)}
/>
```

### 22.3 ChecklistWidget

Dashboard integration:

```tsx
<ChecklistWidget
  initialItems={items} // Optional SSR data
  initialStats={stats} // Optional SSR stats
/>
```

**Features:**

- Auto-fetches from `/api/guidance/checklist?limit=5`
- Shows current month context
- Supports complete/dismiss actions
- Links to full checklist page if more items exist

### 22.4 QuickLevelToggle

Header dropdown or button group:

```tsx
// Dropdown variant (default)
<QuickLevelToggle variant="dropdown" />

// Button group variant
<QuickLevelToggle variant="buttons" />
```

**Features:**

- Shows current level with icon and label
- Supports keyboard shortcut (`toggle-guidance-level` event)
- Links to full settings page

### 22.5 HelpTooltip

Contextual help that respects visibility settings:

```tsx
<HelpTooltip
  title="OIB"
  content="Osobni identifikacijski broj - 11 znamenki"
  category="fakturiranje"
  position="top"
>
  <label>OIB *</label>
</HelpTooltip>
```

**ConditionalHelpTooltip:**

```tsx
<ConditionalHelpTooltip
  showForLevels={["beginner", "average"]}
  content="Only shown for non-pro users"
>
  <span>Field</span>
</ConditionalHelpTooltip>
```

---

## 23. Onboarding Integration

### 23.1 Competence Selection Step

During onboarding, users select their competence level which affects both the Guidance and Visibility systems.

**Location:** `/src/components/onboarding/step-competence.tsx`

**Onboarding Options:**

```typescript
const COMPETENCE_OPTIONS = [
  {
    value: "beginner",
    label: "Početnik",
    description: "Tek započinjem s fakturiranjem. Trebam vodstvo korak po korak.",
    benefits: [
      "Vodstvo kroz svaki korak",
      "Detaljne upute i objašnjenja",
      "Postupno otključavanje značajki",
    ],
    uiChanges: "Vidjeti ćete detaljne tooltipove na svakom polju...",
  },
  {
    value: "average",
    label: "Iskusan",
    description: "Imam iskustva s fakturiranjem. Razumijem osnove.",
    benefits: [
      "Preskočite osnovne korake",
      "Direktan pristup fakturama",
      "Umjerene upute kad je potrebno",
    ],
  },
  {
    value: "pro",
    label: "Stručnjak",
    description: "Profesionalac sam. Želim sve značajke odmah.",
    benefits: ["Sve otključano odmah", "Bez ograničenja i čekanja", "Napredne postavke vidljive"],
  },
]
```

### 23.2 Initial Preference Creation

When a user completes onboarding, their selected competence level is saved to the `user_guidance_preferences` table:

```typescript
// src/lib/actions/onboarding.ts
await updateGuidancePreferences(userId, {
  globalLevel: competenceLevel,
  levelFakturiranje: competenceLevel,
  levelFinancije: competenceLevel,
  levelEu: competenceLevel,
})
```

This ensures users immediately experience the interface adapted to their declared skill level.

### 23.3 Visibility System Interaction

The selected competence affects the user's initial progression stage:

```typescript
// src/lib/visibility/rules.ts
export const COMPETENCE_STARTING_STAGE: Record<CompetenceLevel, ProgressionStage> = {
  beginner: "onboarding", // Start from scratch
  average: "setup", // Skip initial onboarding
  pro: "active", // Go straight to full features
}
```

**Pro users** effectively skip the entire progression system and see all features immediately.

### 23.4 Onboarding Checklist Items

The checklist system includes onboarding-specific items that guide new users through setup:

| Item Reference                  | Title                     | Description                                     |
| ------------------------------- | ------------------------- | ----------------------------------------------- |
| `onboarding:company_data`       | Dopuni podatke o tvrtki   | Dodaj OIB i adresu za pravilno fakturiranje     |
| `onboarding:einvoice_provider`  | Poveži posrednika         | Konfiguriraj IE-Računi za slanje e-računa       |
| `onboarding:first_invoice`      | Kreiraj prvi račun        | Izradite svoj prvi e-račun koristeći vodič      |
| `onboarding:first_contact`      | Dodaj prvi kontakt        | Kreiraj kupca ili dobavljača                    |
| `onboarding:first_product`      | Dodaj proizvod ili uslugu | Kreiraj artikl za fakturiranje                  |
| `onboarding:first_bank_account` | Dodaj bankovni račun      | Povežite bankovni račun za praćenje transakcija |
| `onboarding:bank_import`        | Uvezi bankovne izvode     | Importirajte izvode za automatsko uparivanje    |
| `onboarding:first_expense`      | Evidentiraj prvi trošak   | Dodajte prvi trošak za praćenje rashoda         |

These items automatically appear in the ChecklistWidget and can be completed or dismissed by the user.

---

## 24. Settings Page

**Route:** `/settings/guidance`

**Components:**

- `GuidanceSettingsPage` (Server) - Loads initial preferences
- `GuidanceSettingsClient` (Client) - Interactive settings UI

**Layout:**

```
┌────────────────────────────────────────────────┐
│  Postavke pomoći                               │
│  Prilagodite razinu pomoći prema iskustvu      │
├────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────┐    │
│  │  Razina iskustva                       │    │
│  │  ┌─────────────────────────────────┐   │    │
│  │  │ Fakturiranje                    │   │    │
│  │  │ [Početnik] [Srednji] [Pro]      │   │    │
│  │  ├─────────────────────────────────┤   │    │
│  │  │ Financije                       │   │    │
│  │  │ [Početnik] [Srednji] [Pro]      │   │    │
│  │  ├─────────────────────────────────┤   │    │
│  │  │ EU poslovanje                   │   │    │
│  │  │ [Početnik] [Srednji] [Pro]      │   │    │
│  │  └─────────────────────────────────┘   │    │
│  └────────────────────────────────────────┘    │
│                                                │
│  ┌────────────────────────────────────────┐    │
│  │  📧 Email obavijesti                   │    │
│  │  Primajte preglede zadataka na email   │    │
│  │                                        │    │
│  │  ○ Dnevno     - Svaki dan u 8:00       │    │
│  │  ● Tjedno     - Svaki ponedjeljak      │    │
│  │  ○ Nikada     - Ne šalji email         │    │
│  └────────────────────────────────────────┘    │
│                                                │
│                            [Spremi postavke]   │
└────────────────────────────────────────────────┘
```

---

## 25. Implementation Status

| Feature                   | Status         | Location                                      |
| ------------------------- | -------------- | --------------------------------------------- |
| User preferences CRUD     | ✅ Implemented | `preferences.ts`, `/api/guidance/preferences` |
| Per-category competence   | ✅ Implemented | DB schema, preferences API                    |
| Global level override     | ✅ Implemented | `setGlobalLevel()`, API                       |
| Checklist aggregation     | ✅ Implemented | `checklist.ts`, `/api/guidance/checklist`     |
| Payment obligations       | ✅ Implemented | `getObligationItems()`                        |
| Compliance deadlines      | ✅ Implemented | `getDeadlineItems()`                          |
| Onboarding tasks          | ✅ Implemented | `getOnboardingItems()`                        |
| Seasonal tasks            | ✅ Implemented | `getSeasonalItems()`                          |
| Complete/dismiss/snooze   | ✅ Implemented | API, `checklistInteractions` table            |
| Invoice pattern detection | ✅ Implemented | `detectInvoicePatterns()`                     |
| Expense pattern detection | ✅ Implemented | `detectExpensePatterns()`                     |
| Revenue trend detection   | ✅ Implemented | `detectRevenueTrends()`                       |
| Help density config       | ✅ Implemented | `help-density.ts`                             |
| Settings page             | ✅ Implemented | `/settings/guidance/`                         |
| Dashboard widgets         | ✅ Implemented | `ChecklistWidget`, `InsightsWidget`           |
| Quick level toggle        | ✅ Implemented | `QuickLevelToggle`                            |
| Email digest sending      | ✅ Implemented | `/api/cron/checklist-digest`, email template  |
| React Context Provider    | ✅ Implemented | `GuidanceContext.tsx`, `useGuidance()`        |
| ConfirmationDialog        | ✅ Implemented | Respects `actionConfirmations` setting        |
| KeyboardShortcutHint      | ✅ Implemented | Respects `keyboardShortcuts` setting          |
| Success Toast Adaptation  | ✅ Implemented | `showSuccessToast()` with help density        |
| Push notifications        | 📋 Planned     | Not implemented                               |

---

## 26. Audit Notes

> **Previous Audit:** 2025-12-28
> **Latest Audit:** 2026-01-14

### Audit 2026-01-14: Comprehensive Verification

**Verified Components:**

- ✅ React Context Provider (`GuidanceContext.tsx`) - Fully implemented with hooks
- ✅ Email Digest System - Cron job and email templates operational
- ✅ All UI Components - HelpTooltip, ConfirmationDialog, KeyboardShortcutHint verified
- ✅ Pattern Detection AI - Invoice, expense, and revenue trend detection
- ✅ Shared Type System - Single source of truth in `/src/lib/types/competence.ts`
- ✅ Integration with Visibility System - Shared competence levels confirmed

**New Findings:**

1. **GuidanceContext Integration** - Provider wraps entire dashboard layout at `/src/app/(app)/layout.tsx`
2. **Help Density System** - Fully implements all four adaptive UI aspects (tooltips, confirmations, success messages, keyboard hints)
3. **Checklist System** - Supports snoozing, completion tracking, and persistence across sessions
4. **Pattern Insights** - AI-powered detection with confidence thresholds (60%+ required)
5. **Email Digests** - Protected cron endpoint with daily/weekly scheduling

**Documentation Updates:**

- Added React Context section (§20) with hooks and integration patterns
- Added Email Digest API endpoint (§21.6)
- Updated component inventory with ConfirmationDialog and KeyboardShortcutHint
- Clarified shared type system between Guidance and Visibility systems
- Verified all file locations and implementation status

### Audit 2025-12-28: Initial Documentation

The entire Guidance System was not mentioned in the Product Bible prior to this audit, despite being fully implemented with:

- 9 library files
- 3 API routes
- 10 UI components
- 1 database schema file
- 1 settings page
- 1 React Context Provider
- 1 cron job + email template

### Integration Points Clarified

- Visibility System relationship documented
- Dashboard widget gating by business type noted
- Competence level sharing between systems explained
- React Context provider integration verified
- Help density configuration system documented

### Future Considerations

1. **Push Notifications** - `pushEnabled` preference exists but push notification system not implemented
2. **Advanced Pattern Detection** - Current patterns cover invoicing, expenses, and revenue; could expand to tax thresholds and compliance risks
3. **Checklist Prioritization ML** - Could use ML to personalize urgency levels based on user behavior

---

[← Back to Index](./00-INDEX.md) | [Next: Appendixes →](./08-APPENDIXES.md)
