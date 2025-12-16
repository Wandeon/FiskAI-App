# FiskAI Content Strategy Design

**Date:** 2025-12-16
**Status:** Approved
**Execution:** Subagent-Driven Development

## 1. Overview

This design implements FiskAI's SEO and AI-search dominance strategy by creating new content types, reusable components, and structured data automation. Priority is end-of-year compliance content (Fiskalizacija 2.0, PO-SD, neoporezivi primici).

### Goals

1. Capture "što je..." searches with 50-term glossary
2. Capture compliance searches with How-To guides
3. Dominate Fiskalizacija 2.0 searches with dedicated hub
4. Enable AI citation with structured Q&A and schema.org markup
5. Enhance existing content with FAQ, Sources, QuickAnswer components

### Success Metrics

- All 50 glossary terms indexed by Google
- End-of-year bundle (6 pieces) live before Dec 31, 2025
- FAQ schema present on all content pages
- Zero AI-slop phrases in content

---

## 2. Content Architecture

### 2.1 New Content Types

| Type      | Route                    | Count     | Format    |
| --------- | ------------------------ | --------- | --------- |
| Glossary  | `/rjecnik/[pojam]`       | 50 terms  | MDX       |
| How-To    | `/kako-da/[slug]`        | 10 guides | MDX       |
| Hub Pages | `/fiskalizacija`, `/pdv` | 2 hubs    | TSX + MDX |

### 2.2 Enhanced Existing Content

| Type        | Location            | Enhancement                          |
| ----------- | ------------------- | ------------------------------------ |
| Guides      | `/vodic/[slug]`     | Add FAQ, QuickAnswer, Sources footer |
| Tools       | `/alati/*`          | Add FAQ schema, Sources              |
| Comparisons | `/usporedba/[slug]` | Add FAQ section                      |

### 2.3 Frontmatter Schema

All content types use extended frontmatter:

```yaml
---
title: string
description: string
lastUpdated: date
lastReviewed: date # For E-E-A-T
reviewer: string # "Certified Accountant" etc.
sources:
  - name: string
    url: string
faq:
  - q: string
    a: string
keywords: string[]
---
```

---

## 3. Component Design

### 3.1 QuickAnswer

Featured snippet block for AI/Google. Renders highlighted box with `SpeakableSpecification` schema.

```tsx
<QuickAnswer>
  PO-SD obrazac predaje se kvartalno, najkasnije do 20. u mjesecu nakon završetka kvartala. Za Q4
  2024, rok je 20. siječnja 2025.
</QuickAnswer>
```

**Props:** `children: ReactNode`
**Output:** Blue/gray highlighted box, 2-4 sentences max

### 3.2 FAQ

Accordion UI with automatic FAQPage schema injection.

```tsx
<FAQ
  items={[
    { q: "Kada je rok za PO-SD?", a: "Do 20. u mjesecu nakon kvartala." },
    { q: "Tko mora predati PO-SD?", a: "Svi paušalni obrtnici." },
  ]}
/>
```

**Props:** `items: Array<{ q: string, a: string }>`
**Output:** Accordion UI + JSON-LD FAQPage schema in `<head>`

### 3.3 Sources

Auto-renders from frontmatter. Shows official sources, last updated date, reviewer line.

```tsx
<Sources />
```

**Props:** None (reads from frontmatter context)
**Output:** "Izvori" section with linked sources + metadata

### 3.4 HowToSteps

Step-by-step UI with HowTo schema for kako-da guides.

```tsx
<HowToSteps
  totalTime="PT15M"
  steps={[
    { name: "Prijava na ePorezna", text: "Otvorite...", image: "/img/step1.png" },
    { name: "Odabir obrasca", text: "Kliknite na..." },
  ]}
/>
```

**Props:** `totalTime: string` (ISO 8601), `steps: Array<{ name, text, image? }>`
**Output:** Numbered steps UI + JSON-LD HowTo schema

### 3.5 GlossaryCard

Term definition card with internal linking.

```tsx
<GlossaryCard
  term="ZKI"
  definition="Zaštitni kod izdavatelja - jedinstveni kod koji..."
  relatedTerms={["JIR", "fiskalizacija", "OIB"]}
/>
```

**Props:** `term: string`, `definition: string`, `relatedTerms: string[]`
**Output:** Definition card + DefinedTerm schema

---

## 4. Folder Structure

```
content/
├── vodici/           # existing (5 guides)
├── usporedbe/        # existing (4 comparisons)
├── rjecnik/          # NEW - 50 glossary terms
│   ├── pdv.mdx
│   ├── oib.mdx
│   ├── zki.mdx
│   └── ... (50 total)
├── kako-da/          # NEW - how-to guides
│   ├── ispuniti-po-sd.mdx
│   ├── registrirati-informacijskog-posrednika.mdx
│   └── ...
└── hubovi/           # NEW - hub page content
    ├── fiskalizacija.mdx
    └── pdv.mdx

src/app/(marketing)/
├── rjecnik/
│   ├── page.tsx           # A-Z listing
│   └── [pojam]/page.tsx   # Individual term
├── kako-da/
│   ├── page.tsx           # Listing
│   └── [slug]/page.tsx    # Individual guide
├── fiskalizacija/
│   └── page.tsx           # Hub with wizard
└── pdv/
    └── page.tsx           # PDV hub
```

---

## 5. Glossary Terms (50)

### Core Tax & Business (20)

PDV, OIB, JOPPD, MIO, HZZO, dohodak, dobit, prirez, paušal, porezna osnovica, akontacija, predujam, porezna prijava, minimalna osnovica, osobni odbitak, stopa poreza, porezni razred, fiskalna godina, rezident, nerezident

### Business Forms (10)

obrt, d.o.o., j.d.o.o., NKD, HOK, HGK, sudski registar, obrtni registar, temeljni kapital, direktor

### Fiskalizacija & E-Invoicing (12)

fiskalizacija, ZKI, JIR, e-račun, UBL, PEPPOL, informacijski posrednik, MIKROeRAČUN, FiskAplikacija, naknadno fiskaliziranje, POS, OIB operatera

### Forms & Reports (8)

PO-SD, DOH, URA, IRA, PDV obrazac, R-1, R-2, KPR

---

## 6. End-of-Year Bundle (Priority)

| Content                 | Type   | Route                                             | Search Intent                        |
| ----------------------- | ------ | ------------------------------------------------- | ------------------------------------ |
| Fiskalizacija 2.0 Hub   | Hub    | `/fiskalizacija`                                  | "fiskalizacija 2.0 što je novo"      |
| Registracija posrednika | How-To | `/kako-da/registrirati-informacijskog-posrednika` | "kako se registrirati fiskalizacija" |
| PO-SD ispunjavanje      | How-To | `/kako-da/ispuniti-po-sd`                         | "kako ispuniti po-sd"                |
| Neoporezivi primici     | Guide  | `/vodic/neoporezivi-primici`                      | "neoporezivi primici popis 2025"     |
| Godišnji obračun        | How-To | `/kako-da/godisnji-obracun-pausalca`              | "godišnji obračun paušalni obrt"     |
| PDV registracija        | How-To | `/kako-da/uci-u-sustav-pdv`                       | "kako ući u sustav pdv"              |

---

## 7. Schema.org Implementation

### Schemas by Content Type

| Content Type | Schemas                                        |
| ------------ | ---------------------------------------------- |
| All pages    | `BreadcrumbList`, `WebSite`, `Organization`    |
| Guides       | `Article`, `FAQPage`                           |
| Glossary     | `DefinedTerm`, `FAQPage`                       |
| How-To       | `HowTo`, `FAQPage`                             |
| Tools        | `WebApplication`, `FAQPage`                    |
| Comparisons  | `Article`, `FAQPage`                           |
| Hub pages    | `Article`, `FAQPage`, `SpeakableSpecification` |

### Implementation

```tsx
// src/components/seo/JsonLd.tsx
export function JsonLd({ schemas }: { schemas: object[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas) }}
    />
  )
}

// src/lib/schema/generators.ts
export function generateFAQSchema(items: FAQ[]): object
export function generateHowToSchema(steps: Step[], totalTime: string): object
export function generateArticleSchema(frontmatter: Frontmatter): object
export function generateDefinedTermSchema(term: string, definition: string): object
export function generateBreadcrumbSchema(items: Breadcrumb[]): object
```

---

## 8. Content Quality Standards

### Quality Gates

| Check               | Requirement                                                   |
| ------------------- | ------------------------------------------------------------- |
| Croatian Accuracy   | Native phrasing, correct declensions, no literal translations |
| Terminology         | Official Porezna Uprava terms only                            |
| Value Density       | Every sentence informs or helps - no fluff                    |
| Source Verification | All numbers/dates verified against official sources           |
| Actionable          | Reader knows exactly what to do after reading                 |

### Anti-Patterns (Reject)

```
❌ "U ovom članku ćemo vam pokazati..."
❌ "Važno je napomenuti da..."
❌ "Kao što smo već spomenuli..."
❌ "U današnje vrijeme..."
❌ Generic definitions without context
❌ Repeating the title in first paragraph
```

### Good Patterns

```
✅ Start with the answer/fact immediately
✅ Use specific numbers, dates, thresholds
✅ "Rok je 20. siječnja 2025." not "Rok je uskoro."
✅ Include worked examples with real EUR amounts
✅ Link to official source for verification
```

### Review Process

1. Subagent writes content
2. Code reviewer checks:
   - Croatian language quality
   - No AI filler phrases (grep for anti-patterns)
   - Facts verified against sources
   - Actionable next steps included
3. Reject if quality gate fails → rewrite

---

## 9. Implementation Phases

### Phase 1: Foundation (Components + Infrastructure)

- Create QuickAnswer, FAQ, Sources, HowToSteps, GlossaryCard components
- Create schema generators
- Update TypeScript types for new frontmatter fields

### Phase 2: Routes & Listings

- Create /rjecnik listing and [pojam] route
- Create /kako-da listing and [slug] route
- Create /fiskalizacija hub page

### Phase 3: End-of-Year Bundle

- Write 6 priority content pieces
- Fiskalizacija hub, PO-SD, neoporezivi primici, etc.

### Phase 4: Glossary Content

- Write 50 glossary term MDX files
- 20 core + 10 business + 12 fiskalizacija + 8 forms

### Phase 5: Enhance Existing Content

- Add FAQ + Sources to 5 guides
- Add FAQ to 8 tools
- Add FAQ to 4 comparisons

---

## 10. Existing Assets (Reference)

### Already Built

- `Fiskalizacija2Wizard.tsx` - Interactive questionnaire
- `docs/research/fiskalizacija-2.md` - Research with timelines
- PO-SD Calculator (`/alati/posd-kalkulator`)
- 5 Guides, 4 Comparisons, 8 Tools

### To Integrate

- Fiskalizacija wizard → embed in /fiskalizacija hub
- PO-SD calculator → link from kako-da guide
- Existing research → source for content accuracy
