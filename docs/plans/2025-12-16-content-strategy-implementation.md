# Content Strategy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement SEO/AI-search dominance strategy with 50 glossary terms, 6 end-of-year guides, 5 MDX components, and schema.org automation.

**Architecture:** Hybrid MDX approach - reusable components (QuickAnswer, FAQ, Sources, HowToSteps, GlossaryCard) for flexible placement, auto-generated schema.org from frontmatter, new routes for /rjecnik, /kako-da, /fiskalizacija.

**Tech Stack:** Next.js 15, MDX, TypeScript, Tailwind CSS, schema-dts for JSON-LD types

---

## Phase 1: Foundation (Components + Infrastructure)

### Task 1.1: Create TypeScript Types for New Content

**Files:**

- Modify: `src/lib/knowledge-hub/types.ts`

**Step 1: Add new frontmatter types**

Add to `src/lib/knowledge-hub/types.ts`:

```typescript
export interface Source {
  name: string
  url: string
}

export interface FAQItem {
  q: string
  a: string
}

// Extended frontmatter for all content types
export interface ContentFrontmatter {
  title: string
  description: string
  lastUpdated: string
  lastReviewed?: string
  reviewer?: string
  sources?: Source[]
  faq?: FAQItem[]
  keywords?: string[]
}

// Glossary-specific frontmatter
export interface GlossaryFrontmatter extends ContentFrontmatter {
  term: string
  shortDefinition: string
  relatedTerms?: string[]
  appearsIn?: string[] // forms/contexts where term appears
  triggerConditions?: string[] // when user must care about this
}

// How-To specific frontmatter
export interface HowToFrontmatter extends ContentFrontmatter {
  totalTime?: string // ISO 8601 duration, e.g., "PT15M"
  difficulty?: "easy" | "medium" | "hard"
  prerequisites?: string[]
  tools?: string[] // required tools/accounts
}

// Hub page frontmatter
export interface HubFrontmatter extends ContentFrontmatter {
  hubType: "fiskalizacija" | "pdv" | "obrt" | "doo"
  childPages?: string[] // slugs of related pages
}
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/knowledge-hub/types.ts
git commit -m "feat(types): add frontmatter types for glossary, how-to, hub content"
```

---

### Task 1.2: Create Schema.org Generator Utilities

**Files:**

- Create: `src/lib/schema/generators.ts`
- Create: `src/lib/schema/index.ts`

**Step 1: Create schema generators**

Create `src/lib/schema/generators.ts`:

```typescript
import type { FAQItem, Source } from "@/lib/knowledge-hub/types"

interface BreadcrumbItem {
  name: string
  url: string
}

interface HowToStep {
  name: string
  text: string
  image?: string
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export function generateFAQSchema(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  }
}

export function generateHowToSchema(
  title: string,
  description: string,
  steps: HowToStep[],
  totalTime?: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: title,
    description,
    ...(totalTime && { totalTime }),
    step: steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
      ...(step.image && { image: step.image }),
    })),
  }
}

export function generateArticleSchema(
  title: string,
  description: string,
  datePublished: string,
  dateModified: string,
  url: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    datePublished,
    dateModified,
    url,
    publisher: {
      "@type": "Organization",
      name: "FiskAI",
      url: "https://fisk.ai",
    },
  }
}

export function generateDefinedTermSchema(term: string, definition: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: term,
    description: definition,
    url,
  }
}

export function generateWebApplicationSchema(name: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EUR",
    },
  }
}
```

**Step 2: Create index export**

Create `src/lib/schema/index.ts`:

```typescript
export {
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateHowToSchema,
  generateArticleSchema,
  generateDefinedTermSchema,
  generateWebApplicationSchema,
} from "./generators"
```

**Step 3: Verify imports work**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/schema/
git commit -m "feat(schema): add JSON-LD schema generators for SEO"
```

---

### Task 1.3: Create JsonLd Component

**Files:**

- Create: `src/components/seo/JsonLd.tsx`

**Step 1: Create the component**

Create `src/components/seo/JsonLd.tsx`:

```typescript
interface JsonLdProps {
  schemas: object[]
}

export function JsonLd({ schemas }: JsonLdProps) {
  if (!schemas.length) return null

  const jsonLd = schemas.length === 1 ? schemas[0] : schemas

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/seo/JsonLd.tsx
git commit -m "feat(seo): add JsonLd component for structured data injection"
```

---

### Task 1.4: Create QuickAnswer Component

**Files:**

- Create: `src/components/content/QuickAnswer.tsx`

**Step 1: Create the component**

Create `src/components/content/QuickAnswer.tsx`:

```typescript
import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickAnswerProps {
  children: React.ReactNode
  className?: string
}

export function QuickAnswer({ children, className }: QuickAnswerProps) {
  return (
    <div
      className={cn(
        'my-6 rounded-xl border-l-4 border-blue-500 bg-blue-50 p-5',
        className
      )}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-blue-700">
        <Lightbulb className="h-4 w-4" />
        Brzi odgovor
      </div>
      <div className="text-slate-800 [&>p]:m-0">{children}</div>
    </div>
  )
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/content/QuickAnswer.tsx
git commit -m "feat(content): add QuickAnswer component for featured snippets"
```

---

### Task 1.5: Create FAQ Component with Schema

**Files:**

- Create: `src/components/content/FAQ.tsx`

**Step 1: Create the component**

Create `src/components/content/FAQ.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JsonLd } from '@/components/seo/JsonLd'
import { generateFAQSchema } from '@/lib/schema'
import type { FAQItem } from '@/lib/knowledge-hub/types'

interface FAQProps {
  items: FAQItem[]
  className?: string
}

export function FAQ({ items, className }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!items.length) return null

  return (
    <>
      <JsonLd schemas={[generateFAQSchema(items)]} />
      <div className={cn('my-8', className)}>
        <h2 className="mb-4 text-xl font-bold text-slate-900">
          Često postavljana pitanja
        </h2>
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200">
          {items.map((item, index) => (
            <div key={index}>
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-5 py-4 text-left font-medium text-slate-900 hover:bg-slate-50"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={cn(
                    'h-5 w-5 text-slate-500 transition-transform',
                    openIndex === index && 'rotate-180'
                  )}
                />
              </button>
              {openIndex === index && (
                <div className="px-5 pb-4 text-slate-600">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/content/FAQ.tsx
git commit -m "feat(content): add FAQ accordion component with FAQPage schema"
```

---

### Task 1.6: Create Sources Component

**Files:**

- Create: `src/components/content/Sources.tsx`

**Step 1: Create the component**

Create `src/components/content/Sources.tsx`:

```typescript
import { ExternalLink, Calendar, UserCheck } from 'lucide-react'
import type { Source } from '@/lib/knowledge-hub/types'

interface SourcesProps {
  sources?: Source[]
  lastUpdated?: string
  lastReviewed?: string
  reviewer?: string
}

export function Sources({
  sources,
  lastUpdated,
  lastReviewed,
  reviewer,
}: SourcesProps) {
  const hasContent = sources?.length || lastUpdated || lastReviewed || reviewer

  if (!hasContent) return null

  return (
    <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6">
      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Izvori
          </h3>
          <ul className="space-y-2">
            {sources.map((source, index) => (
              <li key={index}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {source.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Metadata */}
      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
        {lastUpdated && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>
              Ažurirano:{' '}
              {new Date(lastUpdated).toLocaleDateString('hr-HR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        )}
        {reviewer && (
          <div className="flex items-center gap-1.5">
            <UserCheck className="h-4 w-4" />
            <span>Pregledao: {reviewer}</span>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-slate-400">
        Informativni sadržaj. Za specifične situacije konzultirajte stručnjaka.
      </p>
    </div>
  )
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/content/Sources.tsx
git commit -m "feat(content): add Sources component for E-E-A-T signals"
```

---

### Task 1.7: Create HowToSteps Component

**Files:**

- Create: `src/components/content/HowToSteps.tsx`

**Step 1: Create the component**

Create `src/components/content/HowToSteps.tsx`:

```typescript
import { CheckCircle2 } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { JsonLd } from '@/components/seo/JsonLd'
import { generateHowToSchema } from '@/lib/schema'

interface Step {
  name: string
  text: string
  image?: string
}

interface HowToStepsProps {
  title: string
  description: string
  steps: Step[]
  totalTime?: string
  className?: string
}

export function HowToSteps({
  title,
  description,
  steps,
  totalTime,
  className,
}: HowToStepsProps) {
  return (
    <>
      <JsonLd
        schemas={[generateHowToSchema(title, description, steps, totalTime)]}
      />
      <div className={cn('my-8', className)}>
        {totalTime && (
          <p className="mb-4 text-sm text-slate-500">
            Potrebno vrijeme: {formatDuration(totalTime)}
          </p>
        )}
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li key={index} className="relative pl-10">
              <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                {index + 1}
              </div>
              <div>
                <h3 className="mb-1 font-semibold text-slate-900">{step.name}</h3>
                <p className="text-slate-600">{step.text}</p>
                {step.image && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                    <Image
                      src={step.image}
                      alt={step.name}
                      width={600}
                      height={400}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </>
  )
}

function formatDuration(iso8601: string): string {
  const match = iso8601.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return iso8601

  const [, hours, minutes, seconds] = match
  const parts = []
  if (hours) parts.push(`${hours} h`)
  if (minutes) parts.push(`${minutes} min`)
  if (seconds) parts.push(`${seconds} s`)
  return parts.join(' ') || iso8601
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/content/HowToSteps.tsx
git commit -m "feat(content): add HowToSteps component with HowTo schema"
```

---

### Task 1.8: Create GlossaryCard Component

**Files:**

- Create: `src/components/content/GlossaryCard.tsx`

**Step 1: Create the component**

Create `src/components/content/GlossaryCard.tsx`:

```typescript
import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GlossaryCardProps {
  term: string
  definition: string
  relatedTerms?: string[]
  className?: string
}

export function GlossaryCard({
  term,
  definition,
  relatedTerms,
  className,
}: GlossaryCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-6',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-blue-600" />
        <h2 className="text-2xl font-bold text-slate-900">{term}</h2>
      </div>
      <p className="mb-4 text-lg text-slate-700">{definition}</p>

      {relatedTerms && relatedTerms.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-500">
            Povezani pojmovi
          </h3>
          <div className="flex flex-wrap gap-2">
            {relatedTerms.map((relatedTerm) => (
              <Link
                key={relatedTerm}
                href={`/rjecnik/${relatedTerm.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200"
              >
                {relatedTerm}
                <ArrowRight className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/content/GlossaryCard.tsx
git commit -m "feat(content): add GlossaryCard component for term definitions"
```

---

### Task 1.9: Create Content Components Index

**Files:**

- Create: `src/components/content/index.ts`

**Step 1: Create index export**

Create `src/components/content/index.ts`:

```typescript
export { QuickAnswer } from "./QuickAnswer"
export { FAQ } from "./FAQ"
export { Sources } from "./Sources"
export { HowToSteps } from "./HowToSteps"
export { GlossaryCard } from "./GlossaryCard"
```

**Step 2: Commit**

```bash
git add src/components/content/index.ts
git commit -m "feat(content): add component index exports"
```

---

## Phase 2: Routes & Listings

### Task 2.1: Create Glossary MDX Loader

**Files:**

- Modify: `src/lib/knowledge-hub/mdx.ts`

**Step 1: Add glossary functions**

Add to `src/lib/knowledge-hub/mdx.ts`:

```typescript
import type { GlossaryFrontmatter, HowToFrontmatter } from "./types"

const GLOSSARY_PATH = path.join(process.cwd(), "content", "rjecnik")
const HOWTO_PATH = path.join(process.cwd(), "content", "kako-da")

export interface GlossaryContent {
  frontmatter: GlossaryFrontmatter
  content: string
  slug: string
}

export interface HowToContent {
  frontmatter: HowToFrontmatter
  content: string
  slug: string
}

// Glossary functions
export function getGlossarySlugs(): string[] {
  if (!fs.existsSync(GLOSSARY_PATH)) return []
  return fs
    .readdirSync(GLOSSARY_PATH)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""))
}

export function getGlossaryBySlug(slug: string): GlossaryContent | null {
  const filePath = path.join(GLOSSARY_PATH, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)

  return {
    frontmatter: data as GlossaryFrontmatter,
    content,
    slug,
  }
}

export async function getAllGlossaryTerms(): Promise<GlossaryContent[]> {
  const slugs = getGlossarySlugs()
  return slugs
    .map((slug) => getGlossaryBySlug(slug))
    .filter((term): term is GlossaryContent => term !== null)
    .sort((a, b) => a.frontmatter.term.localeCompare(b.frontmatter.term, "hr"))
}

// How-To functions
export function getHowToSlugs(): string[] {
  if (!fs.existsSync(HOWTO_PATH)) return []
  return fs
    .readdirSync(HOWTO_PATH)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""))
}

export function getHowToBySlug(slug: string): HowToContent | null {
  const filePath = path.join(HOWTO_PATH, `${slug}.mdx`)
  if (!fs.existsSync(filePath)) return null

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)

  return {
    frontmatter: data as HowToFrontmatter,
    content,
    slug,
  }
}

export async function getAllHowTos(): Promise<HowToContent[]> {
  const slugs = getHowToSlugs()
  return slugs
    .map((slug) => getHowToBySlug(slug))
    .filter((howto): howto is HowToContent => howto !== null)
}
```

**Step 2: Verify compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/knowledge-hub/mdx.ts
git commit -m "feat(mdx): add glossary and how-to content loaders"
```

---

### Task 2.2: Create Glossary Listing Page

**Files:**

- Create: `src/app/(marketing)/rjecnik/page.tsx`

**Step 1: Create the page**

Create `src/app/(marketing)/rjecnik/page.tsx`:

```typescript
import { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, ArrowRight } from 'lucide-react'
import { getAllGlossaryTerms } from '@/lib/knowledge-hub/mdx'

export const metadata: Metadata = {
  title: 'Poslovni rječnik | FiskAI',
  description:
    'A-Z rječnik hrvatskih poslovnih i poreznih pojmova. PDV, OIB, JOPPD, fiskalizacija i više.',
}

export default async function GlossaryPage() {
  const terms = await getAllGlossaryTerms()

  // Group by first letter
  const grouped = terms.reduce(
    (acc, term) => {
      const letter = term.frontmatter.term[0].toUpperCase()
      if (!acc[letter]) acc[letter] = []
      acc[letter].push(term)
      return acc
    },
    {} as Record<string, typeof terms>
  )

  const letters = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'hr'))

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{' '}
        <span>/</span> <span className="text-[var(--foreground)]">Rječnik</span>
      </nav>

      <header className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
          <BookOpen className="h-4 w-4" />
          {terms.length} pojmova
        </div>
        <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">
          Poslovni rječnik
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Svi pojmovi koje trebate znati za poslovanje u Hrvatskoj. Od PDV-a do
          fiskalizacije.
        </p>
      </header>

      {/* Letter navigation */}
      <div className="mb-8 flex flex-wrap justify-center gap-2">
        {letters.map((letter) => (
          <a
            key={letter}
            href={`#${letter}`}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-700 hover:bg-blue-100 hover:text-blue-700"
          >
            {letter}
          </a>
        ))}
      </div>

      {/* Terms by letter */}
      <div className="space-y-10">
        {letters.map((letter) => (
          <section key={letter} id={letter}>
            <h2 className="mb-4 text-2xl font-bold text-slate-900">{letter}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped[letter].map((term) => (
                <Link
                  key={term.slug}
                  href={`/rjecnik/${term.slug}`}
                  className="group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 transition-all hover:border-blue-300 hover:shadow-md"
                >
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                      {term.frontmatter.term}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500 line-clamp-1">
                      {term.frontmatter.shortDefinition}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify page renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/rjecnik`
Expected: Page loads (may be empty if no content yet)

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/rjecnik/page.tsx
git commit -m "feat(rjecnik): add glossary listing page with A-Z navigation"
```

---

### Task 2.3: Create Glossary Term Page

**Files:**

- Create: `src/app/(marketing)/rjecnik/[pojam]/page.tsx`

**Step 1: Create the dynamic route**

Create `src/app/(marketing)/rjecnik/[pojam]/page.tsx`:

```typescript
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getGlossaryBySlug, getGlossarySlugs } from '@/lib/knowledge-hub/mdx'
import { GlossaryCard } from '@/components/content/GlossaryCard'
import { FAQ } from '@/components/content/FAQ'
import { Sources } from '@/components/content/Sources'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  generateDefinedTermSchema,
  generateBreadcrumbSchema,
} from '@/lib/schema'

interface Props {
  params: Promise<{ pojam: string }>
}

export async function generateStaticParams() {
  const slugs = getGlossarySlugs()
  return slugs.map((pojam) => ({ pojam }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)
  if (!term) return {}

  return {
    title: `${term.frontmatter.term} - Što je? | FiskAI Rječnik`,
    description: term.frontmatter.shortDefinition,
  }
}

export default async function GlossaryTermPage({ params }: Props) {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)

  if (!term) notFound()

  const { frontmatter } = term
  const url = `https://fisk.ai/rjecnik/${pojam}`

  const breadcrumbs = [
    { name: 'Baza znanja', url: 'https://fisk.ai/baza-znanja' },
    { name: 'Rječnik', url: 'https://fisk.ai/rjecnik' },
    { name: frontmatter.term, url },
  ]

  return (
    <>
      <JsonLd
        schemas={[
          generateBreadcrumbSchema(breadcrumbs),
          generateDefinedTermSchema(
            frontmatter.term,
            frontmatter.shortDefinition,
            url
          ),
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-[var(--muted)]">
          <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
            Baza znanja
          </Link>{' '}
          <span>/</span>{' '}
          <Link href="/rjecnik" className="hover:text-[var(--foreground)]">
            Rječnik
          </Link>{' '}
          <span>/</span>{' '}
          <span className="text-[var(--foreground)]">{frontmatter.term}</span>
        </nav>

        <Link
          href="/rjecnik"
          className="mb-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Svi pojmovi
        </Link>

        <GlossaryCard
          term={frontmatter.term}
          definition={frontmatter.shortDefinition}
          relatedTerms={frontmatter.relatedTerms}
        />

        {/* Extended content from MDX would go here */}

        {frontmatter.appearsIn && frontmatter.appearsIn.length > 0 && (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="mb-3 font-semibold text-slate-900">
              Gdje se pojavljuje
            </h3>
            <ul className="list-inside list-disc space-y-1 text-slate-600">
              {frontmatter.appearsIn.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {frontmatter.faq && <FAQ items={frontmatter.faq} />}

        <Sources
          sources={frontmatter.sources}
          lastUpdated={frontmatter.lastUpdated}
          lastReviewed={frontmatter.lastReviewed}
          reviewer={frontmatter.reviewer}
        />
      </div>
    </>
  )
}
```

**Step 2: Create content directory**

Run: `mkdir -p content/rjecnik`

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/rjecnik/\[pojam\]/page.tsx
git commit -m "feat(rjecnik): add dynamic glossary term page with schema"
```

---

### Task 2.4: Create How-To Listing Page

**Files:**

- Create: `src/app/(marketing)/kako-da/page.tsx`

**Step 1: Create the page**

Create `src/app/(marketing)/kako-da/page.tsx`:

```typescript
import { Metadata } from 'next'
import Link from 'next/link'
import { FileText, ArrowRight, Clock } from 'lucide-react'
import { getAllHowTos } from '@/lib/knowledge-hub/mdx'

export const metadata: Metadata = {
  title: 'Kako da... | Vodiči korak po korak | FiskAI',
  description:
    'Praktični vodiči za sve porezne i administrativne zadatke. PO-SD, fiskalizacija, PDV registracija i više.',
}

export default async function HowToListingPage() {
  const howtos = await getAllHowTos()

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
      <nav className="mb-6 text-sm text-[var(--muted)]">
        <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
          Baza znanja
        </Link>{' '}
        <span>/</span>{' '}
        <span className="text-[var(--foreground)]">Kako da...</span>
      </nav>

      <header className="mb-10 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
          <FileText className="h-4 w-4" />
          Korak po korak
        </div>
        <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">
          Kako da...
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Praktični vodiči za sve administrativne zadatke. S primjerima i
          screenshot-ima.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {howtos.map((howto) => (
          <Link
            key={howto.slug}
            href={`/kako-da/${howto.slug}`}
            className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-all hover:border-green-300 hover:shadow-md"
          >
            <h2 className="mb-2 text-lg font-semibold text-slate-900 group-hover:text-green-600">
              {howto.frontmatter.title}
            </h2>
            <p className="mb-4 flex-1 text-slate-600">
              {howto.frontmatter.description}
            </p>
            <div className="flex items-center justify-between">
              {howto.frontmatter.totalTime && (
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <Clock className="h-4 w-4" />
                  {howto.frontmatter.totalTime.replace('PT', '').replace('M', ' min')}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                Čitaj vodič
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>

      {howtos.length === 0 && (
        <p className="text-center text-slate-500">
          Vodiči dolaze uskoro...
        </p>
      )}
    </div>
  )
}
```

**Step 2: Create content directory**

Run: `mkdir -p content/kako-da`

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/kako-da/page.tsx
git commit -m "feat(kako-da): add how-to listing page"
```

---

### Task 2.5: Create How-To Dynamic Page

**Files:**

- Create: `src/app/(marketing)/kako-da/[slug]/page.tsx`

**Step 1: Create the dynamic route**

Create `src/app/(marketing)/kako-da/[slug]/page.tsx`:

```typescript
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getHowToBySlug, getHowToSlugs } from '@/lib/knowledge-hub/mdx'
import { FAQ } from '@/components/content/FAQ'
import { Sources } from '@/components/content/Sources'
import { JsonLd } from '@/components/seo/JsonLd'
import { generateBreadcrumbSchema } from '@/lib/schema'
import { MDXRemote } from 'next-mdx-remote/rsc'
import { mdxComponents } from '@/lib/knowledge-hub/mdx-components'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getHowToSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const howto = getHowToBySlug(slug)
  if (!howto) return {}

  return {
    title: `${howto.frontmatter.title} | FiskAI`,
    description: howto.frontmatter.description,
  }
}

export default async function HowToPage({ params }: Props) {
  const { slug } = await params
  const howto = getHowToBySlug(slug)

  if (!howto) notFound()

  const { frontmatter, content } = howto
  const url = `https://fisk.ai/kako-da/${slug}`

  const breadcrumbs = [
    { name: 'Baza znanja', url: 'https://fisk.ai/baza-znanja' },
    { name: 'Kako da...', url: 'https://fisk.ai/kako-da' },
    { name: frontmatter.title, url },
  ]

  return (
    <>
      <JsonLd schemas={[generateBreadcrumbSchema(breadcrumbs)]} />

      <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-[var(--muted)]">
          <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
            Baza znanja
          </Link>{' '}
          <span>/</span>{' '}
          <Link href="/kako-da" className="hover:text-[var(--foreground)]">
            Kako da...
          </Link>{' '}
          <span>/</span>{' '}
          <span className="text-[var(--foreground)]">{frontmatter.title}</span>
        </nav>

        <Link
          href="/kako-da"
          className="mb-6 inline-flex items-center gap-2 text-sm text-green-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Svi vodiči
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
            {frontmatter.title}
          </h1>
          <p className="mt-3 text-lg text-slate-600">
            {frontmatter.description}
          </p>
          {frontmatter.totalTime && (
            <p className="mt-2 text-sm text-slate-500">
              Potrebno vrijeme:{' '}
              {frontmatter.totalTime.replace('PT', '').replace('M', ' minuta')}
            </p>
          )}
        </header>

        {frontmatter.prerequisites && frontmatter.prerequisites.length > 0 && (
          <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-2 font-semibold text-amber-800">Prije nego počnete</h2>
            <ul className="list-inside list-disc space-y-1 text-amber-700">
              {frontmatter.prerequisites.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <article className="prose prose-slate max-w-none">
          <MDXRemote source={content} components={mdxComponents} />
        </article>

        {frontmatter.faq && <FAQ items={frontmatter.faq} />}

        <Sources
          sources={frontmatter.sources}
          lastUpdated={frontmatter.lastUpdated}
          lastReviewed={frontmatter.lastReviewed}
          reviewer={frontmatter.reviewer}
        />
      </div>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(marketing\)/kako-da/\[slug\]/page.tsx
git commit -m "feat(kako-da): add dynamic how-to page with MDX rendering"
```

---

### Task 2.6: Create Fiskalizacija Hub Page

**Files:**

- Create: `src/app/(marketing)/fiskalizacija/page.tsx`

**Step 1: Create the hub page**

Create `src/app/(marketing)/fiskalizacija/page.tsx`:

```typescript
import { Metadata } from 'next'
import Link from 'next/link'
import { FileCheck, Calendar, ArrowRight, AlertTriangle } from 'lucide-react'
import { Fiskalizacija2Wizard } from '@/components/marketing/Fiskalizacija2Wizard'
import { FAQ } from '@/components/content/FAQ'
import { Sources } from '@/components/content/Sources'
import { JsonLd } from '@/components/seo/JsonLd'
import { generateBreadcrumbSchema, generateFAQSchema } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Fiskalizacija 2.0 | Sve što trebate znati | FiskAI',
  description:
    'Kompletan vodič za Fiskalizaciju 2.0 u Hrvatskoj. Rokovi, obveze, priprema. Provjerite jeste li spremni.',
  openGraph: {
    title: 'Fiskalizacija 2.0 | FiskAI',
    description: 'Provjerite jeste li spremni za Fiskalizaciju 2.0',
  },
}

const keyDates = [
  { date: '1. rujna 2025.', event: 'Početak testne faze' },
  { date: '31. prosinca 2025.', event: 'Rok za registraciju posrednika' },
  { date: '1. siječnja 2026.', event: 'Obvezno e-fakturiranje (PDV obveznici)' },
  { date: '1. siječnja 2027.', event: 'Obvezno e-fakturiranje (svi)' },
]

const faq = [
  {
    q: 'Što je Fiskalizacija 2.0?',
    a: 'Fiskalizacija 2.0 je proširenje postojećeg sustava fiskalizacije koje uvodi obvezno e-fakturiranje za sve poslovne transakcije (B2B, B2G) i proširuje fiskalizaciju na sve načine plaćanja.',
  },
  {
    q: 'Tko mora implementirati Fiskalizaciju 2.0?',
    a: 'Svi poduzetnici u RH. PDV obveznici od 1.1.2026., ostali od 1.1.2027. Paušalci mogu koristiti besplatnu državnu aplikaciju MIKROeRAČUN.',
  },
  {
    q: 'Što je informacijski posrednik?',
    a: 'Ovlaštena tvrtka koja posreduje u razmjeni e-računa između poduzetnika i Porezne uprave. Mora se registrirati do 31.12.2025.',
  },
  {
    q: 'Što ako ne implementiram na vrijeme?',
    a: 'Kazne za neusklađenost kreću se od 2.000 do 200.000 EUR ovisno o vrsti prekršaja i veličini poduzeća.',
  },
]

const sources = [
  { name: 'Zakon o fiskalizaciji (NN 89/25)', url: 'https://narodne-novine.nn.hr/' },
  { name: 'Porezna uprava - Fiskalizacija', url: 'https://www.porezna-uprava.hr/' },
  { name: 'e-Račun portal', url: 'https://e-racun.hr/' },
]

export default function FiskalizacijaHubPage() {
  const breadcrumbs = [
    { name: 'Baza znanja', url: 'https://fisk.ai/baza-znanja' },
    { name: 'Fiskalizacija 2.0', url: 'https://fisk.ai/fiskalizacija' },
  ]

  return (
    <>
      <JsonLd
        schemas={[
          generateBreadcrumbSchema(breadcrumbs),
          generateFAQSchema(faq),
        ]}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <nav className="mb-6 text-sm text-[var(--muted)]">
          <Link href="/baza-znanja" className="hover:text-[var(--foreground)]">
            Baza znanja
          </Link>{' '}
          <span>/</span>{' '}
          <span className="text-[var(--foreground)]">Fiskalizacija 2.0</span>
        </nav>

        {/* Hero */}
        <header className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-sm font-medium text-red-700">
            <AlertTriangle className="h-4 w-4" />
            Rok: 31. prosinca 2025.
          </div>
          <h1 className="text-4xl font-bold text-slate-900 md:text-5xl">
            Fiskalizacija 2.0
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Nova era e-fakturiranja u Hrvatskoj. Provjerite što se mijenja za
            vaše poslovanje i pripremite se na vrijeme.
          </p>
        </header>

        {/* Key dates */}
        <section className="mb-12">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">
            Ključni datumi
          </h2>
          <div className="grid gap-4 md:grid-cols-4">
            {keyDates.map((item, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white p-5 text-center"
              >
                <Calendar className="mx-auto mb-2 h-6 w-6 text-blue-600" />
                <p className="font-bold text-slate-900">{item.date}</p>
                <p className="mt-1 text-sm text-slate-600">{item.event}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Wizard */}
        <section className="mb-12">
          <h2 className="mb-6 text-center text-2xl font-bold text-slate-900">
            Provjerite svoju spremnost
          </h2>
          <Fiskalizacija2Wizard />
        </section>

        {/* Related guides */}
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-slate-900">
            Povezani vodiči
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Link
              href="/kako-da/registrirati-informacijskog-posrednika"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                  Kako registrirati informacijskog posrednika
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Korak po korak vodič za FiskAplikacija
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
            </Link>
            <Link
              href="/kako-da/izdati-prvi-fiskalizirani-racun"
              className="group flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-md"
            >
              <div>
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600">
                  Kako izdati prvi fiskalizirani račun
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Od certifikata do JIR-a
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-blue-600" />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <FAQ items={faq} />

        {/* Sources */}
        <Sources
          sources={sources}
          lastUpdated="2025-12-16"
          reviewer="Porezni savjetnik"
        />

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-8 text-center">
          <FileCheck className="mx-auto mb-4 h-12 w-12 text-blue-600" />
          <h2 className="text-2xl font-bold text-slate-900">
            Spremni za Fiskalizaciju 2.0?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-slate-600">
            FiskAI automatski generira e-račune u UBL formatu, fiskalizira ih i
            šalje putem PEPPOL mreže.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
            >
              Započni besplatno
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 hover:bg-slate-50"
            >
              Saznaj više
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
```

**Step 2: Verify page renders**

Run: `npm run dev`
Navigate to: `http://localhost:3000/fiskalizacija`
Expected: Page loads with wizard, dates, FAQ

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/fiskalizacija/page.tsx
git commit -m "feat(fiskalizacija): add hub page with wizard, dates, FAQ"
```

---

## Phase 3: End-of-Year Bundle Content

> **IMPORTANT:** All content must follow quality standards from design doc Section 8.
>
> - No AI filler phrases
> - Start with facts, not intros
> - Specific dates/numbers, not vague language
> - Verify all facts against official sources

### Task 3.1: Create PO-SD How-To Guide

**Files:**

- Create: `content/kako-da/ispuniti-po-sd.mdx`

**Step 1: Write the content**

Create `content/kako-da/ispuniti-po-sd.mdx`:

```mdx
---
title: Kako ispuniti PO-SD obrazac
description: Korak po korak vodič za ispunjavanje PO-SD obrasca za paušalne obrtnike putem ePorezna sustava.
lastUpdated: 2025-12-16
totalTime: PT15M
difficulty: easy
prerequisites:
  - Aktivni korisnički račun na ePorezna (NIAS prijava)
  - Evidencija primitaka za kvartal
  - OIB i podaci o obrtu
sources:
  - name: Porezna uprava - PO-SD
    url: https://www.porezna-uprava.hr/obrazac-po-sd
  - name: ePorezna portal
    url: https://e-porezna.porezna-uprava.hr
faq:
  - q: Koji je rok za predaju PO-SD obrasca?
    a: PO-SD se predaje kvartalno, do 20. u mjesecu nakon završetka kvartala. Za Q4, rok je 20. siječnja sljedeće godine.
  - q: Što ako nemam primitaka u kvartalu?
    a: I dalje morate predati obrazac s upisanom nulom. Nepredaja obrasca je prekršaj.
  - q: Mogu li ispraviti pogrešno predani PO-SD?
    a: Da, putem ePorezna možete predati ispravak do 15. u mjesecu nakon isteka roka.
keywords:
  - po-sd obrazac
  - paušalni obrt prijava
  - kvartalni porez
  - eporezna
---

<QuickAnswer>
  PO-SD obrazac predaje se kvartalno putem ePorezna sustava. Rok je 20. u mjesecu nakon završetka
  kvartala. Za Q4 2024, rok je **20. siječnja 2025**.
</QuickAnswer>

## Što je PO-SD obrazac?

PO-SD (Pregled primitaka i izdataka) je kvartalni obrazac kojim paušalni obrtnici prijavljuju ukupne primitke Poreznoj upravi. Na temelju ovog obrasca izračunava se kvartalna obveza poreza na dohodak.

**Tko mora predati:**

- Svi paušalni obrtnici
- Obrtnici koji koriste paušalno oporezivanje

**Tko NE mora:**

- d.o.o. i j.d.o.o.
- Obrtnici na dohodak (oni vode knjige)

<HowToSteps
  title="Kako ispuniti PO-SD obrazac"
  description="Korak po korak vodič za predaju PO-SD obrasca"
  totalTime="PT15M"
  steps={[
    {
      name: "Prijavite se na ePorezna",
      text: "Otvorite e-porezna.porezna-uprava.hr i prijavite se putem NIAS sustava (osobna iskaznica, mToken ili certifikat).",
    },
    {
      name: "Odaberite 'Predaja obrazaca'",
      text: "U glavnom izborniku kliknite 'Predaja obrazaca', zatim pronađite 'PO-SD - Pregled primitaka i izdataka'.",
    },
    {
      name: "Odaberite razdoblje",
      text: "Odaberite godinu i kvartal za koji predajete obrazac. Sustav će automatski povući vaše podatke (OIB, naziv obrta).",
    },
    {
      name: "Unesite primitke",
      text: "U polje 'Ukupni primici' upišite zbroj svih poslovnih primitaka za kvartal. Uključite sve uplate na poslovni račun koje su vezane uz djelatnost.",
    },
    {
      name: "Provjerite i potpišite",
      text: "Pregledajte unesene podatke. Kliknite 'Potpiši i pošalji'. Spremite potvrdu o predaji (PDF).",
    },
  ]}
/>

## Primjer izračuna

Za paušalnog obrtnika s primicima od 5.000 EUR u Q4:

| Stavka                 | Iznos          |
| ---------------------- | -------------- |
| Primitci Q4            | 5.000 EUR      |
| Porezna osnovica (12%) | 600 EUR        |
| Porez (20%)            | 120 EUR        |
| Prirez Zagreb (18%)    | 21,60 EUR      |
| **Ukupna obveza**      | **141,60 EUR** |

## Česte greške

1. **Propuštanje roka** - Kazna od 200-2.000 EUR
2. **Krivi iznos** - Ne uključivanje svih primitaka
3. **Privatne uplate** - Uključivanje privatnih transfera (ne smije se)

## Korisni alati

- [PO-SD Kalkulator](/alati/posd-kalkulator) - Automatski izračun iz bankovnog izvoda
- [Kalendar rokova](/alati/kalendar) - Svi porezni rokovi na jednom mjestu
```

**Step 2: Verify MDX syntax**

Run: `npm run build`
Expected: Build succeeds without MDX errors

**Step 3: Commit**

```bash
git add content/kako-da/ispuniti-po-sd.mdx
git commit -m "content: add PO-SD how-to guide"
```

---

### Task 3.2-3.6: Create Remaining End-of-Year Content

> Each content file follows the same pattern as Task 3.1. Create these files:

**Task 3.2:** `content/kako-da/registrirati-informacijskog-posrednika.mdx`

- Focus: FiskAplikacija registration process
- Key date: Dec 31, 2025 deadline

**Task 3.3:** `content/vodici/neoporezivi-primici.mdx`

- Focus: Complete list of non-taxable income types 2025
- Include: dnevnice, prijevoz, dar, jubilarna nagrada amounts

**Task 3.4:** `content/kako-da/godisnji-obracun-pausalca.mdx`

- Focus: Year-end checklist for paušalci
- Include: PO-SD annual, DOH if needed, contribution check

**Task 3.5:** `content/kako-da/uci-u-sustav-pdv.mdx`

- Focus: VAT registration process
- Include: When mandatory (60k threshold), voluntary registration

**Task 3.6:** `content/hubovi/fiskalizacija.mdx` (supplementary content for hub)

- Focus: Extended content for /fiskalizacija page

> **For each task:** Write content → Verify build → Commit

---

## Phase 4: Glossary Content (50 Terms)

### Task 4.1: Create Core Tax Terms (20 terms)

**Files:**

- Create: `content/rjecnik/pdv.mdx`
- Create: `content/rjecnik/oib.mdx`
- ... (20 files total)

**Template for each glossary term:**

```mdx
---
title: PDV
term: PDV
shortDefinition: Porez na dodanu vrijednost - potrošački porez koji se obračunava na većinu dobara i usluga u RH po stopi od 25%, 13% ili 5%.
lastUpdated: 2025-12-16
relatedTerms:
  - porezna osnovica
  - stopa poreza
  - PDV obrazac
appearsIn:
  - Računi (izlazni i ulazni)
  - PDV prijava (mjesečna/kvartalna)
  - Godišnja prijava PDV-a
triggerConditions:
  - Godišnji prihod preko 60.000 EUR
  - Dobrovoljni ulazak u sustav
sources:
  - name: Zakon o PDV-u
    url: https://www.zakon.hr/z/86/Zakon-o-porezu-na-dodanu-vrijednost
faq:
  - q: Tko mora biti u sustavu PDV-a?
    a: Poduzetnici s godišnjim prihodom iznad 60.000 EUR, te oni koji dobrovoljno uđu u sustav.
  - q: Koje su stope PDV-a u Hrvatskoj?
    a: Opća stopa 25%, snižena 13% (turizam, hrana), super-snižena 5% (knjige, lijekovi).
keywords:
  - pdv hrvatska
  - porez na dodanu vrijednost
  - vat croatia
---

## Što je PDV?

Porez na dodanu vrijednost (PDV) je neizravni porez koji se obračunava na potrošnju dobara i usluga. Konačni potrošač snosi teret poreza, dok ga poduzetnici samo prikupljaju i uplaćuju državi.

## Stope PDV-a u Hrvatskoj (2025.)

| Stopa | Primjena                              |
| ----- | ------------------------------------- |
| 25%   | Opća stopa - većina dobara i usluga   |
| 13%   | Ugostiteljstvo, novine, voda          |
| 5%    | Knjige, lijekovi, medicinska pomagala |
| 0%    | Izvoz, međunarodni prijevoz           |

## Prag za PDV

Obvezni ulazak u sustav PDV-a: **60.000 EUR godišnjeg prihoda**.

Pratite svoj prihod s [PDV Kalkulatorom](/alati/pdv-kalkulator).
```

> **For Phase 4:** Create 50 term files following this template.
> Group into batches: 4.1 (20 core), 4.2 (10 business), 4.3 (12 fiskalizacija), 4.4 (8 forms)

---

## Phase 5: Enhance Existing Content

### Task 5.1: Add FAQ to Existing Guides

**Files:**

- Modify: `content/vodici/pausalni-obrt.mdx`
- Modify: `content/vodici/obrt-dohodak.mdx`
- Modify: `content/vodici/doo.mdx`
- Modify: `content/vodici/freelancer.mdx`
- Modify: `content/vodici/posebni-oblici.mdx`

**Step 1: Add FAQ frontmatter and component to each guide**

Add to frontmatter:

```yaml
faq:
  - q: [Relevant question]
    a: [Concise answer]
sources:
  - name: [Official source]
    url: [URL]
lastReviewed: 2025-12-16
reviewer: Porezni savjetnik
```

Add at end of content:

```mdx
<FAQ items={frontmatter.faq} />
<Sources />
```

**Step 2: Verify build**

Run: `npm run build`
Expected: All guides render with FAQ sections

**Step 3: Commit per guide**

```bash
git add content/vodici/pausalni-obrt.mdx
git commit -m "content(pausalni-obrt): add FAQ and sources"
```

---

### Task 5.2: Add FAQ to Tool Pages

**Files:**

- Modify: `src/app/(marketing)/alati/pdv-kalkulator/page.tsx`
- Modify: `src/app/(marketing)/alati/kalkulator-poreza/page.tsx`
- ... (8 tool pages)

**Step 1: Add FAQ component to each tool page**

Import FAQ component and add static FAQ data:

```tsx
import { FAQ } from '@/components/content/FAQ'

const faq = [
  { q: 'Kako se izračunava...?', a: 'Izračun se temelji na...' },
  // 3-5 relevant questions per tool
]

// In JSX, after the tool component:
<FAQ items={faq} />
```

**Step 2: Commit per tool**

---

### Task 5.3: Add FAQ to Comparisons

**Files:**

- Modify: `content/usporedbe/pocinjem-solo.mdx`
- Modify: `content/usporedbe/firma.mdx`
- Modify: `content/usporedbe/dodatni-prihod.mdx`
- Modify: `content/usporedbe/preko-praga.mdx`

Same pattern as Task 5.1.

---

## Final: Verification & Build

### Task 6.1: Full Build Verification

**Step 1: Run complete build**

```bash
npm run build
```

Expected: All routes generated successfully

**Step 2: Verify schema output**

Check any page source for JSON-LD:

- FAQPage schema present
- BreadcrumbList schema present
- Correct structured data

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete content strategy implementation - Phase 1-5"
```

---

## Summary

| Phase | Tasks     | Output                                                  |
| ----- | --------- | ------------------------------------------------------- |
| 1     | 9 tasks   | 5 components, schema generators, types                  |
| 2     | 6 tasks   | 4 new routes (/rjecnik, /kako-da, /fiskalizacija, etc.) |
| 3     | 6 tasks   | 6 end-of-year content pieces                            |
| 4     | 4 batches | 50 glossary terms                                       |
| 5     | 3 tasks   | Enhanced 17 existing pages                              |

**Total: ~28 implementation tasks**
