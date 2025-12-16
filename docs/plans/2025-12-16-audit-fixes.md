# Audit Fixes Implementation Plan

## Context

After reviewing 7 audit reports and checking actual file state, most issues were already fixed. Two remain:

1. Missing `/usporedba/page.tsx` comparison listing page
2. Missing upsell CTA on `kalkulator-doprinosa/page.tsx`

## Tasks

### Task 1: Create Comparison Listing Page

**File to create:** `src/app/(marketing)/usporedba/page.tsx`

**Reference template:** `src/app/(marketing)/vodic/page.tsx`

**Implementation:**

```tsx
import { Metadata } from "next"
import Link from "next/link"
import { getAllComparisons } from "@/lib/mdx"
import { ComparisonsExplorer } from "./ComparisonsExplorer"

export const metadata: Metadata = {
  title: "Usporedbe oblika poslovanja | FiskAI",
  description:
    "Usporedite različite oblike poslovanja u Hrvatskoj: paušalni obrt, obrt dohodaš, d.o.o., freelance i više.",
}

export default function ComparisonsIndexPage() {
  const comparisons = getAllComparisons().map((c) => ({
    slug: c.slug,
    title: c.frontmatter.title,
    description: c.frontmatter.description,
  }))

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{" "}
        <span className="text-[var(--muted)]">/</span>{" "}
        <span className="text-[var(--foreground)]">Usporedbe</span>
      </nav>

      <header className="text-center">
        <h1 className="text-display text-4xl font-semibold md:text-5xl">
          Usporedbe oblika poslovanja
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-[var(--muted)]">
          Pronađite idealan oblik poslovanja za vašu situaciju. Detaljne usporedbe poreza, doprinosa
          i administrativnih obveza.
        </p>
      </header>

      <ComparisonsExplorer comparisons={comparisons} />
    </div>
  )
}
```

**Also create:** `src/app/(marketing)/usporedba/ComparisonsExplorer.tsx`

```tsx
"use client"

import Link from "next/link"
import { ArrowRight, Scale } from "lucide-react"

interface Comparison {
  slug: string
  title: string
  description: string
}

export function ComparisonsExplorer({ comparisons }: { comparisons: Comparison[] }) {
  return (
    <div className="mt-10 grid gap-4 sm:grid-cols-2">
      {comparisons.map((comparison) => (
        <Link
          key={comparison.slug}
          href={`/usporedba/${comparison.slug}`}
          className="group flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-blue-300 hover:shadow-md"
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
            <Scale className="h-5 w-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-[var(--foreground)] group-hover:text-blue-600">
            {comparison.title}
          </h3>
          <p className="mt-1 flex-1 text-sm text-[var(--muted)]">{comparison.description}</p>
          <div className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600">
            Pročitaj usporedbu
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      ))}
    </div>
  )
}
```

**Verification:**

- Run `npm run build` to ensure no errors
- Navigate to `/usporedba` and verify listing renders
- Verify all comparison links work

---

### Task 2: Add Upsell to Contribution Calculator

**File to edit:** `src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx`

**Reference pattern:** Lines 764-793 of `POSDCalculatorClient.tsx`

**Add after line 53** (after the "Povezani vodiči" section):

```tsx
{
  /* FiskAI Upsell */
}
;<div className="mt-8 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
  <div className="flex items-start gap-4">
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
      <Rocket className="h-6 w-6 text-white" />
    </div>
    <div className="flex-1">
      <h3 className="font-bold text-slate-900">Automatski izračun s FiskAI</h3>
      <p className="mt-1 text-sm text-slate-600">
        Zaboravi na ručne kalkulacije. FiskAI automatski izračunava doprinose, generira uplatnice i
        podsjeća te na rokove.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Započni besplatno
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/features"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Saznaj više
        </Link>
      </div>
    </div>
  </div>
</div>
```

**Add imports at top:**

```tsx
import { ArrowRight, Rocket } from "lucide-react"
```

**Verification:**

- Run `npm run build` to ensure no errors
- Navigate to `/alati/kalkulator-doprinosa` and verify upsell appears
- Check styling matches other tool pages

---

## Execution Order

1. Task 1: Create comparison listing page (2 files)
2. Task 2: Add upsell to contribution calculator (1 file edit)

## Success Criteria

- `npm run build` passes with no errors
- `/usporedba` page renders with all comparison links
- `/alati/kalkulator-doprinosa` has upsell section matching other tool pages
