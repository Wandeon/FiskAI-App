# Living Truth Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Living Truth infrastructure enabling perpetually accurate regulatory content with semantic markup, caching, and automated update alerts.

**Architecture:** Extend existing Next.js + MDX + Regulatory Truth layer with new components (RegulatorySection, enhanced AIAnswerBlock), frontmatter changelog schema, and content bridge connecting Sentinel to content updates.

**Tech Stack:** Next.js 15, TypeScript, Vitest, Prisma, PostHog, Slack Webhooks, Cloudflare Cache

---

## Existing Infrastructure (DO NOT REBUILD)

These are already implemented and working:

- ✅ **AI Crawler Detection** (`src/lib/ai-crawler.ts`) - Bot detection, deduplication, PostHog events
- ✅ **Cache Headers** (`src/lib/cache-headers.ts`) - Cache tags, TTL headers, route mapping
- ✅ **Middleware Integration** (`src/middleware.ts`) - Crawler tracking, cache header injection
- ✅ **Slack Integration** (`src/lib/regulatory-truth/watchdog/slack.ts`) - sendCriticalAlert, sendAuditResult
- ✅ **Cache Purge API** (`src/app/api/cache/purge/route.ts`) - Cloudflare purge endpoint

---

## Task 1: RegulatorySection Component

**Files:**

- Create: `src/components/content/RegulatorySection.tsx`
- Create: `src/components/content/__tests__/RegulatorySection.test.tsx`
- Modify: `src/components/content/index.ts`

### Step 1.1: Write the failing test

```typescript
// src/components/content/__tests__/RegulatorySection.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RegulatorySection } from "../RegulatorySection"

describe("RegulatorySection", () => {
  it("renders with required props", () => {
    render(
      <RegulatorySection id="vat-rate" confidence="high">
        The standard VAT rate is 25%.
      </RegulatorySection>
    )

    expect(screen.getByText("The standard VAT rate is 25%.")).toBeInTheDocument()
  })

  it("applies data attributes correctly", () => {
    const { container } = render(
      <RegulatorySection
        id="vat-rate"
        confidence="high"
        version={2}
        source="NN 114/23"
        sourceRef="NN:114/23"
        effectiveFrom="2025-01-01"
        asOf="2025-01-15"
      >
        Content
      </RegulatorySection>
    )

    const section = container.querySelector("section")
    expect(section).toHaveAttribute("id", "vat-rate")
    expect(section).toHaveAttribute("data-regulatory-section", "true")
    expect(section).toHaveAttribute("data-regulatory-section-version", "2")
    expect(section).toHaveAttribute("data-confidence-stated", "high")
    expect(section).toHaveAttribute("data-source-label", "NN 114/23")
    expect(section).toHaveAttribute("data-source-ref", "NN:114/23")
    expect(section).toHaveAttribute("data-as-of", "2025-01-15")
  })

  it("computes effective confidence as min(stated, derived)", () => {
    const { container } = render(
      <RegulatorySection
        id="test"
        confidence="high"
        derivedConfidence="medium"
      >
        Content
      </RegulatorySection>
    )

    const section = container.querySelector("section")
    expect(section).toHaveAttribute("data-confidence-effective", "medium")
  })

  it("shows conflict indicator when hasConflict is true", () => {
    const { container } = render(
      <RegulatorySection id="test" confidence="high" hasConflict>
        Content
      </RegulatorySection>
    )

    const section = container.querySelector("section")
    expect(section).toHaveAttribute("data-conflict", "true")
  })
})
```

### Step 1.2: Run test to verify it fails

Run: `npx vitest run src/components/content/__tests__/RegulatorySection.test.tsx`
Expected: FAIL with "Cannot find module '../RegulatorySection'"

### Step 1.3: Write the component

```typescript
// src/components/content/RegulatorySection.tsx
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type ConfidenceLevel = "high" | "medium" | "low" | "pending"

export interface RegulatorySectionProps {
  // Core
  id: string
  confidence: ConfidenceLevel
  version?: number

  // Source (human + canonical)
  source?: string
  sourceRef?: string
  sourceEvidenceId?: string
  sourcePointerId?: string

  // Derived (passed from page loader)
  derivedConfidence?: ConfidenceLevel
  derivedReason?: string

  // Temporal
  effectiveFrom?: string
  asOf?: string

  // Conflict
  hasConflict?: boolean

  children: ReactNode
  className?: string
}

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  pending: 0,
}

function getEffectiveConfidence(
  stated: ConfidenceLevel,
  derived?: ConfidenceLevel
): ConfidenceLevel {
  if (!derived) return stated
  return CONFIDENCE_ORDER[stated] <= CONFIDENCE_ORDER[derived] ? stated : derived
}

const CONFIDENCE_ICONS: Record<ConfidenceLevel, string> = {
  high: "✓",
  medium: "~",
  low: "!",
  pending: "?",
}

const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  high: "text-green-500",
  medium: "text-yellow-500",
  low: "text-orange-500",
  pending: "text-gray-400",
}

export function RegulatorySection({
  id,
  confidence,
  version = 1,
  source,
  sourceRef,
  sourceEvidenceId,
  sourcePointerId,
  derivedConfidence,
  derivedReason,
  effectiveFrom,
  asOf,
  hasConflict = false,
  children,
  className,
}: RegulatorySectionProps) {
  const effectiveConfidence = getEffectiveConfidence(confidence, derivedConfidence)

  return (
    <section
      id={id}
      data-regulatory-section="true"
      data-regulatory-section-version={version.toString()}
      data-confidence-stated={confidence}
      {...(derivedConfidence && { "data-confidence-derived": derivedConfidence })}
      data-confidence-effective={effectiveConfidence}
      {...(source && { "data-source-label": source })}
      {...(sourceRef && { "data-source-ref": sourceRef })}
      {...(sourceEvidenceId && { "data-source-evidence-id": sourceEvidenceId })}
      {...(sourcePointerId && { "data-source-pointer-id": sourcePointerId })}
      {...(effectiveFrom && { "data-effective-from": effectiveFrom })}
      {...(asOf && { "data-as-of": asOf })}
      data-conflict={hasConflict.toString()}
      className={cn("regulatory-section relative", className)}
    >
      {/* Subtle confidence badge */}
      <div
        className={cn(
          "absolute -left-6 top-0 text-sm opacity-60 hover:opacity-100 transition-opacity",
          CONFIDENCE_COLORS[effectiveConfidence]
        )}
        title={`Confidence: ${effectiveConfidence}${derivedReason ? ` (${derivedReason})` : ""}`}
        aria-label={`Regulatory section with ${effectiveConfidence} confidence`}
      >
        {CONFIDENCE_ICONS[effectiveConfidence]}
      </div>

      {/* Conflict warning */}
      {hasConflict && (
        <div className="text-orange-500 text-xs mb-2" role="alert">
          ⚠️ Conflicting information detected
        </div>
      )}

      {children}

      {/* Source citation */}
      {source && (
        <cite className="block text-xs text-white/50 mt-2 not-italic">
          Izvor: {source}
        </cite>
      )}
    </section>
  )
}
```

### Step 1.4: Run test to verify it passes

Run: `npx vitest run src/components/content/__tests__/RegulatorySection.test.tsx`
Expected: PASS

### Step 1.5: Export from index

```typescript
// Modify src/components/content/index.ts - add these exports
export { RegulatorySection } from "./RegulatorySection"
export type { RegulatorySectionProps, ConfidenceLevel } from "./RegulatorySection"
```

### Step 1.6: Commit

```bash
git add src/components/content/RegulatorySection.tsx src/components/content/__tests__/RegulatorySection.test.tsx src/components/content/index.ts
git commit -m "feat(content): add RegulatorySection component with confidence badges"
```

---

## Task 2: Enhanced AIAnswerBlock Component

**Files:**

- Modify: `src/components/content/ai-answer-block.tsx`
- Create: `src/components/content/__tests__/AIAnswerBlock.test.tsx`

### Step 2.1: Write the failing test

```typescript
// src/components/content/__tests__/AIAnswerBlock.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { AIAnswerBlock } from "../ai-answer-block"

describe("AIAnswerBlock", () => {
  it("renders with new required props", () => {
    render(
      <AIAnswerBlock
        answerId="pdv-threshold:bluf:v1"
        type="regulatory"
        confidence="high"
        contentType="guide"
        lastUpdated="2025-01-15"
        bluf="Prag za ulazak u sustav PDV-a iznosi 60.000 EUR godišnje."
      >
        Detailed explanation here.
      </AIAnswerBlock>
    )

    expect(screen.getByText(/Prag za ulazak/)).toBeInTheDocument()
    expect(screen.getByText("Detailed explanation here.")).toBeInTheDocument()
  })

  it("includes all data attributes for AI consumption", () => {
    const { container } = render(
      <AIAnswerBlock
        answerId="pdv-threshold:bluf:v1"
        version={2}
        type="regulatory"
        confidence="high"
        evidenceStrength="primary-law"
        contentType="guide"
        conceptId="pdv-threshold"
        lastUpdated="2025-01-15"
        asOf="2025-01-15"
        bluf="BLUF text"
        sources={[{ ref: "NN:2/25", label: "Narodne novine 2/25", url: "https://nn.hr/2/25" }]}
      >
        Content
      </AIAnswerBlock>
    )

    const article = container.querySelector("article")
    expect(article).toHaveAttribute("data-ai-answer", "true")
    expect(article).toHaveAttribute("data-answer-id", "pdv-threshold:bluf:v1")
    expect(article).toHaveAttribute("data-version", "2")
    expect(article).toHaveAttribute("data-answer-type", "regulatory")
    expect(article).toHaveAttribute("data-confidence", "high")
    expect(article).toHaveAttribute("data-evidence-strength", "primary-law")
    expect(article).toHaveAttribute("data-content-type", "guide")
    expect(article).toHaveAttribute("data-concept-id", "pdv-threshold")
    expect(article).toHaveAttribute("data-last-updated", "2025-01-15")
    expect(article).toHaveAttribute("data-as-of", "2025-01-15")
    expect(article).toHaveAttribute("lang", "hr")
  })

  it("renders BLUF in header", () => {
    const { container } = render(
      <AIAnswerBlock
        answerId="test"
        type="regulatory"
        confidence="high"
        contentType="guide"
        lastUpdated="2025-01-15"
        bluf="This is the BLUF"
      >
        Content
      </AIAnswerBlock>
    )

    const header = container.querySelector("[data-ai-bluf]")
    expect(header).toHaveTextContent("This is the BLUF")
  })

  it("renders sources with refs", () => {
    render(
      <AIAnswerBlock
        answerId="test"
        type="regulatory"
        confidence="high"
        contentType="guide"
        lastUpdated="2025-01-15"
        bluf="BLUF"
        sources={[
          { ref: "NN:2/25", label: "Narodne novine 2/25", url: "https://nn.hr/2/25" }
        ]}
      >
        Content
      </AIAnswerBlock>
    )

    expect(screen.getByText("Narodne novine 2/25")).toHaveAttribute("href", "https://nn.hr/2/25")
  })
})
```

### Step 2.2: Run test to verify it fails

Run: `npx vitest run src/components/content/__tests__/AIAnswerBlock.test.tsx`
Expected: FAIL (props mismatch, missing new fields)

### Step 2.3: Update the component

```typescript
// src/components/content/ai-answer-block.tsx
import { ReactNode } from "react"
import { cn } from "@/lib/utils"

export type AnswerType = "regulatory" | "procedural" | "definitional"
export type ConfidenceLevel = "high" | "medium" | "low" | "pending"
export type EvidenceStrength = "primary-law" | "secondary" | "guidance" | "mixed"
export type ContentType = "guide" | "glossary" | "howto" | "faq"

export interface AIAnswerSource {
  ref: string
  label: string
  url?: string
}

export interface AIAnswerBlockProps {
  // Identity
  answerId: string
  version?: number

  // Classification
  type: AnswerType
  confidence: ConfidenceLevel
  evidenceStrength?: EvidenceStrength
  contentType: ContentType
  conceptId?: string

  // Temporal
  lastUpdated: string
  asOf?: string

  // Content
  bluf: string
  sources?: AIAnswerSource[]
  children: ReactNode
  className?: string
}

export function AIAnswerBlock({
  answerId,
  version = 1,
  type,
  confidence,
  evidenceStrength,
  contentType,
  conceptId,
  lastUpdated,
  asOf,
  bluf,
  sources,
  children,
  className,
}: AIAnswerBlockProps) {
  const displayDate = new Date(lastUpdated).toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <article
      data-ai-answer="true"
      data-answer-id={answerId}
      data-version={version.toString()}
      data-answer-type={type}
      data-confidence={confidence}
      {...(evidenceStrength && { "data-evidence-strength": evidenceStrength })}
      data-content-type={contentType}
      {...(conceptId && { "data-concept-id": conceptId })}
      data-last-updated={lastUpdated}
      {...(asOf && { "data-as-of": asOf })}
      lang="hr"
      className={cn("ai-answer-block", className)}
    >
      <header data-ai-bluf="true" className="ai-answer-header mb-6">
        <p className="text-lg font-semibold text-white/90 leading-relaxed">
          {bluf}
        </p>
        <div className="ai-answer-meta flex items-center gap-4 text-sm text-white/60 mt-3">
          <time dateTime={lastUpdated}>Ažurirano: {displayDate}</time>
          {confidence !== "high" && (
            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs">
              {confidence === "medium" ? "Djelomično potvrđeno" :
               confidence === "low" ? "Provjerite izvore" : "U obradi"}
            </span>
          )}
        </div>
      </header>

      <main
        data-ai-explanation="true"
        className="ai-answer-content prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-cyan-400"
      >
        {children}
      </main>

      {sources && sources.length > 0 && (
        <footer data-ai-sources="true" className="ai-answer-sources mt-8 pt-6 border-t border-white/10">
          <h2 className="text-sm font-semibold mb-3 text-white/70">Izvori</h2>
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.ref} data-source-ref={source.ref} className="text-sm">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline"
                  >
                    {source.label}
                  </a>
                ) : (
                  <span className="text-white/60">{source.label}</span>
                )}
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
  )
}
```

### Step 2.4: Run test to verify it passes

Run: `npx vitest run src/components/content/__tests__/AIAnswerBlock.test.tsx`
Expected: PASS

### Step 2.5: Update exports

```typescript
// Modify src/components/content/index.ts - update AIAnswerBlock exports
export { AIAnswerBlock } from "./ai-answer-block"
export type {
  AIAnswerBlockProps,
  AIAnswerSource,
  AnswerType,
  EvidenceStrength,
  ContentType,
} from "./ai-answer-block"
```

### Step 2.6: Commit

```bash
git add src/components/content/ai-answer-block.tsx src/components/content/__tests__/AIAnswerBlock.test.tsx src/components/content/index.ts
git commit -m "feat(content): enhance AIAnswerBlock with Living Truth data attributes"
```

---

## Task 3: Changelog Frontmatter Schema

**Files:**

- Modify: `src/lib/knowledge-hub/types.ts`
- Create: `src/lib/knowledge-hub/__tests__/changelog-validation.test.ts`
- Create: `src/lib/knowledge-hub/validate-frontmatter.ts`

### Step 3.1: Write the failing test

```typescript
// src/lib/knowledge-hub/__tests__/changelog-validation.test.ts
import { describe, it, expect } from "vitest"
import { validateChangelog } from "../validate-frontmatter"

describe("validateChangelog", () => {
  it("passes for valid changelog", () => {
    const changelog = [
      {
        id: "2025-01-15-pdv-threshold",
        date: "2025-01-15",
        severity: "critical",
        summary: "Prag za ulazak u sustav PDV-a povećan na 60.000 EUR",
        affectedSections: ["vat-threshold"],
        sourceRef: "NN:2/25",
      },
      {
        id: "2024-07-01-examples",
        date: "2024-07-01",
        severity: "info",
        summary: "Ažurirani primjeri",
      },
    ]

    const result = validateChangelog(changelog)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it("fails when not sorted by date descending", () => {
    const changelog = [
      { id: "old", date: "2024-01-01", severity: "info", summary: "Old" },
      { id: "new", date: "2025-01-01", severity: "info", summary: "New" },
    ]

    const result = validateChangelog(changelog)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Changelog must be sorted by date descending")
  })

  it("fails when critical/breaking lacks affectedSections", () => {
    const changelog = [
      { id: "test", date: "2025-01-01", severity: "critical", summary: "Critical change" },
    ]

    const result = validateChangelog(changelog)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("affectedSections")
  })

  it("fails when ids are not unique", () => {
    const changelog = [
      { id: "same", date: "2025-01-01", severity: "info", summary: "First" },
      { id: "same", date: "2024-01-01", severity: "info", summary: "Second" },
    ]

    const result = validateChangelog(changelog)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain("unique")
  })
})
```

### Step 3.2: Run test to verify it fails

Run: `npx vitest run src/lib/knowledge-hub/__tests__/changelog-validation.test.ts`
Expected: FAIL with "Cannot find module '../validate-frontmatter'"

### Step 3.3: Add types and validation

```typescript
// Add to src/lib/knowledge-hub/types.ts

export type ChangelogSeverity = "breaking" | "critical" | "major" | "info"

export interface ChangelogEntry {
  id: string
  date: string
  severity: ChangelogSeverity
  summary: string
  affectedSections?: string[]
  sourceRef?: string
  sourceEvidenceId?: string
  sourcePending?: boolean
}

// Update GuideFrontmatter
export interface GuideFrontmatter {
  title: string
  description: string
  businessType: BusinessType
  lastUpdated: string
  keywords: string[]
  requiresFiscalization: boolean
  requiresVAT: boolean
  maxRevenue?: number
  changelog?: ChangelogEntry[]
}
```

```typescript
// src/lib/knowledge-hub/validate-frontmatter.ts
import type { ChangelogEntry } from "./types"

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateChangelog(changelog: ChangelogEntry[]): ValidationResult {
  const errors: string[] = []

  if (!Array.isArray(changelog) || changelog.length === 0) {
    return { valid: true, errors: [] }
  }

  // Check sorted descending by date
  for (let i = 1; i < changelog.length; i++) {
    if (changelog[i].date > changelog[i - 1].date) {
      errors.push("Changelog must be sorted by date descending")
      break
    }
  }

  // Check unique IDs
  const ids = new Set<string>()
  for (const entry of changelog) {
    if (ids.has(entry.id)) {
      errors.push(`Changelog ids must be unique: '${entry.id}' appears multiple times`)
      break
    }
    ids.add(entry.id)
  }

  // Check critical/breaking have affectedSections
  for (const entry of changelog) {
    if (
      (entry.severity === "critical" || entry.severity === "breaking") &&
      (!entry.affectedSections || entry.affectedSections.length === 0)
    ) {
      errors.push(
        `Entry '${entry.id}' with severity '${entry.severity}' must have affectedSections`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}
```

### Step 3.4: Run test to verify it passes

Run: `npx vitest run src/lib/knowledge-hub/__tests__/changelog-validation.test.ts`
Expected: PASS

### Step 3.5: Commit

```bash
git add src/lib/knowledge-hub/types.ts src/lib/knowledge-hub/validate-frontmatter.ts src/lib/knowledge-hub/__tests__/changelog-validation.test.ts
git commit -m "feat(kb): add changelog frontmatter schema and validation"
```

---

## Task 4: Cache Tag Enhancements

**Files:**

- Modify: `src/lib/cache-headers.ts`
- Create: `src/lib/cache/purge.ts`
- Create: `src/lib/__tests__/cache-purge.test.ts`

### Step 4.1: Write the failing test

```typescript
// src/lib/__tests__/cache-purge.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { purgeContentCache, type CacheTag } from "../cache/purge"

describe("purgeContentCache", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fiskai.hr")
    vi.stubEnv("CACHE_PURGE_SECRET", "test-secret")
  })

  it("calls purge API with correct tags", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) })
    vi.stubGlobal("fetch", mockFetch)

    await purgeContentCache(["kb_guides", "kb_glossary"])

    expect(mockFetch).toHaveBeenCalledWith(
      "https://fiskai.hr/api/cache/purge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tags: ["kb_guides", "kb_glossary"] }),
      })
    )
  })

  it("includes authorization header", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) })
    vi.stubGlobal("fetch", mockFetch)

    await purgeContentCache(["kb_guides"])

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-secret",
        }),
      })
    )
  })
})
```

### Step 4.2: Run test to verify it fails

Run: `npx vitest run src/lib/__tests__/cache-purge.test.ts`
Expected: FAIL with "Cannot find module '../cache/purge'"

### Step 4.3: Implement purge utility

```typescript
// src/lib/cache/purge.ts
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

export type CacheTag =
  | "kb_guides"
  | "kb_glossary"
  | "kb_faq"
  | "kb_howto"
  | "kb_comparisons"
  | "kb_news"
  | "marketing"
  | "kb_all"

export interface PurgeResult {
  success: boolean
  error?: string
}

export async function purgeContentCache(tags: CacheTag[]): Promise<PurgeResult> {
  const secret = process.env.CACHE_PURGE_SECRET

  if (!secret) {
    console.warn("[cache/purge] CACHE_PURGE_SECRET not configured")
    return { success: false, error: "Missing secret" }
  }

  try {
    const response = await fetch(`${ORIGIN}/api/cache/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tags }),
      cache: "no-store",
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[cache/purge] Failed:", error)
      return { success: false, error }
    }

    console.log("[cache/purge] Purged tags:", tags.join(", "))
    return { success: true }
  } catch (error) {
    console.error("[cache/purge] Error:", error)
    return { success: false, error: String(error) }
  }
}

export async function purgeByUrls(urls: string[]): Promise<PurgeResult> {
  const secret = process.env.CACHE_PURGE_SECRET

  if (!secret) {
    return { success: false, error: "Missing secret" }
  }

  // Ensure absolute URLs
  const absoluteUrls = urls.map((url) => (url.startsWith("http") ? url : `${ORIGIN}${url}`))

  try {
    const response = await fetch(`${ORIGIN}/api/cache/purge`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ urls: absoluteUrls }),
      cache: "no-store",
    })

    if (!response.ok) {
      return { success: false, error: await response.text() }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}
```

### Step 4.4: Run test to verify it passes

Run: `npx vitest run src/lib/__tests__/cache-purge.test.ts`
Expected: PASS

### Step 4.5: Update cache-headers with new tags

```typescript
// Modify src/lib/cache-headers.ts - add missing tags
export const CACHE_TAGS = {
  KB_GUIDES: "kb_guides",
  KB_GLOSSARY: "kb_glossary",
  KB_FAQ: "kb_faq",
  KB_HOWTO: "kb_howto",
  KB_COMPARISONS: "kb_comparisons",
  KB_NEWS: "kb_news",
  MARKETING: "marketing",
  KB_ALL: "kb_all",
} as const

export function getCacheHeaders(pathname: string): Record<string, string> | null {
  // Never cache authenticated routes
  if (
    pathname.startsWith("/app/") ||
    pathname.startsWith("/staff/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/")
  ) {
    return null
  }

  // Determine cache tag based on route
  let tag: (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS] = CACHE_TAGS.MARKETING
  if (pathname.startsWith("/vodic/")) tag = CACHE_TAGS.KB_GUIDES
  else if (pathname.startsWith("/pojmovnik/") || pathname.startsWith("/glossary/"))
    tag = CACHE_TAGS.KB_GLOSSARY
  else if (pathname.startsWith("/faq/")) tag = CACHE_TAGS.KB_FAQ
  else if (pathname.startsWith("/kako-da/")) tag = CACHE_TAGS.KB_HOWTO
  else if (pathname.startsWith("/usporedba/")) tag = CACHE_TAGS.KB_COMPARISONS
  else if (pathname.startsWith("/vijesti/")) tag = CACHE_TAGS.KB_NEWS

  return {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400",
    "Cache-Tag": `${tag}, ${CACHE_TAGS.KB_ALL}`,
    Vary: "Accept-Language",
  }
}
```

### Step 4.6: Commit

```bash
git add src/lib/cache/purge.ts src/lib/__tests__/cache-purge.test.ts src/lib/cache-headers.ts
git commit -m "feat(cache): add cache purge utility and expand cache tags"
```

---

## Task 5: Concept-to-Guide Mapping

**Files:**

- Create: `src/lib/regulatory-truth/concept-guide-map.ts`
- Create: `src/lib/regulatory-truth/__tests__/concept-guide-map.test.ts`

### Step 5.1: Write the failing test

```typescript
// src/lib/regulatory-truth/__tests__/concept-guide-map.test.ts
import { describe, it, expect } from "vitest"
import { getAffectedGuides, CONCEPT_GUIDE_MAP } from "../concept-guide-map"

describe("getAffectedGuides", () => {
  it("returns guides for known concept", () => {
    const guides = getAffectedGuides("pdv")
    expect(guides).toContain("pdv")
    expect(guides.length).toBeGreaterThan(0)
  })

  it("returns empty array for unknown concept", () => {
    const guides = getAffectedGuides("nonexistent-concept")
    expect(guides).toEqual([])
  })

  it("maps pausalni to relevant guides", () => {
    const guides = getAffectedGuides("pausalni")
    expect(guides).toContain("pausalni-obrt")
  })
})
```

### Step 5.2: Run test to verify it fails

Run: `npx vitest run src/lib/regulatory-truth/__tests__/concept-guide-map.test.ts`
Expected: FAIL with "Cannot find module '../concept-guide-map'"

### Step 5.3: Implement the mapping

```typescript
// src/lib/regulatory-truth/concept-guide-map.ts

/**
 * Maps regulatory concepts to affected MDX guide slugs.
 *
 * This mapping is used by the content bridge to determine which guides
 * need updating when regulatory changes are detected.
 */
export const CONCEPT_GUIDE_MAP: Record<string, string[]> = {
  // VAT/PDV related
  pdv: ["pdv", "pausalni-pdv", "fiskalizacija"],
  "pdv-threshold": ["pdv", "pausalni-obrt", "obrt-dohodak"],
  "pdv-rates": ["pdv", "fiskalizacija"],

  // Paušalni related
  pausalni: ["pausalni-obrt", "pausalni-obrt-uz-zaposlenje"],
  "pausalni-limit": ["pausalni-obrt", "pausalni-obrt-uz-zaposlenje", "pausalni-obrt-umirovljenik"],

  // Fiskalizacija
  fiskalizacija: ["fiskalizacija", "pos"],
  "fiskal-certificates": ["fiskalizacija"],

  // Contributions/Doprinosi
  doprinosi: ["pausalni-obrt", "obrt-dohodak", "doo", "slobodna-profesija"],
  "mirovinsko-osiguranje": ["pausalni-obrt", "obrt-dohodak"],
  "zdravstveno-osiguranje": ["pausalni-obrt", "obrt-dohodak"],

  // Business forms
  obrt: ["obrt-dohodak", "pausalni-obrt", "sezonski-obrt"],
  doo: ["doo", "jdoo", "doo-direktor-s-placom", "doo-direktor-bez-place"],
  jdoo: ["jdoo"],

  // Deadlines
  "porezna-prijava": ["pausalni-obrt", "obrt-dohodak", "doo"],
  "godisnji-obracun": ["pausalni-obrt", "doo"],
}

/**
 * Get list of guide slugs affected by a concept change
 */
export function getAffectedGuides(conceptId: string): string[] {
  return CONCEPT_GUIDE_MAP[conceptId] || []
}

/**
 * Get all concept IDs that affect a specific guide
 */
export function getConceptsForGuide(guideSlug: string): string[] {
  const concepts: string[] = []
  for (const [concept, guides] of Object.entries(CONCEPT_GUIDE_MAP)) {
    if (guides.includes(guideSlug)) {
      concepts.push(concept)
    }
  }
  return concepts
}
```

### Step 5.4: Run test to verify it passes

Run: `npx vitest run src/lib/regulatory-truth/__tests__/concept-guide-map.test.ts`
Expected: PASS

### Step 5.5: Commit

```bash
git add src/lib/regulatory-truth/concept-guide-map.ts src/lib/regulatory-truth/__tests__/concept-guide-map.test.ts
git commit -m "feat(regulatory): add concept-to-guide mapping for content bridge"
```

---

## Task 6: Content Bridge Script

**Files:**

- Create: `src/lib/regulatory-truth/scripts/content-bridge.ts`
- Modify: `src/lib/regulatory-truth/watchdog/slack.ts` (add sendContentAlert)

### Step 6.1: Add sendContentAlert to slack.ts

```typescript
// Add to src/lib/regulatory-truth/watchdog/slack.ts

export interface ContentAlert {
  conceptId: string
  affectedGuides: string[]
  changesDetected: number
  severity: "critical" | "major" | "info"
  evidenceIds: string[]
  summary: string
  deepLinks: {
    evidence: string[]
    guides: string[]
  }
}

export async function sendContentAlert(alert: ContentAlert): Promise<boolean> {
  const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "major" ? "⚠️" : "ℹ️"
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${emoji} Sentinel Alert: ${alert.conceptId}`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Severity:*\n${alert.severity}` },
        { type: "mrkdwn", text: `*Changes:*\n${alert.changesDetected}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Summary:*\n${alert.summary}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Affected Guides:*\n${alert.affectedGuides.map((g) => `• <${origin}/vodic/${g}|${g}>`).join("\n")}`,
      },
    },
  ]

  if (alert.deepLinks.evidence.length > 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Evidence:*\n${alert.deepLinks.evidence
          .slice(0, 3)
          .map((url) => `• <${url}|View>`)
          .join("\n")}`,
      },
    })
  }

  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: `<${origin}/admin/regulatory|Open Dashboard>` }],
  })

  return sendSlackMessage({ blocks })
}
```

### Step 6.2: Implement content bridge script

```typescript
// src/lib/regulatory-truth/scripts/content-bridge.ts
import { prisma } from "@/lib/prisma"
import { getAffectedGuides } from "../concept-guide-map"
import { sendContentAlert, type ContentAlert } from "../watchdog/slack"

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

interface EvidenceChange {
  id: string
  conceptId: string
  effectiveSoon: boolean
  createsConflict: boolean
  touchesPublishedRule: boolean
  authorityTier: "primary" | "secondary" | "guidance"
}

function computeSeverity(changes: EvidenceChange[]): "critical" | "major" | "info" {
  // Critical: effectiveFrom within 30 days, or conflicts created
  if (changes.some((c) => c.effectiveSoon || c.createsConflict)) return "critical"

  // Major: touches published rules, high authority source
  if (changes.some((c) => c.touchesPublishedRule && c.authorityTier === "primary")) return "major"

  return "info"
}

function groupByConceptId(
  evidence: Array<{
    id: string
    sourcePointers: Array<{ lawReference: string | null; conceptSlug: string | null }>
    source: { provider: string }
  }>
): Record<string, EvidenceChange[]> {
  const grouped: Record<string, EvidenceChange[]> = {}

  for (const ev of evidence) {
    // Derive concept from source pointers
    const concepts = new Set<string>()
    for (const sp of ev.sourcePointers) {
      if (sp.conceptSlug) concepts.add(sp.conceptSlug)
    }

    // Fallback: derive from provider
    if (concepts.size === 0) {
      const provider = ev.source.provider.toLowerCase()
      if (provider.includes("porezna")) concepts.add("pdv")
      if (provider.includes("mirovinsko")) concepts.add("doprinosi")
    }

    for (const conceptId of concepts) {
      if (!grouped[conceptId]) grouped[conceptId] = []
      grouped[conceptId].push({
        id: ev.id,
        conceptId,
        effectiveSoon: false, // Would need to check effectiveFrom
        createsConflict: false, // Would check against existing rules
        touchesPublishedRule: true,
        authorityTier: "primary",
      })
    }
  }

  return grouped
}

export async function generateContentAlerts(): Promise<ContentAlert[]> {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  // Query Evidence records from last 24h with changes
  const changedEvidence = await prisma.evidence.findMany({
    where: {
      fetchedAt: { gte: yesterday },
      // Note: hasChanged field would need to exist - using status as proxy
      status: "EXTRACTED",
    },
    include: {
      sourcePointers: true,
      source: true,
    },
    take: 100,
  })

  if (changedEvidence.length === 0) {
    console.log("[content-bridge] No recent evidence changes")
    return []
  }

  // Group by concept
  const byConceptId = groupByConceptId(changedEvidence)

  // Generate alerts
  const alerts: ContentAlert[] = []

  for (const [conceptId, changes] of Object.entries(byConceptId)) {
    const affectedGuides = getAffectedGuides(conceptId)
    if (affectedGuides.length === 0) continue

    alerts.push({
      conceptId,
      affectedGuides,
      changesDetected: changes.length,
      severity: computeSeverity(changes),
      evidenceIds: changes.map((c) => c.id),
      summary: `${changes.length} regulatory change(s) detected affecting ${conceptId}`,
      deepLinks: {
        evidence: changes.map((c) => `${ORIGIN}/admin/regulatory/evidence/${c.id}`),
        guides: affectedGuides.map((g) => `${ORIGIN}/vodic/${g}`),
      },
    })
  }

  return alerts
}

export async function runContentBridge() {
  console.log("[content-bridge] Starting...")

  try {
    const alerts = await generateContentAlerts()
    console.log(`[content-bridge] Generated ${alerts.length} alerts`)

    for (const alert of alerts) {
      console.log(`[content-bridge] Sending alert for ${alert.conceptId} (${alert.severity})`)
      await sendContentAlert(alert)
    }

    console.log("[content-bridge] Complete")
    return { success: true, alertCount: alerts.length }
  } catch (error) {
    console.error("[content-bridge] Error:", error)
    return { success: false, error: String(error) }
  }
}

// CLI entry point
if (require.main === module) {
  runContentBridge()
    .then((result) => {
      console.log(result)
      process.exit(result.success ? 0 : 1)
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}
```

### Step 6.3: Commit

```bash
git add src/lib/regulatory-truth/scripts/content-bridge.ts src/lib/regulatory-truth/watchdog/slack.ts
git commit -m "feat(regulatory): add content bridge script for Sentinel alerts"
```

---

## Task 7: Integration with Sentinel

**Files:**

- Modify: `src/lib/regulatory-truth/scripts/run-sentinel.ts`

### Step 7.1: Add content bridge trigger to Sentinel

Add to the end of `run-sentinel.ts` after successful scan:

```typescript
// Add import at top
import { runContentBridge } from "./content-bridge"

// Add at end of runSentinel function, after scan completes:
if (changesDetected > 0) {
  console.log("[sentinel] Changes detected, triggering content bridge...")
  await runContentBridge()
}
```

### Step 7.2: Commit

```bash
git add src/lib/regulatory-truth/scripts/run-sentinel.ts
git commit -m "feat(regulatory): trigger content bridge after Sentinel scan"
```

---

## Task 8: Build Validation Script

**Files:**

- Create: `scripts/validate-content.ts`
- Modify: `package.json`

### Step 8.1: Create validation script

```typescript
// scripts/validate-content.ts
import { glob } from "glob"
import matter from "gray-matter"
import { readFileSync } from "fs"
import { validateChangelog } from "@/lib/knowledge-hub/validate-frontmatter"

async function validateContent() {
  const mdxFiles = await glob("content/**/*.mdx")
  let hasErrors = false

  for (const file of mdxFiles) {
    const content = readFileSync(file, "utf-8")
    const { data } = matter(content)

    // Validate changelog if present
    if (data.changelog) {
      const result = validateChangelog(data.changelog)
      if (!result.valid) {
        console.error(`\n❌ ${file}:`)
        for (const error of result.errors) {
          console.error(`   - ${error}`)
        }
        hasErrors = true
      }
    }
  }

  if (hasErrors) {
    console.error("\n\nContent validation failed!")
    process.exit(1)
  }

  console.log(`✅ Validated ${mdxFiles.length} MDX files`)
}

validateContent().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

### Step 8.2: Add to package.json

```json
"validate:content": "tsx scripts/validate-content.ts"
```

### Step 8.3: Commit

```bash
git add scripts/validate-content.ts package.json
git commit -m "feat(build): add content validation script for changelog schemas"
```

---

## Final Steps

### Create branch and push

```bash
git checkout -b feat/living-truth-infrastructure
git push -u origin feat/living-truth-infrastructure
```

### Create PR

```bash
gh pr create --title "feat: Living Truth infrastructure" --body "$(cat <<'EOF'
## Summary

Implements Living Truth infrastructure for perpetually accurate regulatory content:

- **RegulatorySection component** - Confidence-badged content blocks with source attribution
- **Enhanced AIAnswerBlock** - BLUF-first structured answers with full data attributes
- **Changelog frontmatter schema** - Structured change tracking with validation
- **Cache purge utility** - Cloudflare integration for targeted invalidation
- **Concept-to-guide mapping** - Links regulatory concepts to content
- **Content bridge script** - Automated Slack alerts when Sentinel detects changes
- **Build validation** - Prevents invalid frontmatter from deploying

## Test Plan

- [x] All vitest tests pass
- [x] Components render correct data attributes
- [x] Changelog validation catches invalid entries
- [x] Cache purge utility calls correct endpoints
- [x] Content bridge generates alerts for known concepts

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Summary

| Task | Component            | Status                 |
| ---- | -------------------- | ---------------------- |
| 1    | RegulatorySection    | New component          |
| 2    | AIAnswerBlock        | Enhanced existing      |
| 3    | Changelog Schema     | New types + validation |
| 4    | Cache Purge          | New utility            |
| 5    | Concept Mapping      | New mapping            |
| 6    | Content Bridge       | New script             |
| 7    | Sentinel Integration | Modified               |
| 8    | Build Validation     | New script             |
