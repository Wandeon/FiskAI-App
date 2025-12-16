# Knowledge Hub v2 - Implementation Plan

**Date:** 2025-12-15
**Design Document:** [2025-12-15-knowledge-hub-v2-design.md](./2025-12-15-knowledge-hub-v2-design.md)
**Status:** Ready for Implementation

---

## Phase 1: Core Infrastructure

### Task 1.1: Create Comparison Page Route

**File:** `src/app/(marketing)/usporedba/[slug]/page.tsx`

**Context:** This route handles the 4 comparison pages that show side-by-side business type comparisons. It mirrors the existing `/vodic/[slug]` pattern.

**Implementation:**

```tsx
import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getComparisonBySlug, getAllComparisonSlugs } from "@/lib/knowledge-hub/mdx"
import { ComparisonPageContent } from "@/components/knowledge-hub/comparison/ComparisonPageContent"

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | undefined }>
}

export async function generateStaticParams() {
  const slugs = await getAllComparisonSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const comparison = await getComparisonBySlug(slug)

  if (!comparison) {
    return { title: "Usporedba nije pronađena" }
  }

  return {
    title: `${comparison.frontmatter.title} | FiskAI`,
    description: comparison.frontmatter.description,
  }
}

export default async function ComparisonPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const comparison = await getComparisonBySlug(slug)

  if (!comparison) {
    notFound()
  }

  return <ComparisonPageContent comparison={comparison} searchParams={resolvedSearchParams} />
}
```

**Verification:** `npm run build` should complete without errors for the new route.

---

### Task 1.2: Update MDX Loader for Comparisons

**File:** `src/lib/knowledge-hub/mdx.ts`

**Context:** Extend the existing MDX loader to handle the `content/usporedbe/` directory alongside `content/vodici/`.

**Changes to make:**

1. Add `getComparisonBySlug` function
2. Add `getAllComparisonSlugs` function
3. Add `getAllComparisons` function

**Implementation (add to existing file):**

```typescript
// Add these constants at the top
const COMPARISONS_PATH = path.join(process.cwd(), "content", "usporedbe")

// Add these types
export interface ComparisonFrontmatter {
  title: string
  description: string
  compares: string[] // e.g., ["pausalni", "obrt-dohodak", "jdoo"]
  decisionContext: string // e.g., "starting-solo", "additional-income"
}

export interface Comparison {
  slug: string
  frontmatter: ComparisonFrontmatter
  content: string
}

// Add these functions
export async function getAllComparisonSlugs(): Promise<string[]> {
  try {
    const files = await fs.readdir(COMPARISONS_PATH)
    return files.filter((file) => file.endsWith(".mdx")).map((file) => file.replace(/\.mdx$/, ""))
  } catch {
    return []
  }
}

export async function getComparisonBySlug(slug: string): Promise<Comparison | null> {
  try {
    const filePath = path.join(COMPARISONS_PATH, `${slug}.mdx`)
    const fileContent = await fs.readFile(filePath, "utf-8")
    const { data, content } = matter(fileContent)

    return {
      slug,
      frontmatter: data as ComparisonFrontmatter,
      content,
    }
  } catch {
    return null
  }
}

export async function getAllComparisons(): Promise<Comparison[]> {
  const slugs = await getAllComparisonSlugs()
  const comparisons = await Promise.all(slugs.map((slug) => getComparisonBySlug(slug)))
  return comparisons.filter((c): c is Comparison => c !== null)
}
```

**Verification:** Create a test comparison file and verify it loads correctly.

---

### Task 1.3: Create Comparison Types

**File:** `src/lib/knowledge-hub/types.ts`

**Context:** Add TypeScript types for comparison data structures.

**Add to existing file:**

```typescript
// Business type comparison data
export interface BusinessTypeComparison {
  slug: string
  name: string
  maxRevenue: number | null // null = unlimited
  monthlyContributions: number
  taxRate: string // e.g., "~10%" or "20% + prirez"
  vatRequired: boolean
  vatThreshold: number
  fiscalization: boolean
  bookkeeping: "none" | "simple" | "full"
  estimatedBookkeepingCost: number
  bestFor: string[]
  notSuitableFor: string[]
}

// Comparison table row
export interface ComparisonRow {
  label: string
  values: Record<string, string | number | boolean>
  tooltip?: string
}

// Comparison calculator result
export interface ComparisonResult {
  businessType: string
  annualContributions: number
  annualTax: number
  bookkeepingCost: number
  otherCosts: number
  totalCosts: number
  netIncome: number
  isRecommended: boolean
  recommendationReason?: string
}
```

**Verification:** TypeScript compilation should pass.

---

### Task 1.4: Build ComparisonTable Component

**File:** `src/components/knowledge-hub/comparison/ComparisonTable.tsx`

**Context:** Side-by-side comparison table showing key differences between business types. Responsive design collapses to cards on mobile.

**Implementation:**

```tsx
"use client"

import { cn } from "@/lib/utils"

interface ComparisonColumn {
  id: string
  name: string
  highlighted?: boolean
}

interface ComparisonRow {
  label: string
  tooltip?: string
  values: Record<string, string | React.ReactNode>
}

interface ComparisonTableProps {
  columns: ComparisonColumn[]
  rows: ComparisonRow[]
  highlightedColumn?: string // from URL params
}

export function ComparisonTable({ columns, rows, highlightedColumn }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      {/* Desktop Table */}
      <table className="hidden md:table w-full border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left bg-gray-50 border-b font-medium">Usporedba</th>
            {columns.map((col) => (
              <th
                key={col.id}
                className={cn(
                  "p-3 text-center border-b font-medium",
                  col.highlighted || col.id === highlightedColumn
                    ? "bg-blue-50 text-blue-900"
                    : "bg-gray-50"
                )}
              >
                {col.name}
                {(col.highlighted || col.id === highlightedColumn) && (
                  <span className="block text-xs text-blue-600 font-normal">Preporučeno</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium text-gray-700">
                {row.label}
                {row.tooltip && (
                  <span className="ml-1 text-gray-400 cursor-help" title={row.tooltip}>
                    ⓘ
                  </span>
                )}
              </td>
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    "p-3 text-center",
                    (col.highlighted || col.id === highlightedColumn) && "bg-blue-50/50"
                  )}
                >
                  {row.values[col.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {columns.map((col) => (
          <div
            key={col.id}
            className={cn(
              "border rounded-lg p-4",
              col.highlighted || col.id === highlightedColumn
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            )}
          >
            <h3 className="font-semibold text-lg mb-3">
              {col.name}
              {(col.highlighted || col.id === highlightedColumn) && (
                <span className="ml-2 text-sm text-blue-600">Preporučeno</span>
              )}
            </h3>
            <dl className="space-y-2">
              {rows.map((row, idx) => (
                <div key={idx} className="flex justify-between">
                  <dt className="text-gray-600">{row.label}</dt>
                  <dd className="font-medium">{row.values[col.id]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Verification:** Component renders correctly in Storybook or test page.

---

### Task 1.5: Build ComparisonCalculator Component

**File:** `src/components/knowledge-hub/comparison/ComparisonCalculator.tsx`

**Context:** Interactive calculator that shows side-by-side costs for all compared business types based on user's expected revenue.

**Implementation:**

```tsx
"use client"

import { useState, useMemo } from "react"
import {
  calculatePausalniCosts,
  calculateObrtDohodakCosts,
  calculateJdooCosts,
} from "@/lib/knowledge-hub/calculations"
import { cn } from "@/lib/utils"

interface CalculatorConfig {
  businessTypes: Array<"pausalni" | "obrt-dohodak" | "jdoo" | "doo">
  defaultRevenue?: number
}

interface CostBreakdown {
  type: string
  label: string
  contributions: number
  tax: number
  bookkeeping: number
  other: number
  total: number
  netIncome: number
  isRecommended: boolean
}

export function ComparisonCalculator({ businessTypes, defaultRevenue = 35000 }: CalculatorConfig) {
  const [revenue, setRevenue] = useState(defaultRevenue)

  const results = useMemo((): CostBreakdown[] => {
    return businessTypes.map((type) => {
      switch (type) {
        case "pausalni": {
          const costs = calculatePausalniCosts(revenue)
          return {
            type: "pausalni",
            label: "Paušalni obrt",
            contributions: costs.yearlyContributions,
            tax: costs.yearlyTax,
            bookkeeping: 0,
            other: 137, // HOK membership
            total: costs.yearlyContributions + costs.yearlyTax + 137,
            netIncome: revenue - (costs.yearlyContributions + costs.yearlyTax + 137),
            isRecommended: revenue <= 40000,
          }
        }
        case "obrt-dohodak": {
          const costs = calculateObrtDohodakCosts(revenue, revenue * 0.3) // 30% expenses
          return {
            type: "obrt-dohodak",
            label: "Obrt na dohodak",
            contributions: costs.yearlyContributions,
            tax: costs.yearlyTax,
            bookkeeping: 600,
            other: 137,
            total: costs.yearlyContributions + costs.yearlyTax + 600 + 137,
            netIncome: revenue - (costs.yearlyContributions + costs.yearlyTax + 600 + 137),
            isRecommended: revenue > 40000 && revenue <= 60000,
          }
        }
        case "jdoo": {
          const costs = calculateJdooCosts(revenue)
          return {
            type: "jdoo",
            label: "J.D.O.O.",
            contributions: costs.yearlyContributions,
            tax: costs.yearlyTax,
            bookkeeping: 1200,
            other: 0,
            total: costs.yearlyContributions + costs.yearlyTax + 1200,
            netIncome: revenue - (costs.yearlyContributions + costs.yearlyTax + 1200),
            isRecommended: revenue > 60000,
          }
        }
        default:
          throw new Error(`Unknown business type: ${type}`)
      }
    })
  }, [revenue, businessTypes])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("hr-HR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount)

  return (
    <div className="bg-white border rounded-lg p-6">
      {/* Revenue Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Očekivani godišnji prihod
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={10000}
            max={100000}
            step={5000}
            value={revenue}
            onChange={(e) => setRevenue(Number(e.target.value))}
            className="flex-1"
          />
          <div className="w-32 text-right font-mono text-lg">{formatCurrency(revenue)}</div>
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left"></th>
              {results.map((r) => (
                <th
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50")}
                >
                  {r.label}
                  {r.isRecommended && (
                    <span className="block text-xs text-green-600">✓ Preporučeno</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Doprinosi</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.contributions)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Porez</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.tax)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Knjigovodstvo</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.bookkeeping)}
                </td>
              ))}
            </tr>
            <tr className="border-b">
              <td className="p-2 text-gray-600">Ostalo</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.other)}
                </td>
              ))}
            </tr>
            <tr className="border-b-2 border-gray-300 font-semibold">
              <td className="p-2">UKUPNO GODIŠNJE</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-50/50")}
                >
                  {formatCurrency(r.total)}
                </td>
              ))}
            </tr>
            <tr className="font-semibold text-green-700">
              <td className="p-2">NETO OSTATAK</td>
              {results.map((r) => (
                <td
                  key={r.type}
                  className={cn("p-2 text-center", r.isRecommended && "bg-green-100")}
                >
                  {formatCurrency(r.netIncome)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-gray-500">
        * Procjene za 2025. Stvarni iznosi ovise o prirezima, dodatnim troškovima i specifičnoj
        situaciji.
      </p>
    </div>
  )
}
```

**Verification:** Calculator updates dynamically when revenue slider moves.

---

### Task 1.6: Add J.D.O.O. Calculation Function

**File:** `src/lib/knowledge-hub/calculations.ts`

**Context:** Add calculation function for j.d.o.o. costs to support ComparisonCalculator.

**Add to existing file:**

```typescript
export interface JdooCosts {
  monthlyDirectorSalary: number
  yearlyContributions: number
  yearlyTax: number // profit tax
  effectiveTaxRate: number
}

export function calculateJdooCosts(
  annualRevenue: number,
  hasOtherEmployment: boolean = false
): JdooCosts {
  // If director has other employment, no mandatory salary
  // Otherwise, minimum salary contributions apply
  const monthlyDirectorSalary = hasOtherEmployment ? 0 : 700 // minimum base
  const yearlyContributions = hasOtherEmployment ? 0 : monthlyDirectorSalary * 12 * 0.365 // ~36.5% contributions

  // Simplified profit calculation (revenue - costs - salary)
  const estimatedCosts = annualRevenue * 0.2 // assume 20% business costs
  const directorSalaryCost = monthlyDirectorSalary * 12 * 1.365 // gross cost
  const taxableProfit = Math.max(0, annualRevenue - estimatedCosts - directorSalaryCost)

  // Profit tax: 10% up to 1M EUR, 18% above
  const yearlyTax =
    taxableProfit <= 1000000
      ? taxableProfit * 0.1
      : 1000000 * 0.1 + (taxableProfit - 1000000) * 0.18

  return {
    monthlyDirectorSalary,
    yearlyContributions: Math.round(yearlyContributions),
    yearlyTax: Math.round(yearlyTax),
    effectiveTaxRate: annualRevenue > 0 ? (yearlyTax / annualRevenue) * 100 : 0,
  }
}
```

**Verification:** Run `npm run test:knowledge-hub` - add test case for this function.

---

### Task 1.7: Create Comparison Page Content Component

**File:** `src/components/knowledge-hub/comparison/ComparisonPageContent.tsx`

**Context:** Main content component for comparison pages that assembles the hero, comparison table, calculator, and recommendations.

**Implementation:**

```tsx
import { MDXRemote } from "next-mdx-remote/rsc"
import { Comparison } from "@/lib/knowledge-hub/mdx"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import { ComparisonTable } from "./ComparisonTable"
import { ComparisonCalculator } from "./ComparisonCalculator"
import { RecommendationCard } from "./RecommendationCard"

interface ComparisonPageContentProps {
  comparison: Comparison
  searchParams: { [key: string]: string | undefined }
}

export function ComparisonPageContent({ comparison, searchParams }: ComparisonPageContentProps) {
  const { frontmatter, content } = comparison
  const highlightedType = searchParams.preporuka
  const revenueLevel = searchParams.prihod

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <a href="/" className="hover:text-gray-700">
          Početna
        </a>
        {" > "}
        <a href="/baza-znanja" className="hover:text-gray-700">
          Baza znanja
        </a>
        {" > "}
        <span className="text-gray-900">{frontmatter.title}</span>
      </nav>

      {/* Hero */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{frontmatter.title}</h1>
        <p className="text-lg text-gray-600">{frontmatter.description}</p>
      </header>

      {/* MDX Content (includes ComparisonTable, Calculator, etc.) */}
      <article className="prose prose-gray max-w-none">
        <MDXRemote
          source={content}
          components={{
            ...mdxComponents,
            ComparisonTable,
            ComparisonCalculator,
            RecommendationCard,
          }}
        />
      </article>

      {/* Deep-dive links */}
      <section className="mt-12 border-t pt-8">
        <h2 className="text-xl font-semibold mb-4">Saznajte više</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {frontmatter.compares.map((slug) => (
            <a
              key={slug}
              href={`/vodic/${slug}`}
              className="block p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium">Vodič: {slug}</span>
              <span className="block text-sm text-gray-500">
                Kompletan vodič sa svim detaljima →
              </span>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
```

**Verification:** Page renders with all sections visible.

---

### Task 1.8: Create RecommendationCard Component

**File:** `src/components/knowledge-hub/comparison/RecommendationCard.tsx`

**Context:** "Best for..." cards that help visitors understand which option suits their situation.

**Implementation:**

```tsx
import { cn } from "@/lib/utils"

interface RecommendationCardProps {
  businessType: string
  title: string
  bestFor: string[]
  notSuitableFor?: string[]
  highlighted?: boolean
}

export function RecommendationCard({
  businessType,
  title,
  bestFor,
  notSuitableFor,
  highlighted = false,
}: RecommendationCardProps) {
  return (
    <div
      className={cn(
        "border rounded-lg p-5",
        highlighted ? "border-green-500 bg-green-50" : "border-gray-200"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        {highlighted && (
          <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">
            Preporučeno za vas
          </span>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium text-green-700 mb-1">Najbolje za:</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            {bestFor.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {notSuitableFor && notSuitableFor.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-red-700 mb-1">Nije idealno za:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {notSuitableFor.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <a
        href={`/vodic/${businessType}`}
        className="mt-4 inline-block text-sm text-blue-600 hover:text-blue-800"
      >
        Saznaj više o {title} →
      </a>
    </div>
  )
}
```

**Verification:** Cards render with proper styling and links work.

---

### Task 1.9: Create content/usporedbe Directory and Index

**Files:**

- `content/usporedbe/` (directory)
- `content/usporedbe/.gitkeep`

**Context:** Create the directory structure for comparison MDX files.

**Commands:**

```bash
mkdir -p content/usporedbe
touch content/usporedbe/.gitkeep
```

**Verification:** Directory exists and is tracked by git.

---

## Phase 2: Guide Components

### Task 2.1: Build VariantTabs Component

**File:** `src/components/knowledge-hub/guide/VariantTabs.tsx`

**Context:** Tab navigation for guide variations (e.g., "Osnovni | Uz zaposlenje | Umirovljenik"). Persists selection in URL for shareability.

**Implementation:**

```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"

interface Tab {
  id: string
  label: string
}

interface VariantTabsProps {
  tabs: Tab[]
  defaultTab?: string
  children: React.ReactNode
}

export function VariantTabs({ tabs, defaultTab, children }: VariantTabsProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get("varijanta") || defaultTab || tabs[0]?.id

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("varijanta", tabId)
    router.push(`?${params.toString()}`, { scroll: false })
  }

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content - render all, show active */}
      <div>
        {React.Children.map(children, (child, index) => {
          if (!React.isValidElement(child)) return null
          const tabId = tabs[index]?.id
          return <div className={cn(activeTab === tabId ? "block" : "hidden")}>{child}</div>
        })}
      </div>
    </div>
  )
}

// Tab panel component for MDX usage
export function TabPanel({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
```

**Verification:** Tabs switch content, URL updates, refresh preserves selection.

---

### Task 2.2: Build PDVCallout Component

**File:** `src/components/knowledge-hub/guide/PDVCallout.tsx`

**Context:** Contextual callout boxes for PDV-related information. Three variants: warning (threshold), info (EU services), tip (voluntary entry).

**Implementation:**

```tsx
import { cn } from "@/lib/utils"

type CalloutType = "warning" | "info" | "tip"

interface PDVCalloutProps {
  type: CalloutType
  threshold?: number
  context?: "eu-services" | "voluntary" | "general"
  children: React.ReactNode
}

const calloutStyles: Record<CalloutType, { bg: string; border: string; icon: string }> = {
  warning: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: "⚠️",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: "💡",
  },
  tip: {
    bg: "bg-green-50",
    border: "border-green-200",
    icon: "💰",
  },
}

export function PDVCallout({ type, threshold, context, children }: PDVCalloutProps) {
  const styles = calloutStyles[type]

  return (
    <aside className={cn("my-4 p-4 border rounded-lg", styles.bg, styles.border)} role="note">
      <div className="flex gap-3">
        <span className="text-xl flex-shrink-0" aria-hidden="true">
          {styles.icon}
        </span>
        <div className="text-sm">
          {threshold && (
            <strong className="block mb-1">
              PDV prag: {threshold.toLocaleString("hr-HR")} EUR
            </strong>
          )}
          {children}
        </div>
      </div>
    </aside>
  )
}
```

**Verification:** All three variants render with distinct styling.

---

### Task 2.3: Build QuickStatsBar Component

**File:** `src/components/knowledge-hub/guide/QuickStatsBar.tsx`

**Context:** Sticky header showing key statistics for the business type. Shows on scroll past hero section.

**Implementation:**

```tsx
"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface Stat {
  label: string
  value: string
  tooltip?: string
}

interface QuickStatsBarProps {
  stats: Stat[]
  title: string
}

export function QuickStatsBar({ stats, title }: QuickStatsBarProps) {
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 200)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <div
      className={cn(
        "transition-all duration-200 z-40",
        isSticky ? "fixed top-0 left-0 right-0 bg-white shadow-md" : "relative bg-gray-50"
      )}
    >
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {isSticky && <span className="font-semibold text-gray-900 mr-4">{title}</span>}
          <div className="flex flex-wrap gap-4 md:gap-6">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm" title={stat.tooltip}>
                <span className="text-gray-500">{stat.label}:</span>
                <span className="font-medium text-gray-900">{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Verification:** Bar becomes sticky on scroll, shows title when sticky.

---

### Task 2.4: Build TableOfContents Component

**File:** `src/components/knowledge-hub/guide/TableOfContents.tsx`

**Context:** Sidebar navigation showing guide sections. Highlights current section based on scroll position.

**Implementation:**

```tsx
"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface TOCItem {
  id: string
  title: string
  level: number // 2 = h2, 3 = h3
}

interface TableOfContentsProps {
  items: TOCItem[]
}

export function TableOfContents({ items }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>("")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        })
      },
      { rootMargin: "-100px 0px -80% 0px" }
    )

    items.forEach((item) => {
      const element = document.getElementById(item.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [items])

  const handleClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  return (
    <nav className="hidden lg:block sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Sadržaj</h2>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => handleClick(item.id)}
              className={cn(
                "text-left w-full hover:text-blue-600 transition-colors",
                item.level === 3 && "pl-3",
                activeId === item.id ? "text-blue-600 font-medium" : "text-gray-600"
              )}
            >
              {item.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

**Verification:** TOC highlights current section while scrolling.

---

### Task 2.5: Update mdx-components.tsx with New Components

**File:** `src/components/knowledge-hub/mdx-components.tsx`

**Context:** Register new components for use in MDX files.

**Add imports and register:**

```tsx
// Add imports
import { VariantTabs, TabPanel } from "./guide/VariantTabs"
import { PDVCallout } from "./guide/PDVCallout"
import { QuickStatsBar } from "./guide/QuickStatsBar"
import { TableOfContents } from "./guide/TableOfContents"
import { ComparisonTable } from "./comparison/ComparisonTable"
import { ComparisonCalculator } from "./comparison/ComparisonCalculator"
import { RecommendationCard } from "./comparison/RecommendationCard"

// Add to mdxComponents object
export const mdxComponents = {
  // ... existing components
  VariantTabs,
  TabPanel,
  PDVCallout,
  QuickStatsBar,
  TableOfContents,
  ComparisonTable,
  ComparisonCalculator,
  RecommendationCard,
}
```

**Verification:** Components can be used in MDX files without errors.

---

### Task 2.6: Create Component Index Files

**Files:**

- `src/components/knowledge-hub/guide/index.ts`
- `src/components/knowledge-hub/comparison/index.ts`

**Context:** Export all components from directories for cleaner imports.

**guide/index.ts:**

```typescript
export { VariantTabs, TabPanel } from "./VariantTabs"
export { PDVCallout } from "./PDVCallout"
export { QuickStatsBar } from "./QuickStatsBar"
export { TableOfContents } from "./TableOfContents"
export { PersonalizedSection } from "./PersonalizedSection"
export { FAQ } from "./FAQ"
```

**comparison/index.ts:**

```typescript
export { ComparisonTable } from "./ComparisonTable"
export { ComparisonCalculator } from "./ComparisonCalculator"
export { ComparisonPageContent } from "./ComparisonPageContent"
export { RecommendationCard } from "./RecommendationCard"
```

**Verification:** Imports work: `import { PDVCallout } from "@/components/knowledge-hub/guide"`

---

## Phase 3: Tool Pages

### Task 3.1: Create PDV Calculator Page

**File:** `src/app/(marketing)/alati/pdv-kalkulator/page.tsx`

**Context:** Tool page for calculating PDV threshold proximity and what happens when crossed.

**Implementation:**

```tsx
import { Metadata } from "next"
import { PDVThresholdCalculator } from "@/components/knowledge-hub/calculators/PDVThresholdCalculator"

export const metadata: Metadata = {
  title: "PDV Kalkulator - Kada prelazim prag? | FiskAI",
  description:
    "Izračunajte koliko ste blizu PDV praga od 60.000€ i što se mijenja kada ga prijeđete.",
}

export default function PDVCalculatorPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PDV Kalkulator</h1>
        <p className="text-lg text-gray-600">
          Provjerite koliko ste blizu PDV praga i što to znači za vaše poslovanje.
        </p>
      </header>

      <PDVThresholdCalculator />

      <section className="mt-12 prose prose-gray max-w-none">
        <h2>Što je PDV prag?</h2>
        <p>
          Od 2025. godine, PDV prag u Hrvatskoj iznosi <strong>60.000 EUR</strong> godišnje. Kada
          vaš prihod prijeđe ovaj iznos, automatski postajete PDV obveznik od prvog dana sljedećeg
          mjeseca.
        </p>

        <h2>Što se mijenja kada postanete PDV obveznik?</h2>
        <ul>
          <li>Morate obračunavati 25% PDV na sve račune</li>
          <li>Možete odbijati ulazni PDV (troškovi)</li>
          <li>Obvezne mjesečne ili kvartalne PDV prijave</li>
          <li>Novi IBAN-ovi za uplate poreza</li>
        </ul>

        <h2>Povezane stranice</h2>
        <ul>
          <li>
            <a href="/usporedba/preko-praga">Što kada prijeđem prag?</a>
          </li>
          <li>
            <a href="/vodic/pausalni-obrt#pdv">PDV za paušalne obrtnike</a>
          </li>
        </ul>
      </section>
    </div>
  )
}
```

**Verification:** Page loads, calculator functions.

---

### Task 3.2: Build PDVThresholdCalculator Component

**File:** `src/components/knowledge-hub/calculators/PDVThresholdCalculator.tsx`

**Context:** Calculator showing progress toward PDV threshold with timeline projection.

**Implementation:**

```tsx
"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"

const PDV_THRESHOLD = 60000

export function PDVThresholdCalculator() {
  const [currentRevenue, setCurrentRevenue] = useState(35000)
  const [monthlyAverage, setMonthlyAverage] = useState(4000)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)

  const analysis = useMemo(() => {
    const remainingMonths = 12 - currentMonth
    const projectedYearEnd = currentRevenue + monthlyAverage * remainingMonths
    const percentageOfThreshold = (currentRevenue / PDV_THRESHOLD) * 100
    const willCrossThreshold = projectedYearEnd > PDV_THRESHOLD

    let monthToCross: number | null = null
    if (willCrossThreshold) {
      const revenueNeeded = PDV_THRESHOLD - currentRevenue
      const monthsToThreshold = Math.ceil(revenueNeeded / monthlyAverage)
      monthToCross = Math.min(currentMonth + monthsToThreshold, 12)
    }

    return {
      projectedYearEnd,
      percentageOfThreshold: Math.min(percentageOfThreshold, 100),
      willCrossThreshold,
      monthToCross,
      safeMonthlyRevenue: (PDV_THRESHOLD - currentRevenue) / remainingMonths,
    }
  }, [currentRevenue, monthlyAverage, currentMonth])

  const monthNames = [
    "Siječanj",
    "Veljača",
    "Ožujak",
    "Travanj",
    "Svibanj",
    "Lipanj",
    "Srpanj",
    "Kolovoz",
    "Rujan",
    "Listopad",
    "Studeni",
    "Prosinac",
  ]

  return (
    <div className="bg-white border rounded-lg p-6 space-y-6">
      {/* Inputs */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Trenutni prihod (YTD)
          </label>
          <input
            type="number"
            value={currentRevenue}
            onChange={(e) => setCurrentRevenue(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prosječni mjesečni prihod
          </label>
          <input
            type="number"
            value={monthlyAverage}
            onChange={(e) => setMonthlyAverage(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trenutni mjesec</label>
          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          >
            {monthNames.map((name, idx) => (
              <option key={idx} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Bar */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Napredak prema pragu</span>
          <span>{analysis.percentageOfThreshold.toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              analysis.percentageOfThreshold > 90
                ? "bg-red-500"
                : analysis.percentageOfThreshold > 70
                  ? "bg-amber-500"
                  : "bg-green-500"
            )}
            style={{ width: `${analysis.percentageOfThreshold}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 EUR</span>
          <span>60.000 EUR</span>
        </div>
      </div>

      {/* Results */}
      <div
        className={cn(
          "p-4 rounded-lg",
          analysis.willCrossThreshold
            ? "bg-amber-50 border border-amber-200"
            : "bg-green-50 border border-green-200"
        )}
      >
        {analysis.willCrossThreshold ? (
          <>
            <h3 className="font-semibold text-amber-800 mb-2">Prelazite prag!</h3>
            <p className="text-sm text-amber-700">
              Projekcija do kraja godine:{" "}
              <strong>{analysis.projectedYearEnd.toLocaleString("hr-HR")} EUR</strong>
              {analysis.monthToCross && (
                <span className="block mt-1">
                  Očekivani prelazak praga: <strong>{monthNames[analysis.monthToCross - 1]}</strong>
                </span>
              )}
            </p>
          </>
        ) : (
          <>
            <h3 className="font-semibold text-green-800 mb-2">Ispod praga</h3>
            <p className="text-sm text-green-700">
              Projekcija do kraja godine:{" "}
              <strong>{analysis.projectedYearEnd.toLocaleString("hr-HR")} EUR</strong>
              <span className="block mt-1">
                Sigurni ste ako održite prosječni prihod ispod{" "}
                <strong>
                  {Math.floor(analysis.safeMonthlyRevenue).toLocaleString("hr-HR")} EUR/mj
                </strong>
              </span>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
```

**Verification:** Calculator shows correct projections and warning states.

---

### Task 3.3: Create Payment Slip Generator Page

**File:** `src/app/(marketing)/alati/uplatnice/page.tsx`

**Context:** Standalone tool for generating Hub3 payment slips for tax payments.

**Implementation:**

```tsx
import { Metadata } from "next"
import { PaymentSlipGenerator } from "@/components/knowledge-hub/calculators/PaymentSlipGenerator"

export const metadata: Metadata = {
  title: "Generator Uplatnica | FiskAI",
  description: "Generirajte Hub3 uplatnice za plaćanje doprinosa, poreza i prireza.",
}

export default function PaymentSlipsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Generator Uplatnica</h1>
        <p className="text-lg text-gray-600">
          Generirajte ispravne uplatnice za plaćanje doprinosa i poreza.
        </p>
      </header>

      <PaymentSlipGenerator variant="standalone" />

      <section className="mt-12 prose prose-gray max-w-none">
        <h2>Kako koristiti?</h2>
        <ol>
          <li>Odaberite vrstu uplate (MIO, HZZO, porez...)</li>
          <li>Unesite svoj OIB</li>
          <li>Unesite iznos za uplatu</li>
          <li>Skenirajte generirani barkod mobilnim bankarstvom</li>
        </ol>

        <h2>IBAN-ovi za uplate</h2>
        <ul>
          <li>
            <strong>MIO I. stup:</strong> HR1210010051863000160
          </li>
          <li>
            <strong>MIO II. stup:</strong> HR7610010051700036001
          </li>
          <li>
            <strong>HZZO:</strong> HR6510010051550100001
          </li>
          <li>
            <strong>Porez na dohodak:</strong> HR1210010051863000160
          </li>
        </ul>
      </section>
    </div>
  )
}
```

**Verification:** Page loads, payment slip generator works.

---

### Task 3.4: Create Deadline Calendar Page

**File:** `src/app/(marketing)/alati/kalendar/page.tsx`

**Context:** Visual calendar showing tax filing deadlines throughout the year.

**Implementation:**

```tsx
import { Metadata } from "next"
import { DeadlineCalendar } from "@/components/knowledge-hub/tools/DeadlineCalendar"

export const metadata: Metadata = {
  title: "Kalendar Rokova 2025 | FiskAI",
  description: "Svi važni porezni rokovi za 2025. godinu na jednom mjestu.",
}

export default function CalendarPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kalendar Rokova 2025</h1>
        <p className="text-lg text-gray-600">Ne propustite važne rokove za prijave i uplate.</p>
      </header>

      <DeadlineCalendar year={2025} />
    </div>
  )
}
```

**Verification:** Calendar displays with all deadlines.

---

### Task 3.5: Build DeadlineCalendar Component

**File:** `src/components/knowledge-hub/tools/DeadlineCalendar.tsx`

**Context:** Visual monthly calendar with color-coded deadline markers.

**Implementation:**

```tsx
"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

interface Deadline {
  date: string // YYYY-MM-DD
  title: string
  type: "doprinosi" | "pdv" | "dohodak" | "porez" | "joppd"
  description: string
  applies: string[] // ["pausalni", "obrt-dohodak", "doo"]
}

const DEADLINES_2025: Deadline[] = [
  // Monthly - Contributions (every 15th)
  ...Array.from({ length: 12 }, (_, i) => ({
    date: `2025-${String(i + 1).padStart(2, "0")}-15`,
    title: "Doprinosi",
    type: "doprinosi" as const,
    description: "Rok za uplatu mjesečnih doprinosa MIO i HZZO",
    applies: ["pausalni", "obrt-dohodak"],
  })),
  // Quarterly PDV
  {
    date: "2025-01-20",
    title: "PDV Q4/2024",
    type: "pdv",
    description: "PDV prijava za Q4 2024",
    applies: ["pdv-obveznik"],
  },
  {
    date: "2025-04-20",
    title: "PDV Q1/2025",
    type: "pdv",
    description: "PDV prijava za Q1 2025",
    applies: ["pdv-obveznik"],
  },
  {
    date: "2025-07-20",
    title: "PDV Q2/2025",
    type: "pdv",
    description: "PDV prijava za Q2 2025",
    applies: ["pdv-obveznik"],
  },
  {
    date: "2025-10-20",
    title: "PDV Q3/2025",
    type: "pdv",
    description: "PDV prijava za Q3 2025",
    applies: ["pdv-obveznik"],
  },
  // Annual
  {
    date: "2025-02-28",
    title: "Godišnja prijava",
    type: "dohodak",
    description: "Rok za godišnju prijavu poreza na dohodak",
    applies: ["pausalni", "obrt-dohodak"],
  },
  {
    date: "2025-04-30",
    title: "Prijava poreza na dobit",
    type: "porez",
    description: "Rok za prijavu poreza na dobit",
    applies: ["doo", "jdoo"],
  },
]

const typeColors = {
  doprinosi: "bg-blue-500",
  pdv: "bg-purple-500",
  dohodak: "bg-green-500",
  porez: "bg-amber-500",
  joppd: "bg-red-500",
}

interface DeadlineCalendarProps {
  year: number
}

export function DeadlineCalendar({ year }: DeadlineCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null)
  const [filter, setFilter] = useState<string>("all")

  const monthNames = [
    "Siječanj",
    "Veljača",
    "Ožujak",
    "Travanj",
    "Svibanj",
    "Lipanj",
    "Srpanj",
    "Kolovoz",
    "Rujan",
    "Listopad",
    "Studeni",
    "Prosinac",
  ]

  const getDeadlinesForMonth = (month: number) => {
    return DEADLINES_2025.filter((d) => {
      const deadlineMonth = parseInt(d.date.split("-")[1]) - 1
      const matchesMonth = deadlineMonth === month
      const matchesFilter = filter === "all" || d.applies.includes(filter)
      return matchesMonth && matchesFilter
    })
  }

  const getDaysInMonth = (month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (month: number) => {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1 // Monday = 0
  }

  const monthDeadlines = getDeadlinesForMonth(selectedMonth)
  const daysInMonth = getDaysInMonth(selectedMonth)
  const firstDay = getFirstDayOfMonth(selectedMonth)

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={cn(
            "px-3 py-1 rounded text-sm",
            filter === "all" ? "bg-gray-900 text-white" : "bg-gray-100"
          )}
        >
          Svi rokovi
        </button>
        <button
          onClick={() => setFilter("pausalni")}
          className={cn(
            "px-3 py-1 rounded text-sm",
            filter === "pausalni" ? "bg-gray-900 text-white" : "bg-gray-100"
          )}
        >
          Paušalni obrt
        </button>
        <button
          onClick={() => setFilter("doo")}
          className={cn(
            "px-3 py-1 rounded text-sm",
            filter === "doo" ? "bg-gray-900 text-white" : "bg-gray-100"
          )}
        >
          D.O.O.
        </button>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedMonth((m) => Math.max(0, m - 1))}
          className="p-2 hover:bg-gray-100 rounded"
        >
          ←
        </button>
        <h2 className="text-xl font-semibold">
          {monthNames[selectedMonth]} {year}
        </h2>
        <button
          onClick={() => setSelectedMonth((m) => Math.min(11, m + 1))}
          className="p-2 hover:bg-gray-100 rounded"
        >
          →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50">
          {["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"].map((day) => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDay }, (_, i) => (
            <div key={`empty-${i}`} className="p-2 border-t bg-gray-50" />
          ))}

          {/* Month days */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(selectedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
            const dayDeadlines = monthDeadlines.filter((d) => d.date === dateStr)
            const isToday = new Date().toISOString().split("T")[0] === dateStr

            return (
              <div key={day} className={cn("p-2 border-t min-h-[80px]", isToday && "bg-blue-50")}>
                <span className={cn("text-sm", isToday && "font-bold text-blue-600")}>{day}</span>
                <div className="mt-1 space-y-1">
                  {dayDeadlines.map((deadline, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDeadline(deadline)}
                      className={cn(
                        "w-full text-left text-xs p-1 rounded text-white truncate",
                        typeColors[deadline.type]
                      )}
                    >
                      {deadline.title}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected deadline details */}
      {selectedDeadline && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{selectedDeadline.title}</h3>
              <p className="text-sm text-gray-500">{selectedDeadline.date}</p>
            </div>
            <button
              onClick={() => setSelectedDeadline(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-sm">{selectedDeadline.description}</p>
          <div className="mt-2">
            <span className="text-xs text-gray-500">Primjenjuje se na: </span>
            {selectedDeadline.applies.join(", ")}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {Object.entries(typeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <span className={cn("w-3 h-3 rounded", color)} />
            <span className="capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Verification:** Calendar navigates months, deadlines display correctly, filter works.

---

### Task 3.6: Create Tools Directory Index

**File:** `src/components/knowledge-hub/tools/index.ts`

**Implementation:**

```typescript
export { DeadlineCalendar } from "./DeadlineCalendar"
```

**Verification:** Import works from index.

---

## Phase 4: Content

### Task 4.1: Expand pausalni-obrt.mdx Guide

**File:** `content/vodici/pausalni-obrt.mdx`

**Context:** Comprehensive guide covering all paušalni variations with VariantTabs.

**Structure (abbreviated - full content ~800 lines):**

```mdx
---
title: Paušalni obrt
description: Kompletan vodič za paušalne obrtnike u 2025. godini
lastUpdated: 2025-01-01
---

<QuickStatsBar
  title="Paušalni obrt"
  stats={[
    { label: "Max prihod", value: "60.000€" },
    { label: "Doprinosi", value: "262€/mj" },
    { label: "Porez", value: "~10%" },
    { label: "PDV", value: "Ne" },
  ]}
/>

## Brzi pregled

Paušalni obrt je najjednostavniji oblik poslovanja u Hrvatskoj...

<ContributionCalculator />

## Tko može / Tko ne može

### Možete otvoriti paušalni obrt ako:

- Očekujete godišnji prihod do 60.000€
- Bavite se dozvoljenom djelatnošću
- Nemate zabranu poslovanja

### Ne možete ako:

- Imate PDV registraciju
- Već imate obrt na dohodak
- Djelatnost je isključena iz paušala

## Troškovi i porezi

<TaxCalculator />

## Varijante

<VariantTabs
  tabs={[
    { id: "osnovni", label: "Osnovni" },
    { id: "uz-zaposlenje", label: "Uz zaposlenje" },
    { id: "umirovljenik", label: "Umirovljenik" },
    { id: "student", label: "Student" },
  ]}
>
  <TabPanel>
    ### Paušalni obrt kao primarni izvor prihoda

    Ako paušalni obrt otvarate kao glavni izvor prihoda...

    **Doprinosi:**
    - MIO I. stup: 153,70€/mj
    - MIO II. stup: 47,03€/mj (ako ste u II. stupu)
    - HZZO: 61,27€/mj

  </TabPanel>

  <TabPanel>
    ### Paušalni obrt uz zaposlenje

    Ako ste zaposleni kod drugog poslodavca...

    <PDVCallout type="info">
      Doprinose za MIO i HZZO već plaća vaš poslodavac, pa vi plaćate
      samo razliku ako je osnovica paušala viša.
    </PDVCallout>

  </TabPanel>

  <TabPanel>
    ### Paušalni obrt za umirovljenike

    Kao umirovljenik možete imati paušalni obrt uz mirovinu...

  </TabPanel>

  <TabPanel>
    ### Paušalni obrt za studente

    Studenti mogu otvoriti paušalni obrt...

  </TabPanel>
</VariantTabs>

## Registracija korak-po-korak

1. Pribavite dokumentaciju...
2. Posjetite e-Građani ili HITRO.HR...
3. Izaberite djelatnost...

## Obveze

### Mjesečne

- Uplata doprinosa do 15. u mjesecu

### Kvartalne

- Nema kvartalnih obveza

### Godišnje

- PO-SD obrazac do 28. veljače
- HOK članarina

## PDV i vi

<PDVCallout type="warning" threshold={60000}>
  Ako vaš prihod prijeđe 60.000€, automatski postajete PDV obveznik od 1. sljedećeg mjeseca.
</PDVCallout>

### Kada postajete obveznik?

...

### Dobrovoljni ulazak u PDV sustav

...

<PDVCallout type="tip" context="voluntary">
  Ako imate značajne ulazne troškove (oprema, softver), razmislite o dobrovoljnom ulasku u PDV jer
  možete odbiti ulazni PDV.
</PDVCallout>

## Česta pitanja

<FAQ
  items={[
    {
      question: "Mogu li imati paušalni obrt uz posao?",
      answer: "Da, možete. Doprinosi se umanjuju jer ih već plaća poslodavac...",
    },
    {
      question: "Što ako prijeđem 60.000€?",
      answer: "Automatski postajete PDV obveznik od sljedećeg mjeseca...",
    },
  ]}
/>

## Povezane usporedbe

- [Paušalni vs Obrt na dohodak vs J.D.O.O.](/usporedba/pocinjem-solo)
- [Dodatni prihod uz posao](/usporedba/dodatni-prihod)
```

**Verification:** Guide renders with all components working, tabs switch content.

---

### Task 4.2: Create obrt-dohodak.mdx Guide

**File:** `content/vodici/obrt-dohodak.mdx`

**Context:** Comprehensive guide for obrt na dohodak (income-based craft).

**Structure:** Similar to pausalni-obrt.mdx with variations:

- Osnovni
- Uz zaposlenje
- Prijelaz na dobit
- PDV obveznik

**Key differences to document:**

- Bookkeeping requirements
- Expense deductions
- Different tax calculation
- When to switch to dobit (profit-based)

**Verification:** Guide renders correctly, calculation examples match.

---

### Task 4.3: Create doo.mdx Guide

**File:** `content/vodici/doo.mdx`

**Context:** Combined guide for J.D.O.O. and D.O.O. with comparison sections.

**Structure:**

- J.D.O.O. vs D.O.O. comparison
- Director salary scenarios (with/without other employment)
- Single-member vs multi-member
- Profit distribution

**Verification:** Guide covers both entity types, comparison sections clear.

---

### Task 4.4: Create freelancer.mdx Guide

**File:** `content/vodici/freelancer.mdx`

**Context:** Guide for freelancers, especially IT and creative professionals.

**Structure:**

- IT freelancer specifics
- Creative services
- Foreign clients (EU/non-EU)
- Platform work (Upwork, Fiverr)
- PDV for EU services (reverse charge)

**Verification:** Guide addresses common freelancer scenarios.

---

### Task 4.5: Create posebni-oblici.mdx Guide

**File:** `content/vodici/posebni-oblici.mdx`

**Context:** Guide covering special business forms.

**Structure:**

- OPG (family farm)
- Slobodna profesija (freelance professions)
- Udruga (association/NGO)
- Zadruga (cooperative)

**Verification:** Each special form documented with key differences.

---

### Task 4.6: Create pocinjem-solo.mdx Comparison

**File:** `content/usporedbe/pocinjem-solo.mdx`

**Context:** Comparison page for solo entrepreneurs starting out.

**Implementation:**

```mdx
---
title: Želim početi sam/a
description: Usporedba opcija za one koji žele pokrenuti vlastiti posao
compares: ["pausalni", "obrt-dohodak", "jdoo", "freelancer"]
decisionContext: "starting-solo"
---

## Koja opcija je za vas?

Ako želite započeti samostalno poslovanje, imate nekoliko opcija.
Svaka ima svoje prednosti i nedostatke ovisno o vašoj situaciji.

<ComparisonTable
  columns={[
    { id: "pausalni", name: "Paušalni obrt" },
    { id: "obrt-dohodak", name: "Obrt na dohodak" },
    { id: "jdoo", name: "J.D.O.O." },
  ]}
  rows={[
    {
      label: "Max godišnji prihod",
      values: { pausalni: "60.000€", "obrt-dohodak": "Neograničeno", jdoo: "Neograničeno" },
    },
    {
      label: "PDV obveza",
      values: {
        pausalni: "Ne (do praga)",
        "obrt-dohodak": "Da (preko praga)",
        jdoo: "Da (preko praga)",
      },
    },
    {
      label: "Knjigovodstvo",
      values: { pausalni: "Nije potrebno", "obrt-dohodak": "Jednostavno", jdoo: "Dvojno" },
    },
    {
      label: "Odgovornost",
      values: { pausalni: "Osobna", "obrt-dohodak": "Osobna", jdoo: "Ograničena" },
    },
    { label: "Osnivački kapital", values: { pausalni: "0€", "obrt-dohodak": "0€", jdoo: "10€" } },
  ]}
/>

## Koliko vas košta svaka opcija?

<ComparisonCalculator businessTypes={["pausalni", "obrt-dohodak", "jdoo"]} />

## Koja opcija je najbolja za vas?

<div className="grid md:grid-cols-3 gap-4 my-8">
  <RecommendationCard
    businessType="pausalni"
    title="Paušalni obrt"
    bestFor={[
      "Prihodi do 40.000€ godišnje",
      "Želite jednostavnost",
      "Nemate značajne troškove",
      "Ne trebate odbijati PDV",
    ]}
    notSuitableFor={[
      "Prihodi preko 60.000€",
      "Značajni ulazni troškovi",
      "Želite ograničenu odgovornost",
    ]}
  />

<RecommendationCard
  businessType="obrt-dohodak"
  title="Obrt na dohodak"
  bestFor={["Prihodi 40.000-100.000€", "Značajni poslovni troškovi", "Trebate odbijati PDV"]}
  notSuitableFor={["Želite jednostavnost", "Mali troškovi", "Potrebna ograničena odgovornost"]}
/>

  <RecommendationCard
    businessType="jdoo"
    title="J.D.O.O."
    bestFor={[
      "Želite ograničenu odgovornost",
      "Planirate rast",
      "Radite s većim klijentima",
    ]}
    notSuitableFor={[
      "Želite jednostavnost",
      "Mali prihodi",
      "Ne želite plaću direktoru",
    ]}
  />
</div>
```

**Verification:** Comparison renders with table, calculator, and cards.

---

### Task 4.7: Create firma.mdx Comparison

**File:** `content/usporedbe/firma.mdx`

**Context:** Comparison for those wanting to start a company (j.d.o.o. vs d.o.o.).

**Verification:** Covers both company types with capital requirements, governance differences.

---

### Task 4.8: Create dodatni-prihod.mdx Comparison

**File:** `content/usporedbe/dodatni-prihod.mdx`

**Context:** Comparison for employed people wanting additional income.

**Verification:** Shows reduced contribution scenarios for employed people.

---

### Task 4.9: Create preko-praga.mdx Comparison

**File:** `content/usporedbe/preko-praga.mdx`

**Context:** Guidance for crossing 60.000€ threshold.

**Verification:** Explains what changes, options, and timeline.

---

## Phase 5: Wizard Update

### Task 5.1: Update Wizard Logic

**File:** `src/lib/knowledge-hub/wizard-logic.ts`

**Context:** Simplify wizard from 6 questions to 4, route to comparison pages.

**Replace existing logic:**

```typescript
export type WorkStatus = "employed" | "unemployed" | "retired" | "student"
export type Goal = "additional-income" | "primary-income" | "company-partners"
export type RevenueRange = "low" | "medium" | "high" // <40k, 40-60k, >60k
export type ActivityType = "it" | "creative" | "trade" | "other"

export interface WizardState {
  step: number
  workStatus?: WorkStatus
  goal?: Goal
  revenueRange?: RevenueRange
  activityType?: ActivityType
}

export interface WizardResult {
  path: string
  params: Record<string, string>
}

export function getNextStep(state: WizardState): number | "complete" {
  const { step, workStatus, goal } = state

  switch (step) {
    case 1: // Work status
      if (workStatus === "retired") return "complete"
      if (workStatus === "student") return "complete"
      return 2
    case 2: // Goal
      if (goal === "additional-income") return "complete"
      if (goal === "company-partners") return "complete"
      return 3
    case 3: // Revenue
      return 4
    case 4: // Activity (optional)
      return "complete"
    default:
      return "complete"
  }
}

export function getWizardResult(state: WizardState): WizardResult {
  const { workStatus, goal, revenueRange, activityType } = state

  // Direct routes for specific cases
  if (workStatus === "retired") {
    return { path: "/vodic/pausalni-obrt", params: { varijanta: "umirovljenik" } }
  }
  if (workStatus === "student") {
    return { path: "/vodic/pausalni-obrt", params: { varijanta: "student" } }
  }

  // Comparison routes
  if (goal === "additional-income") {
    return { path: "/usporedba/dodatni-prihod", params: {} }
  }
  if (goal === "company-partners") {
    return { path: "/usporedba/firma", params: { tip: "viseclano" } }
  }

  // Solo entrepreneur path
  if (revenueRange === "high") {
    return { path: "/usporedba/preko-praga", params: {} }
  }

  const params: Record<string, string> = {}
  if (revenueRange) params.prihod = revenueRange
  if (activityType) params.djelatnost = activityType

  return { path: "/usporedba/pocinjem-solo", params }
}

export function buildResultUrl(result: WizardResult): string {
  const { path, params } = result
  const searchParams = new URLSearchParams(params).toString()
  return searchParams ? `${path}?${searchParams}` : path
}
```

**Verification:** Test all question paths lead to correct destinations.

---

### Task 5.2: Update WizardContainer Component

**File:** `src/components/knowledge-hub/wizard/WizardContainer.tsx`

**Context:** Update UI to match new 4-question flow.

**Key changes:**

1. Update question content for each step
2. Update answer options
3. Connect to new wizard-logic functions
4. Update progress indicator (4 steps max)

**Verification:** Wizard flows through all paths correctly.

---

### Task 5.3: Add Wizard Tests

**File:** `src/lib/knowledge-hub/__tests__/wizard-logic.test.ts`

**Context:** Test coverage for all wizard paths.

**Implementation:**

```typescript
import { describe, it } from "node:test"
import assert from "node:assert"
import { getNextStep, getWizardResult, buildResultUrl } from "../wizard-logic"

describe("Wizard Logic", () => {
  describe("getNextStep", () => {
    it("should complete immediately for retired", () => {
      assert.strictEqual(getNextStep({ step: 1, workStatus: "retired" }), "complete")
    })

    it("should complete immediately for student", () => {
      assert.strictEqual(getNextStep({ step: 1, workStatus: "student" }), "complete")
    })

    it("should proceed to step 2 for employed", () => {
      assert.strictEqual(getNextStep({ step: 1, workStatus: "employed" }), 2)
    })

    it("should complete at step 2 for additional-income goal", () => {
      assert.strictEqual(
        getNextStep({ step: 2, workStatus: "employed", goal: "additional-income" }),
        "complete"
      )
    })
  })

  describe("getWizardResult", () => {
    it("should route retired to pausalni with umirovljenik variant", () => {
      const result = getWizardResult({ step: 1, workStatus: "retired" })
      assert.strictEqual(result.path, "/vodic/pausalni-obrt")
      assert.strictEqual(result.params.varijanta, "umirovljenik")
    })

    it("should route additional-income to comparison page", () => {
      const result = getWizardResult({
        step: 2,
        workStatus: "employed",
        goal: "additional-income",
      })
      assert.strictEqual(result.path, "/usporedba/dodatni-prihod")
    })

    it("should route high revenue to preko-praga comparison", () => {
      const result = getWizardResult({
        step: 3,
        workStatus: "unemployed",
        goal: "primary-income",
        revenueRange: "high",
      })
      assert.strictEqual(result.path, "/usporedba/preko-praga")
    })
  })

  describe("buildResultUrl", () => {
    it("should build URL with params", () => {
      const url = buildResultUrl({
        path: "/usporedba/pocinjem-solo",
        params: { prihod: "low", djelatnost: "it" },
      })
      assert.ok(url.includes("/usporedba/pocinjem-solo"))
      assert.ok(url.includes("prihod=low"))
      assert.ok(url.includes("djelatnost=it"))
    })
  })
})
```

**Verification:** `npm run test:knowledge-hub` passes all wizard tests.

---

## Phase 6: Homepage

### Task 6.1: Create Homepage Hero with Wizard CTA

**File:** `src/app/(marketing)/page.tsx` (or component extraction)

**Context:** Update homepage to feature Knowledge Hub prominently with wizard entry point.

**Key sections:**

1. Hero with "Ne znate koji oblik poslovanja?" + Start Wizard CTA
2. Problem categories (cards linking to comparison pages)
3. Popular guides preview
4. Calculator quick access

**Implementation example:**

```tsx
{
  /* Knowledge Hub Hero */
}
;<section className="py-16 bg-gradient-to-b from-blue-50 to-white">
  <div className="max-w-6xl mx-auto px-4 text-center">
    <h1 className="text-4xl font-bold text-gray-900 mb-4">
      Ne znate koji oblik poslovanja vam odgovara?
    </h1>
    <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
      Odgovorite na 4 pitanja i saznajte koja opcija je najbolja za vašu situaciju.
    </p>
    <a
      href="/wizard"
      className="inline-block bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
    >
      Započni čarobnjaka
    </a>
  </div>
</section>

{
  /* Problem Categories */
}
;<section className="py-16">
  <div className="max-w-6xl mx-auto px-4">
    <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Što vas zanima?</h2>
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      <a
        href="/usporedba/pocinjem-solo"
        className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
      >
        <h3 className="font-semibold mb-2">Želim početi sam/a</h3>
        <p className="text-sm text-gray-600">Usporedite paušalni, obrt i j.d.o.o.</p>
      </a>
      <a
        href="/usporedba/firma"
        className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
      >
        <h3 className="font-semibold mb-2">Želim osnovati firmu</h3>
        <p className="text-sm text-gray-600">J.D.O.O. vs D.O.O. usporedba</p>
      </a>
      <a
        href="/usporedba/dodatni-prihod"
        className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
      >
        <h3 className="font-semibold mb-2">Dodatni prihod uz posao</h3>
        <p className="text-sm text-gray-600">Opcije za zaposlene</p>
      </a>
      <a
        href="/usporedba/preko-praga"
        className="block p-6 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
      >
        <h3 className="font-semibold mb-2">Prelazim 60.000€</h3>
        <p className="text-sm text-gray-600">Što znači PDV obveza</p>
      </a>
    </div>
  </div>
</section>
```

**Verification:** Homepage has clear wizard entry, categories link correctly.

---

### Task 6.2: Create Knowledge Hub Landing Page

**File:** `src/app/(marketing)/baza-znanja/page.tsx`

**Context:** Index page for all guides and comparisons.

**Sections:**

1. All 5 guides with descriptions
2. All 4 comparisons with descriptions
3. Tools section (calculators, calendar)
4. Search functionality (future)

**Verification:** All guides and comparisons accessible from landing page.

---

## Phase 7: Polish

### Task 7.1: Add SEO Structured Data

**Files:**

- `src/app/(marketing)/vodic/[slug]/page.tsx`
- `src/app/(marketing)/usporedba/[slug]/page.tsx`

**Context:** Add JSON-LD structured data for better search results.

**Implementation (add to page files):**

```tsx
// In generateMetadata or page component
const structuredData = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": guide.frontmatter.title,
  "description": guide.frontmatter.description,
  "author": {
    "@type": "Organization",
    "name": "FiskAI"
  },
  "dateModified": guide.frontmatter.lastUpdated,
  "publisher": {
    "@type": "Organization",
    "name": "FiskAI",
    "logo": {
      "@type": "ImageObject",
      "url": "https://fiskai.com/logo.png"
    }
  }
}

// In return
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
/>
```

**Verification:** Google Rich Results Test validates structured data.

---

### Task 7.2: Mobile Optimization for Comparison Tables

**File:** `src/components/knowledge-hub/comparison/ComparisonTable.tsx`

**Context:** Ensure comparison tables work well on mobile devices.

**Changes:**

1. Horizontal scroll indicator on mobile
2. Swipe hint animation
3. First column sticky on horizontal scroll
4. Touch-friendly tap targets

**Verification:** Tables usable on mobile devices.

---

### Task 7.3: Internal Linking Audit

**Context:** Ensure all guides link to relevant comparisons and vice versa.

**Checklist:**

- [ ] Each guide has "Povezane usporedbe" section
- [ ] Each comparison links to deep-dive guides
- [ ] Wizard results link to relevant content
- [ ] Calculator pages link to related guides
- [ ] Tool pages link to related content

**Verification:** No dead ends in user journey.

---

### Task 7.4: Build Verification

**Commands:**

```bash
npm run build
npm run test:knowledge-hub
```

**Verification:** Build succeeds, all tests pass.

---

## Summary

| Phase | Tasks | Key Deliverables                                        |
| ----- | ----- | ------------------------------------------------------- |
| 1     | 9     | Comparison route, ComparisonTable, ComparisonCalculator |
| 2     | 6     | VariantTabs, PDVCallout, QuickStatsBar, TableOfContents |
| 3     | 6     | PDV calculator, Payment slips, Deadline calendar        |
| 4     | 9     | 5 guides + 4 comparison MDX files                       |
| 5     | 3     | Updated wizard logic and UI                             |
| 6     | 2     | Homepage hero, Knowledge hub landing                    |
| 7     | 4     | SEO, mobile optimization, linking, verification         |

**Total: 39 tasks**

---

_Implementation plan created for Knowledge Hub v2 redesign._
