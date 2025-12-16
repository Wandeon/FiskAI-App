# Knowledge Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform FiskAI marketing into THE authoritative Croatian business knowledge hub with wizard, guides, and calculators.

**Architecture:** MDX-based static content with dynamic calculator components. Wizard generates URL params for personalized sections on SEO-friendly static pages. Hub3 barcode generation for payment slips.

**Tech Stack:** Next.js 14, MDX (next-mdx-remote), TypeScript, Tailwind CSS, bwip-js (Hub3 barcodes)

---

## Batch 1: Foundation (Tasks 1-5)

### Task 1: Install MDX Dependencies

**Files:**

- Modify: `/home/admin/FiskAI/package.json`

**Step 1: Install dependencies**

```bash
cd /home/admin/FiskAI && npm install next-mdx-remote gray-matter bwip-js @types/bwip-js
```

**Step 2: Verify installation**

Run: `npm ls next-mdx-remote gray-matter bwip-js`
Expected: All packages listed without errors

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add MDX and Hub3 barcode dependencies"
```

---

### Task 2: Create Constants File with 2025 Croatian Tax Data

**Files:**

- Create: `/home/admin/FiskAI/src/lib/knowledge-hub/constants.ts`
- Test: `/home/admin/FiskAI/src/lib/knowledge-hub/__tests__/constants.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/knowledge-hub/__tests__/constants.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  PAUSAL_TAX_BRACKETS,
  MONTHLY_CONTRIBUTIONS,
  THRESHOLDS,
  HOK,
  PAYMENT_IBANS,
  TZ_RATES,
  getPausalTaxBracket,
} from "../constants"

describe("Knowledge Hub Constants", () => {
  describe("PAUSAL_TAX_BRACKETS", () => {
    it("should have 7 tax brackets", () => {
      assert.strictEqual(PAUSAL_TAX_BRACKETS.length, 7)
    })

    it("should have correct first bracket (0-11300)", () => {
      const first = PAUSAL_TAX_BRACKETS[0]
      assert.strictEqual(first.min, 0)
      assert.strictEqual(first.max, 11300)
      assert.strictEqual(first.quarterlyTax, 50.85)
    })

    it("should have correct last bracket (50000.01-60000)", () => {
      const last = PAUSAL_TAX_BRACKETS[6]
      assert.strictEqual(last.min, 50000.01)
      assert.strictEqual(last.max, 60000)
      assert.strictEqual(last.quarterlyTax, 270)
    })
  })

  describe("getPausalTaxBracket", () => {
    it("should return first bracket for 10000 EUR", () => {
      const bracket = getPausalTaxBracket(10000)
      assert.strictEqual(bracket.quarterlyTax, 50.85)
    })

    it("should return fourth bracket for 25000 EUR", () => {
      const bracket = getPausalTaxBracket(25000)
      assert.strictEqual(bracket.quarterlyTax, 137.7)
    })

    it("should return last bracket for 55000 EUR", () => {
      const bracket = getPausalTaxBracket(55000)
      assert.strictEqual(bracket.quarterlyTax, 270)
    })
  })

  describe("MONTHLY_CONTRIBUTIONS", () => {
    it("should have correct total of 262.51", () => {
      assert.strictEqual(MONTHLY_CONTRIBUTIONS.TOTAL, 262.51)
    })

    it("should have MIO_I at 107.88", () => {
      assert.strictEqual(MONTHLY_CONTRIBUTIONS.MIO_I.amount, 107.88)
    })
  })

  describe("THRESHOLDS", () => {
    it("should have PDV threshold at 60000", () => {
      assert.strictEqual(THRESHOLDS.VAT_REGISTRATION, 60000)
    })
  })

  describe("PAYMENT_IBANS", () => {
    it("should have valid Croatian IBAN format", () => {
      Object.values(PAYMENT_IBANS).forEach((iban) => {
        assert.ok(iban.startsWith("HR"), `IBAN ${iban} should start with HR`)
        assert.strictEqual(iban.length, 21, `IBAN ${iban} should be 21 chars`)
      })
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/knowledge-hub/__tests__/constants.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create directory and write implementation**

```bash
mkdir -p /home/admin/FiskAI/src/lib/knowledge-hub/__tests__
```

```typescript
// src/lib/knowledge-hub/constants.ts

// ============================================================================
// PAUŠALNI OBRT TAX BRACKETS 2025
// Source: https://fiskalopedija.hr/pausalni-obrt/
// ============================================================================

export interface TaxBracket {
  min: number
  max: number
  base: number
  annualTax: number
  quarterlyTax: number
}

export const PAUSAL_TAX_BRACKETS: TaxBracket[] = [
  { min: 0, max: 11300, base: 1695, annualTax: 203.4, quarterlyTax: 50.85 },
  { min: 11300.01, max: 15300, base: 2295, annualTax: 275.4, quarterlyTax: 68.85 },
  { min: 15300.01, max: 19900, base: 2985, annualTax: 358.2, quarterlyTax: 89.55 },
  { min: 19900.01, max: 30600, base: 4590, annualTax: 550.8, quarterlyTax: 137.7 },
  { min: 30600.01, max: 40000, base: 6000, annualTax: 720.0, quarterlyTax: 180.0 },
  { min: 40000.01, max: 50000, base: 7500, annualTax: 900.0, quarterlyTax: 225.0 },
  { min: 50000.01, max: 60000, base: 9000, annualTax: 1080.0, quarterlyTax: 270.0 },
]

export const PAUSAL_TAX_RATE = 0.12 // 12% without local surtax

export function getPausalTaxBracket(annualRevenue: number): TaxBracket {
  const bracket = PAUSAL_TAX_BRACKETS.find((b) => annualRevenue >= b.min && annualRevenue <= b.max)
  return bracket || PAUSAL_TAX_BRACKETS[PAUSAL_TAX_BRACKETS.length - 1]
}

// ============================================================================
// MONTHLY CONTRIBUTIONS 2025
// Source: https://www.hok.hr/
// ============================================================================

export const CONTRIBUTION_BASE_2025 = 719.2 // EUR - minimalna osnovica

export const MONTHLY_CONTRIBUTIONS = {
  MIO_I: { rate: 0.15, amount: 107.88, name: "MIO I. stup" },
  MIO_II: { rate: 0.05, amount: 35.96, name: "MIO II. stup" },
  HZZO: { rate: 0.165, amount: 118.67, name: "HZZO" },
  TOTAL: 262.51,
  BASE: CONTRIBUTION_BASE_2025,
} as const

// ============================================================================
// KEY THRESHOLDS 2025
// ============================================================================

export const THRESHOLDS = {
  VAT_REGISTRATION: 60000, // EUR - increased from 40000 in 2025
  PAUSAL_MAX: 60000, // EUR - same as VAT threshold
  CASH_B2B_LIMIT: 700, // EUR - per transaction
  ASSET_CAPITALIZATION: 464.53, // EUR - per item
  CORPORATE_TAX_SMALL: 1000000, // EUR - 10% rate threshold
} as const

// ============================================================================
// HOK (HRVATSKA OBRTNIČKA KOMORA) 2025
// Source: https://www.hok.hr/
// ============================================================================

export const HOK = {
  MONTHLY: 11.4,
  QUARTERLY: 34.2,
  ANNUAL: 136.8,
  DEADLINES: ["27.2.", "31.5.", "31.8.", "30.11."],
} as const

// ============================================================================
// TURISTIČKA ZAJEDNICA RATES 2025
// Rates are percentage of total annual revenue
// ============================================================================

export const TZ_RATES = {
  GROUP_1: { rate: 0.0014212, description: "Turizam, ugostiteljstvo" },
  GROUP_2: { rate: 0.0011367, description: "Trgovina, prijevoz" },
  GROUP_3: { rate: 0.0008527, description: "Usluge" },
  GROUP_4: { rate: 0.0002842, description: "Proizvodnja" },
  GROUP_5: { rate: 0.0001705, description: "Poljoprivreda, ribarstvo" },
} as const

// ============================================================================
// INCOME TAX RATES 2025 (for obrt na dohodak)
// Includes average local surtax (~10%)
// ============================================================================

export const INCOME_TAX_BRACKETS = [
  { min: 0, max: 50400, rate: 0.236 }, // 23.6%
  { min: 50400.01, max: Infinity, rate: 0.354 }, // 35.4%
] as const

// ============================================================================
// CORPORATE TAX 2025 (for d.o.o.)
// ============================================================================

export const CORPORATE_TAX = {
  SMALL: { maxRevenue: 1000000, rate: 0.1 }, // 10%
  LARGE: { minRevenue: 1000000, rate: 0.18 }, // 18%
} as const

// ============================================================================
// PAYMENT IBANs
// Model: HR68
// ============================================================================

export const PAYMENT_IBANS = {
  STATE_BUDGET: "HR1210010051863000160", // Državni proračun (porezi)
  MIO_II: "HR8724070001007120013", // II. mirovinski stup
  HZZO: "HR6510010051550100001", // Zdravstveno osiguranje
  HOK: "HR1223400091100106237", // Obrtnička komora
} as const

export const PAYMENT_MODEL = "HR68"

// ============================================================================
// CONTRIBUTION PAYMENT DEADLINES
// ============================================================================

export const CONTRIBUTION_DEADLINES = {
  MONTHLY: "Do 15. u mjesecu za prethodni mjesec",
  MIO_II_DEADLINE: "Do 15. u mjesecu",
  HOK_QUARTERLY: ["27.2.", "31.5.", "31.8.", "30.11."],
  PAUSAL_TAX_QUARTERLY: ["31.1.", "30.4.", "31.7.", "31.10."],
} as const
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/knowledge-hub/__tests__/constants.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/knowledge-hub/
git commit -m "feat: add 2025 Croatian tax constants for knowledge hub"
```

---

### Task 3: Create Calculation Functions

**Files:**

- Create: `/home/admin/FiskAI/src/lib/knowledge-hub/calculations.ts`
- Test: `/home/admin/FiskAI/src/lib/knowledge-hub/__tests__/calculations.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/knowledge-hub/__tests__/calculations.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import {
  calculatePausalMonthlyCosts,
  calculatePausalAnnualCosts,
  calculateContributions,
  calculateTZContribution,
} from "../calculations"

describe("Knowledge Hub Calculations", () => {
  describe("calculatePausalMonthlyCosts", () => {
    it("should calculate monthly costs for 25000 EUR annual revenue", () => {
      const result = calculatePausalMonthlyCosts(25000)
      assert.strictEqual(result.contributions, 262.51)
      assert.strictEqual(result.hok, 11.4)
      // quarterlyTax / 3 = 137.70 / 3 = 45.90
      assert.strictEqual(result.tax, 45.9)
    })
  })

  describe("calculatePausalAnnualCosts", () => {
    it("should calculate annual costs for 25000 EUR revenue", () => {
      const result = calculatePausalAnnualCosts(25000)
      assert.strictEqual(result.contributions, 3150.12) // 262.51 * 12
      assert.strictEqual(result.hok, 136.8) // 34.20 * 4
      assert.strictEqual(result.tax, 550.8) // bracket 4
      assert.strictEqual(result.total, 3837.72)
    })
  })

  describe("calculateContributions", () => {
    it("should break down monthly contributions", () => {
      const result = calculateContributions()
      assert.strictEqual(result.mioI, 107.88)
      assert.strictEqual(result.mioII, 35.96)
      assert.strictEqual(result.hzzo, 118.67)
      assert.strictEqual(result.total, 262.51)
    })
  })

  describe("calculateTZContribution", () => {
    it("should calculate TZ for group 3 (services) at 50000 EUR", () => {
      const result = calculateTZContribution(50000, "GROUP_3")
      // 50000 * 0.0008527 = 42.635
      assert.ok(result >= 42 && result <= 43)
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/knowledge-hub/__tests__/calculations.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/knowledge-hub/calculations.ts
import {
  getPausalTaxBracket,
  MONTHLY_CONTRIBUTIONS,
  HOK,
  TZ_RATES,
  CONTRIBUTION_BASE_2025,
} from "./constants"

export interface MonthlyCostBreakdown {
  contributions: number
  hok: number
  tax: number
  total: number
}

export interface AnnualCostBreakdown {
  contributions: number
  hok: number
  tax: number
  tz?: number
  total: number
}

export interface ContributionBreakdown {
  mioI: number
  mioII: number
  hzzo: number
  total: number
  base: number
}

/**
 * Calculate monthly costs for paušalni obrt
 */
export function calculatePausalMonthlyCosts(annualRevenue: number): MonthlyCostBreakdown {
  const bracket = getPausalTaxBracket(annualRevenue)
  const monthlyTax = Number((bracket.quarterlyTax / 3).toFixed(2))

  const contributions = MONTHLY_CONTRIBUTIONS.TOTAL
  const hok = HOK.MONTHLY

  return {
    contributions,
    hok,
    tax: monthlyTax,
    total: Number((contributions + hok + monthlyTax).toFixed(2)),
  }
}

/**
 * Calculate annual costs for paušalni obrt
 */
export function calculatePausalAnnualCosts(
  annualRevenue: number,
  tzGroup?: keyof typeof TZ_RATES
): AnnualCostBreakdown {
  const bracket = getPausalTaxBracket(annualRevenue)

  const contributions = Number((MONTHLY_CONTRIBUTIONS.TOTAL * 12).toFixed(2))
  const hok = Number((HOK.QUARTERLY * 4).toFixed(2))
  const tax = bracket.annualTax

  let tz: number | undefined
  if (tzGroup) {
    tz = Number((annualRevenue * TZ_RATES[tzGroup].rate).toFixed(2))
  }

  const total = Number((contributions + hok + tax + (tz || 0)).toFixed(2))

  return {
    contributions,
    hok,
    tax,
    tz,
    total,
  }
}

/**
 * Get monthly contribution breakdown
 */
export function calculateContributions(): ContributionBreakdown {
  return {
    mioI: MONTHLY_CONTRIBUTIONS.MIO_I.amount,
    mioII: MONTHLY_CONTRIBUTIONS.MIO_II.amount,
    hzzo: MONTHLY_CONTRIBUTIONS.HZZO.amount,
    total: MONTHLY_CONTRIBUTIONS.TOTAL,
    base: CONTRIBUTION_BASE_2025,
  }
}

/**
 * Calculate Turistička Zajednica contribution
 */
export function calculateTZContribution(
  annualRevenue: number,
  group: keyof typeof TZ_RATES
): number {
  return Number((annualRevenue * TZ_RATES[group].rate).toFixed(2))
}

/**
 * Format EUR amount for display
 */
export function formatEUR(amount: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/knowledge-hub/__tests__/calculations.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/knowledge-hub/
git commit -m "feat: add calculation functions for knowledge hub"
```

---

### Task 4: Create TypeScript Types

**Files:**

- Create: `/home/admin/FiskAI/src/lib/knowledge-hub/types.ts`

**Step 1: Write types file**

```typescript
// src/lib/knowledge-hub/types.ts

export type BusinessType =
  | "pausalni-obrt"
  | "pausalni-obrt-uz-zaposlenje"
  | "pausalni-obrt-umirovljenik"
  | "obrt-dohodak"
  | "obrt-dohodak-uz-zaposlenje"
  | "obrt-dobit"
  | "jdoo"
  | "jdoo-uz-zaposlenje"
  | "doo-jednoclan"
  | "doo-viseclano"
  | "doo-direktor-bez-place"
  | "doo-direktor-s-placom"
  | "slobodna-profesija"
  | "opg"
  | "udruga"
  | "zadruga"
  | "sezonski-obrt"
  | "pausalni-pdv"
  | "it-freelancer"
  | "ugostiteljstvo"

export interface GuideFrontmatter {
  title: string
  description: string
  businessType: BusinessType
  lastUpdated: string
  keywords: string[]
  requiresFiscalization: boolean
  requiresVAT: boolean
  maxRevenue?: number
}

export interface WizardAnswer {
  questionId: string
  value: string
}

export interface WizardState {
  currentStep: number
  answers: WizardAnswer[]
  recommendedType?: BusinessType
}

export interface PersonalizationParams {
  prihod?: number
  gotovina?: "da" | "ne"
  zaposlenje?: "da" | "ne"
  nkd?: string
}

export interface ToolPageProps {
  embedded?: boolean
}

export interface FAQ {
  question: string
  answer: string
}
```

**Step 2: Commit**

```bash
git add src/lib/knowledge-hub/types.ts
git commit -m "feat: add TypeScript types for knowledge hub"
```

---

### Task 5: Create Hub3 Barcode Generator

**Files:**

- Create: `/home/admin/FiskAI/src/lib/knowledge-hub/hub3.ts`
- Test: `/home/admin/FiskAI/src/lib/knowledge-hub/__tests__/hub3.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/knowledge-hub/__tests__/hub3.test.ts
import { describe, it } from "node:test"
import assert from "node:assert"
import { generateHub3Data, formatHub3Amount, validateOIB } from "../hub3"

describe("Hub3 Barcode Generator", () => {
  describe("validateOIB", () => {
    it("should validate correct OIB", () => {
      // Using test OIB with valid checksum
      assert.strictEqual(validateOIB("12345678903"), true)
    })

    it("should reject invalid OIB length", () => {
      assert.strictEqual(validateOIB("123456789"), false)
    })

    it("should reject non-numeric OIB", () => {
      assert.strictEqual(validateOIB("1234567890A"), false)
    })
  })

  describe("formatHub3Amount", () => {
    it("should format 262.51 as 000000026251", () => {
      assert.strictEqual(formatHub3Amount(262.51), "000000026251")
    })

    it("should format 1000 as 000000100000", () => {
      assert.strictEqual(formatHub3Amount(1000), "000000100000")
    })
  })

  describe("generateHub3Data", () => {
    it("should generate valid Hub3 data string", () => {
      const data = generateHub3Data({
        amount: 262.51,
        payerName: "Ivan Horvat",
        payerAddress: "Ilica 1",
        payerCity: "10000 Zagreb",
        recipientName: "HZZO",
        recipientAddress: "Margaretska 3",
        recipientCity: "10000 Zagreb",
        recipientIBAN: "HR6510010051550100001",
        model: "HR68",
        reference: "1234567890123-12345",
        description: "Doprinos za zdravstveno osiguranje",
      })

      assert.ok(data.startsWith("HRVHUB30"))
      assert.ok(data.includes("HR6510010051550100001"))
    })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/lib/knowledge-hub/__tests__/hub3.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/knowledge-hub/hub3.ts
import bwipjs from "bwip-js"

export interface Hub3Data {
  amount: number
  payerName: string
  payerAddress: string
  payerCity: string
  recipientName: string
  recipientAddress: string
  recipientCity: string
  recipientIBAN: string
  model: string
  reference: string
  description: string
  currency?: string
}

/**
 * Validate Croatian OIB (Personal Identification Number)
 * Uses ISO 7064, MOD 11-10 algorithm
 */
export function validateOIB(oib: string): boolean {
  if (!/^\d{11}$/.test(oib)) return false

  let a = 10
  for (let i = 0; i < 10; i++) {
    a = (a + parseInt(oib[i], 10)) % 10
    if (a === 0) a = 10
    a = (a * 2) % 11
  }

  const controlDigit = (11 - a) % 10
  return controlDigit === parseInt(oib[10], 10)
}

/**
 * Format amount for Hub3 (15 digits, no decimal point)
 */
export function formatHub3Amount(amount: number): string {
  const cents = Math.round(amount * 100)
  return cents.toString().padStart(12, "0")
}

/**
 * Pad or trim string to exact length
 */
function padString(str: string, length: number): string {
  return str.slice(0, length).padEnd(length, " ")
}

/**
 * Generate Hub3 barcode data string
 * Format: HRVHUB30 + fixed-length fields
 */
export function generateHub3Data(data: Hub3Data): string {
  const currency = data.currency || "EUR"
  const amount = formatHub3Amount(data.amount)

  // Hub3 format specification
  const lines = [
    "HRVHUB30", // Header
    currency, // Currency (3)
    amount, // Amount (15)
    padString(data.payerName, 30), // Payer name
    padString(data.payerAddress, 27), // Payer address
    padString(data.payerCity, 27), // Payer city
    padString(data.recipientName, 25), // Recipient name
    padString(data.recipientAddress, 25), // Recipient address
    padString(data.recipientCity, 27), // Recipient city
    data.recipientIBAN, // IBAN (21)
    data.model, // Model (4)
    padString(data.reference, 22), // Reference
    "COST", // Purpose code
    padString(data.description, 35), // Description
  ]

  return lines.join("\n")
}

/**
 * Generate Hub3 barcode as PNG buffer
 */
export async function generateHub3Barcode(data: Hub3Data): Promise<Buffer> {
  const hub3String = generateHub3Data(data)

  return bwipjs.toBuffer({
    bcid: "pdf417",
    text: hub3String,
    scale: 2,
    height: 10,
    includetext: false,
  })
}

/**
 * Generate Hub3 barcode as base64 data URL
 */
export async function generateHub3DataUrl(data: Hub3Data): Promise<string> {
  const buffer = await generateHub3Barcode(data)
  return `data:image/png;base64,${buffer.toString("base64")}`
}
```

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/knowledge-hub/__tests__/hub3.test.ts`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/lib/knowledge-hub/
git commit -m "feat: add Hub3 barcode generator for payment slips"
```

---

## Batch 2: MDX Infrastructure (Tasks 6-8)

### Task 6: Create MDX Loader Utility

**Files:**

- Create: `/home/admin/FiskAI/src/lib/knowledge-hub/mdx.ts`

**Step 1: Write implementation**

```typescript
// src/lib/knowledge-hub/mdx.ts
import fs from "fs"
import path from "path"
import matter from "gray-matter"
import { GuideFrontmatter, BusinessType } from "./types"

const CONTENT_DIR = path.join(process.cwd(), "content")

export interface GuideContent {
  frontmatter: GuideFrontmatter
  content: string
  slug: string
}

/**
 * Get all guide slugs for static generation
 */
export function getGuideSlugs(): string[] {
  const guidesDir = path.join(CONTENT_DIR, "vodici")
  if (!fs.existsSync(guidesDir)) return []

  return fs
    .readdirSync(guidesDir)
    .filter((file) => file.endsWith(".mdx"))
    .map((file) => file.replace(/\.mdx$/, ""))
}

/**
 * Get guide content by slug
 */
export function getGuideBySlug(slug: string): GuideContent | null {
  const filePath = path.join(CONTENT_DIR, "vodici", `${slug}.mdx`)

  if (!fs.existsSync(filePath)) return null

  const fileContent = fs.readFileSync(filePath, "utf-8")
  const { data, content } = matter(fileContent)

  return {
    frontmatter: data as GuideFrontmatter,
    content,
    slug,
  }
}

/**
 * Get all guides with frontmatter (for listing)
 */
export function getAllGuides(): GuideContent[] {
  const slugs = getGuideSlugs()
  return slugs.map(getGuideBySlug).filter((guide): guide is GuideContent => guide !== null)
}
```

**Step 2: Create content directory structure**

```bash
mkdir -p /home/admin/FiskAI/content/vodici
mkdir -p /home/admin/FiskAI/content/postupci
mkdir -p /home/admin/FiskAI/content/baza-znanja
```

**Step 3: Commit**

```bash
git add src/lib/knowledge-hub/mdx.ts content/
git commit -m "feat: add MDX loader utility and content directories"
```

---

### Task 7: Create First MDX Guide (Paušalni Obrt)

**Files:**

- Create: `/home/admin/FiskAI/content/vodici/pausalni-obrt.mdx`

**Step 1: Write MDX content**

```mdx
---
title: "Paušalni obrt - Kompletan vodič za 2025."
description: "Sve što trebate znati o paušalnom obrtu u Hrvatskoj: porezni razredi, doprinosi, registracija i obveze."
businessType: "pausalni-obrt"
lastUpdated: "2025-01-15"
keywords: ["paušalni obrt", "otvaranje obrta", "paušalni porez 2025", "doprinosi obrtnika"]
requiresFiscalization: true
requiresVAT: false
maxRevenue: 60000
---

# Paušalni obrt - Kompletan vodič za 2025.

<PersonalizedSection />

## Brzi pregled

| Stavka                 | Vrijednost                    |
| ---------------------- | ----------------------------- |
| Tko može otvoriti      | Fizička osoba, bez partnera   |
| Godišnji limit prihoda | 60.000 EUR                    |
| PDV obveza             | Ne (do 60.000 EUR)            |
| Fiskalizacija          | Obavezna za gotovinski promet |
| Doprinosi              | 262,51 EUR mjesečno           |
| HOK članarina          | 34,20 EUR kvartalno           |

## Detaljni troškovi

<ContributionCalculator />

### Paušalni porez 2025.

Porez ovisi o visini godišnjeg primitka:

| Godišnji primitak (EUR) | Kvartalni porez (EUR) |
| ----------------------- | --------------------- |
| do 11.300               | 50,85                 |
| 11.300 - 15.300         | 68,85                 |
| 15.300 - 19.900         | 89,55                 |
| 19.900 - 30.600         | 137,70                |
| 30.600 - 40.000         | 180,00                |
| 40.000 - 50.000         | 225,00                |
| 50.000 - 60.000         | 270,00                |

<TaxCalculator />

## Pravila i ograničenja

### Tko NE MOŽE biti paušalist

- Osobe koje obavljaju djelatnost u supoduzetništvu
- Osobe koje su u prethodnoj godini prešle limit od 60.000 EUR
- Obveznici PDV-a (ali možete postati obveznik ako želite)

### Gotovinski promet

Ako primate gotovinu, **fiskalizacija je obavezna**. To uključuje:

- Fiskalni uređaj ili softver
- Registraciju u sustavu Porezne uprave
- Izdavanje fiskalnih računa

### B2B plaćanja gotovinom

Maksimalno **700 EUR po transakciji** za plaćanja drugim poslovnim subjektima.

## Postupak registracije

1. **Odabir djelatnosti** - NKD šifra iz Nacionalne klasifikacije
2. **e-Obrt** - Online prijava na gov.hr
3. **Dokumenti** - Osobna iskaznica, IBAN, adresa prostora
4. **Čekanje** - Rješenje u roku 8 dana
5. **Prijava doprinosa** - Automatski putem sustava

## Obveze tijekom poslovanja

### Mjesečno

- Plaćanje doprinosa do 15. u mjesecu (262,51 EUR)
- Vođenje evidencije primitaka

### Kvartalno

- Plaćanje poreza do zadnjeg dana u kvartalu
- Plaćanje HOK članarine (34,20 EUR)

### Godišnje

- PO-SD obrazac do 15. siječnja
- Evidencija o prometu

## Plaćanja i IBAN-ovi

<PaymentSlipGenerator />

### IBAN-ovi za uplate

| Namjena      | IBAN                  | Model |
| ------------ | --------------------- | ----- |
| MIO I. stup  | HR1210010051863000160 | HR68  |
| MIO II. stup | HR8724070001007120013 | HR68  |
| HZZO         | HR6510010051550100001 | HR68  |
| HOK          | HR1223400091100106237 | HR68  |

## FAQ

<FAQ question="Mogu li imati paušalni obrt uz zaposlenje?">
  Da! Ako ste zaposleni kod drugog poslodavca, možete otvoriti paušalni obrt kao dodatnu djelatnost.
  Doprinosi se i dalje plaćaju u punom iznosu.
</FAQ>

<FAQ question="Što ako prijeđem 60.000 EUR?">
  Morate prijeći na obrt na dohodak i postati PDV obveznik. Prijelaz se radi od 1. siječnja sljedeće
  godine.
</FAQ>

<FAQ question="Trebam li knjigovođu?">
  Za paušalni obrt nije obavezan. Dovoljno je voditi evidenciju primitaka (KPR obrazac) koji možete
  voditi sami.
</FAQ>

---

_Zadnje ažurirano: 15. siječnja 2025._

Imate ispravak? [Prijavite grešku](/kontakt?tip=ispravak&stranica=pausalni-obrt)
```

**Step 2: Commit**

```bash
git add content/vodici/pausalni-obrt.mdx
git commit -m "feat: add paušalni obrt guide content"
```

---

### Task 8: Create MDX Components for Guides

**Files:**

- Create: `/home/admin/FiskAI/src/components/knowledge-hub/mdx-components.tsx`
- Create: `/home/admin/FiskAI/src/components/knowledge-hub/guide/PersonalizedSection.tsx`
- Create: `/home/admin/FiskAI/src/components/knowledge-hub/guide/FAQ.tsx`

**Step 1: Create PersonalizedSection component**

```typescript
// src/components/knowledge-hub/guide/PersonalizedSection.tsx
"use client"

import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculatePausalMonthlyCosts, formatEUR } from "@/lib/knowledge-hub/calculations"
import { getPausalTaxBracket } from "@/lib/knowledge-hub/constants"

export function PersonalizedSection() {
  const searchParams = useSearchParams()

  const prihod = searchParams.get("prihod")
  const gotovina = searchParams.get("gotovina")
  const zaposlenje = searchParams.get("zaposlenje")

  if (!prihod) return null

  const annualRevenue = parseInt(prihod, 10)
  const costs = calculatePausalMonthlyCosts(annualRevenue)
  const bracket = getPausalTaxBracket(annualRevenue)

  return (
    <Card className="mb-8 border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          Vaš personalizirani pregled
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          Na temelju vaših odgovora iz čarobnjaka:
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-4 rounded-lg">
            <p className="text-sm text-gray-500">Očekivani godišnji prihod</p>
            <p className="text-xl font-bold">{formatEUR(annualRevenue)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-sm text-gray-500">Kvartalni porez</p>
            <p className="text-xl font-bold">{formatEUR(bracket.quarterlyTax)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-sm text-gray-500">Mjesečni doprinosi</p>
            <p className="text-xl font-bold">{formatEUR(costs.contributions)}</p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <p className="text-sm text-gray-500">Fiskalizacija</p>
            <p className="text-xl font-bold">{gotovina === "da" ? "Potrebna" : "Nije potrebna"}</p>
          </div>
        </div>
        {zaposlenje === "da" && (
          <p className="mt-4 text-sm bg-yellow-50 p-3 rounded border border-yellow-200">
            💡 <strong>Napomena:</strong> Uz zaposlenje kod drugog poslodavca, i dalje plaćate pune doprinose za obrt.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
```

**Step 2: Create FAQ component**

```typescript
// src/components/knowledge-hub/guide/FAQ.tsx
"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface FAQProps {
  question: string
  children: React.ReactNode
}

export function FAQ({ question, children }: FAQProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-gray-200 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left font-medium"
      >
        <span>{question}</span>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="mt-3 text-gray-600 prose prose-sm">
          {children}
        </div>
      )}
    </div>
  )
}
```

**Step 3: Create mdx-components registry**

```typescript
// src/components/knowledge-hub/mdx-components.tsx
import { PersonalizedSection } from "./guide/PersonalizedSection"
import { FAQ } from "./guide/FAQ"
import { ContributionCalculator } from "./calculators/ContributionCalculator"
import { TaxCalculator } from "./calculators/TaxCalculator"
import { PaymentSlipGenerator } from "./calculators/PaymentSlipGenerator"

export const mdxComponents = {
  PersonalizedSection,
  FAQ,
  ContributionCalculator,
  TaxCalculator,
  PaymentSlipGenerator,
  // Standard HTML overrides
  h1: (props: any) => <h1 className="text-3xl font-bold mb-6" {...props} />,
  h2: (props: any) => <h2 className="text-2xl font-semibold mt-8 mb-4" {...props} />,
  h3: (props: any) => <h3 className="text-xl font-medium mt-6 mb-3" {...props} />,
  table: (props: any) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full border-collapse" {...props} />
    </div>
  ),
  th: (props: any) => (
    <th className="border border-gray-300 bg-gray-50 px-4 py-2 text-left font-medium" {...props} />
  ),
  td: (props: any) => (
    <td className="border border-gray-300 px-4 py-2" {...props} />
  ),
}
```

**Step 4: Create directory structure and commit**

```bash
mkdir -p /home/admin/FiskAI/src/components/knowledge-hub/guide
mkdir -p /home/admin/FiskAI/src/components/knowledge-hub/calculators
git add src/components/knowledge-hub/
git commit -m "feat: add MDX components for knowledge hub guides"
```

---

## Batch 3: Calculator Components (Tasks 9-11)

### Task 9: ContributionCalculator Component

**Files:**

- Create: `/home/admin/FiskAI/src/components/knowledge-hub/calculators/ContributionCalculator.tsx`

**Step 1: Write component**

```typescript
// src/components/knowledge-hub/calculators/ContributionCalculator.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateContributions, formatEUR } from "@/lib/knowledge-hub/calculations"
import { PAYMENT_IBANS, PAYMENT_MODEL } from "@/lib/knowledge-hub/constants"

interface Props {
  embedded?: boolean
}

export function ContributionCalculator({ embedded = true }: Props) {
  const breakdown = calculateContributions()

  const content = (
    <div className="space-y-4">
      <div className="grid gap-3">
        <div className="flex justify-between items-center py-2 border-b">
          <div>
            <p className="font-medium">MIO I. stup (mirovinsko)</p>
            <p className="text-sm text-gray-500">15% od osnovice</p>
          </div>
          <p className="font-mono font-bold">{formatEUR(breakdown.mioI)}</p>
        </div>
        <div className="flex justify-between items-center py-2 border-b">
          <div>
            <p className="font-medium">MIO II. stup (kapitalizirano)</p>
            <p className="text-sm text-gray-500">5% od osnovice</p>
          </div>
          <p className="font-mono font-bold">{formatEUR(breakdown.mioII)}</p>
        </div>
        <div className="flex justify-between items-center py-2 border-b">
          <div>
            <p className="font-medium">HZZO (zdravstveno)</p>
            <p className="text-sm text-gray-500">16,5% od osnovice</p>
          </div>
          <p className="font-mono font-bold">{formatEUR(breakdown.hzzo)}</p>
        </div>
        <div className="flex justify-between items-center py-2 bg-gray-50 px-3 rounded-lg">
          <p className="font-bold">Ukupno mjesečno</p>
          <p className="font-mono font-bold text-lg">{formatEUR(breakdown.total)}</p>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Osnovica za izračun: {formatEUR(breakdown.base)} (minimalna osnovica 2025.)
      </p>
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalkulator doprinosa 2025.</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/knowledge-hub/calculators/ContributionCalculator.tsx
git commit -m "feat: add ContributionCalculator component"
```

---

### Task 10: TaxCalculator Component

**Files:**

- Create: `/home/admin/FiskAI/src/components/knowledge-hub/calculators/TaxCalculator.tsx`

**Step 1: Write component**

```typescript
// src/components/knowledge-hub/calculators/TaxCalculator.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getPausalTaxBracket, PAUSAL_TAX_BRACKETS } from "@/lib/knowledge-hub/constants"
import { calculatePausalAnnualCosts, formatEUR } from "@/lib/knowledge-hub/calculations"

interface Props {
  embedded?: boolean
}

export function TaxCalculator({ embedded = true }: Props) {
  const [revenue, setRevenue] = useState<number>(25000)
  const [showResults, setShowResults] = useState(false)

  const bracket = getPausalTaxBracket(revenue)
  const costs = calculatePausalAnnualCosts(revenue)

  const handleCalculate = () => {
    setShowResults(true)
  }

  const content = (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">
            Očekivani godišnji prihod (EUR)
          </label>
          <Input
            type="number"
            value={revenue}
            onChange={(e) => {
              setRevenue(Number(e.target.value))
              setShowResults(false)
            }}
            min={0}
            max={60000}
            className="font-mono"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={handleCalculate}>Izračunaj</Button>
        </div>
      </div>

      {showResults && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-3">
          <h4 className="font-semibold">Godišnji troškovi</h4>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Kvartalni porez (x4)</span>
              <span className="font-mono">{formatEUR(costs.tax)}</span>
            </div>
            <div className="flex justify-between">
              <span>Doprinosi (262,51 x 12)</span>
              <span className="font-mono">{formatEUR(costs.contributions)}</span>
            </div>
            <div className="flex justify-between">
              <span>HOK članarina (34,20 x 4)</span>
              <span className="font-mono">{formatEUR(costs.hok)}</span>
            </div>
            <div className="flex justify-between font-bold pt-2 border-t">
              <span>Ukupno godišnje</span>
              <span className="font-mono text-lg">{formatEUR(costs.total)}</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Porezni razred: {formatEUR(bracket.min)} - {formatEUR(bracket.max)}
          </p>
        </div>
      )}

      {revenue > 60000 && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded">
          ⚠️ Paušalni obrt ima limit od 60.000 EUR godišnje.
          Za veće prihode razmotrite obrt na dohodak ili d.o.o.
        </p>
      )}
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalkulator paušalnog poreza 2025.</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/knowledge-hub/calculators/TaxCalculator.tsx
git commit -m "feat: add TaxCalculator component"
```

---

### Task 11: PaymentSlipGenerator Component

**Files:**

- Create: `/home/admin/FiskAI/src/components/knowledge-hub/calculators/PaymentSlipGenerator.tsx`

**Step 1: Write component**

```typescript
// src/components/knowledge-hub/calculators/PaymentSlipGenerator.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  PAYMENT_IBANS,
  PAYMENT_MODEL,
  MONTHLY_CONTRIBUTIONS
} from "@/lib/knowledge-hub/constants"

type PaymentType = "MIO_I" | "MIO_II" | "HZZO" | "HOK"

const PAYMENT_OPTIONS: { value: PaymentType; label: string; amount: number; iban: string }[] = [
  { value: "MIO_I", label: "MIO I. stup", amount: 107.88, iban: PAYMENT_IBANS.STATE_BUDGET },
  { value: "MIO_II", label: "MIO II. stup", amount: 35.96, iban: PAYMENT_IBANS.MIO_II },
  { value: "HZZO", label: "Zdravstveno (HZZO)", amount: 118.67, iban: PAYMENT_IBANS.HZZO },
  { value: "HOK", label: "HOK članarina", amount: 34.20, iban: PAYMENT_IBANS.HOK },
]

interface Props {
  embedded?: boolean
}

export function PaymentSlipGenerator({ embedded = true }: Props) {
  const [oib, setOib] = useState("")
  const [selectedPayment, setSelectedPayment] = useState<PaymentType>("MIO_I")

  const selected = PAYMENT_OPTIONS.find((p) => p.value === selectedPayment)!

  // Generate poziv na broj (reference number) based on payment type
  const generateReference = () => {
    if (!oib || oib.length !== 11) return ""
    // Format: OIB-godina-mjesec for contributions
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    return `${oib}-${year}${month}`
  }

  const content = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Vaš OIB</label>
        <Input
          type="text"
          value={oib}
          onChange={(e) => setOib(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="12345678901"
          maxLength={11}
          className="font-mono"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Vrsta uplate</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedPayment(option.value)}
              className={`p-3 rounded-lg border text-left transition-colors ${
                selectedPayment === option.value
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <p className="font-medium">{option.label}</p>
              <p className="text-sm text-gray-500">{option.amount.toFixed(2)} EUR</p>
            </button>
          ))}
        </div>
      </div>

      {oib.length === 11 && (
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <h4 className="font-semibold">Podaci za uplatu</h4>
          <div className="grid gap-2 text-sm font-mono">
            <div>
              <span className="text-gray-500">IBAN:</span>
              <span className="ml-2">{selected.iban}</span>
            </div>
            <div>
              <span className="text-gray-500">Model:</span>
              <span className="ml-2">{PAYMENT_MODEL}</span>
            </div>
            <div>
              <span className="text-gray-500">Poziv na broj:</span>
              <span className="ml-2">{generateReference()}</span>
            </div>
            <div>
              <span className="text-gray-500">Iznos:</span>
              <span className="ml-2">{selected.amount.toFixed(2)} EUR</span>
            </div>
          </div>
          <Button className="w-full mt-3" variant="outline">
            Generiraj Hub3 barkod
          </Button>
        </div>
      )}
    </div>
  )

  if (embedded) {
    return <div className="my-6">{content}</div>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generator uplatnica</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/knowledge-hub/calculators/PaymentSlipGenerator.tsx
git commit -m "feat: add PaymentSlipGenerator component"
```

---

## Batch 4: Guide Page Route (Tasks 12-13)

### Task 12: Create Dynamic Guide Page

**Files:**

- Create: `/home/admin/FiskAI/src/app/(marketing)/vodic/[slug]/page.tsx`

**Step 1: Write page component**

```typescript
// src/app/(marketing)/vodic/[slug]/page.tsx
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { MDXRemote } from "next-mdx-remote/rsc"
import { getGuideBySlug, getGuideSlugs } from "@/lib/knowledge-hub/mdx"
import { mdxComponents } from "@/components/knowledge-hub/mdx-components"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const slugs = getGuideSlugs()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) return { title: "Vodič nije pronađen" }

  return {
    title: `${guide.frontmatter.title} | FiskAI`,
    description: guide.frontmatter.description,
    keywords: guide.frontmatter.keywords,
    openGraph: {
      title: guide.frontmatter.title,
      description: guide.frontmatter.description,
      type: "article",
    },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)

  if (!guide) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <article className="prose prose-lg max-w-none">
        <Suspense fallback={<div>Učitavanje...</div>}>
          <MDXRemote source={guide.content} components={mdxComponents} />
        </Suspense>
      </article>
    </div>
  )
}
```

**Step 2: Create directory and commit**

```bash
mkdir -p /home/admin/FiskAI/src/app/\(marketing\)/vodic/\[slug\]
git add src/app/\(marketing\)/vodic/
git commit -m "feat: add dynamic guide page route"
```

---

### Task 13: Create Guide Index Page

**Files:**

- Create: `/home/admin/FiskAI/src/app/(marketing)/vodic/page.tsx`

**Step 1: Write index page**

```typescript
// src/app/(marketing)/vodic/page.tsx
import Link from "next/link"
import { getAllGuides } from "@/lib/knowledge-hub/mdx"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Vodiči za poslovanje | FiskAI",
  description: "Kompletan vodič za sve oblike poslovanja u Hrvatskoj - paušalni obrt, obrt na dohodak, d.o.o. i više.",
}

export default function GuidesIndexPage() {
  const guides = getAllGuides()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Vodiči za poslovanje</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Sve što trebate znati o poslovanju u Hrvatskoj.
          Porezni razredi, doprinosi, registracija i obveze.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => (
          <Link key={guide.slug} href={`/vodic/${guide.slug}`}>
            <Card className="h-full hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{guide.frontmatter.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-4">
                  {guide.frontmatter.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {guide.frontmatter.requiresFiscalization && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Fiskalizacija
                    </span>
                  )}
                  {guide.frontmatter.maxRevenue && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      Max {guide.frontmatter.maxRevenue.toLocaleString()} EUR
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/\(marketing\)/vodic/page.tsx
git commit -m "feat: add guides index page"
```

---

## Batch 5: Wizard (Tasks 14-16)

### Task 14: Create Wizard State Machine

**Files:**

- Create: `/home/admin/FiskAI/src/lib/knowledge-hub/wizard-logic.ts`

**Step 1: Write wizard logic**

```typescript
// src/lib/knowledge-hub/wizard-logic.ts
import { BusinessType, WizardAnswer, WizardState } from "./types"

export interface WizardQuestion {
  id: string
  question: string
  options: { value: string; label: string; description?: string }[]
  nextQuestion: (answer: string) => string | null
}

export const WIZARD_QUESTIONS: Record<string, WizardQuestion> = {
  employment: {
    id: "employment",
    question: "Koji je vaš trenutni radni status?",
    options: [
      { value: "employed", label: "Zaposlen/a sam", description: "Radim kod drugog poslodavca" },
      {
        value: "unemployed",
        label: "Nezaposlen/a sam",
        description: "Tražim posao ili pokrećem vlastiti",
      },
      { value: "retired", label: "Umirovljenik/ca", description: "Primam mirovinu" },
    ],
    nextQuestion: () => "intent",
  },
  intent: {
    id: "intent",
    question: "Što želite postići?",
    options: [
      { value: "side", label: "Dodatni prihod", description: "Uz postojeći posao ili mirovinu" },
      {
        value: "main",
        label: "Glavni izvor prihoda",
        description: "Ovo će biti moj primarni posao",
      },
      { value: "explore", label: "Istražujem opcije", description: "Još nisam siguran/na" },
    ],
    nextQuestion: () => "revenue",
  },
  revenue: {
    id: "revenue",
    question: "Koliki prihod očekujete godišnje?",
    options: [
      { value: "low", label: "Do 12.000 EUR", description: "Manji opseg poslovanja" },
      { value: "medium", label: "12.000 - 40.000 EUR", description: "Srednji opseg" },
      { value: "high", label: "40.000 - 60.000 EUR", description: "Veći opseg, blizu PDV praga" },
      { value: "over", label: "Više od 60.000 EUR", description: "Prelazi limit za paušal" },
    ],
    nextQuestion: (answer) => (answer === "over" ? "business_form" : "cash"),
  },
  cash: {
    id: "cash",
    question: "Hoćete li primati gotovinske uplate?",
    options: [
      { value: "yes", label: "Da, primam gotovinu", description: "Od kupaca ili klijenata" },
      { value: "no", label: "Ne, samo kartice/virman", description: "Bezgotovinsko poslovanje" },
      { value: "unsure", label: "Nisam siguran/na", description: "Još ne znam" },
    ],
    nextQuestion: () => "activity",
  },
  activity: {
    id: "activity",
    question: "Koja vrsta djelatnosti vas zanima?",
    options: [
      { value: "it", label: "IT / Programiranje", description: "Softver, web, konzalting" },
      { value: "services", label: "Ostale usluge", description: "Dizajn, marketing, savjetovanje" },
      { value: "trade", label: "Trgovina", description: "Prodaja proizvoda" },
      { value: "hospitality", label: "Ugostiteljstvo", description: "Kafići, restorani" },
    ],
    nextQuestion: () => null,
  },
  business_form: {
    id: "business_form",
    question: "Koji oblik poduzeća preferirate?",
    options: [
      { value: "doo", label: "d.o.o.", description: "Ograničena odgovornost, više administracije" },
      {
        value: "obrt",
        label: "Obrt na dohodak",
        description: "Jednostavnije, ali neograničena odgovornost",
      },
    ],
    nextQuestion: () => "partners",
  },
  partners: {
    id: "partners",
    question: "Imate li poslovne partnere?",
    options: [
      { value: "solo", label: "Radim sam/a", description: "Jednočlano društvo" },
      { value: "partners", label: "Imam partnere", description: "Višečlano društvo" },
    ],
    nextQuestion: () => null,
  },
}

export function getRecommendedBusinessType(answers: WizardAnswer[]): BusinessType {
  const getAnswer = (id: string) => answers.find((a) => a.questionId === id)?.value

  const employment = getAnswer("employment")
  const revenue = getAnswer("revenue")
  const activity = getAnswer("activity")
  const businessForm = getAnswer("business_form")
  const partners = getAnswer("partners")

  // Over 60k -> d.o.o. or obrt dohodak
  if (revenue === "over") {
    if (businessForm === "doo") {
      return partners === "partners" ? "doo-viseclano" : "doo-jednoclan"
    }
    return "obrt-dohodak"
  }

  // Retiree
  if (employment === "retired") {
    return "pausalni-obrt-umirovljenik"
  }

  // Employed
  if (employment === "employed") {
    return "pausalni-obrt-uz-zaposlenje"
  }

  // IT freelancer
  if (activity === "it") {
    return "it-freelancer"
  }

  // Hospitality
  if (activity === "hospitality") {
    return "ugostiteljstvo"
  }

  // Default to basic paušalni
  return "pausalni-obrt"
}

export function buildPersonalizationParams(answers: WizardAnswer[]): URLSearchParams {
  const params = new URLSearchParams()

  const revenueMap: Record<string, string> = {
    low: "10000",
    medium: "25000",
    high: "50000",
    over: "70000",
  }

  const revenue = answers.find((a) => a.questionId === "revenue")?.value
  if (revenue && revenueMap[revenue]) {
    params.set("prihod", revenueMap[revenue])
  }

  const cash = answers.find((a) => a.questionId === "cash")?.value
  if (cash) {
    params.set("gotovina", cash === "yes" ? "da" : "ne")
  }

  const employment = answers.find((a) => a.questionId === "employment")?.value
  if (employment === "employed") {
    params.set("zaposlenje", "da")
  }

  return params
}
```

**Step 2: Commit**

```bash
git add src/lib/knowledge-hub/wizard-logic.ts
git commit -m "feat: add wizard state machine and logic"
```

---

### Task 15: Create Wizard Components

**Files:**

- Create: `/home/admin/FiskAI/src/components/knowledge-hub/wizard/WizardContainer.tsx`

**Step 1: Write WizardContainer**

```typescript
// src/components/knowledge-hub/wizard/WizardContainer.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  WIZARD_QUESTIONS,
  getRecommendedBusinessType,
  buildPersonalizationParams
} from "@/lib/knowledge-hub/wizard-logic"
import { WizardAnswer } from "@/lib/knowledge-hub/types"
import { ArrowLeft, ArrowRight } from "lucide-react"

export function WizardContainer() {
  const router = useRouter()
  const [currentQuestionId, setCurrentQuestionId] = useState("employment")
  const [answers, setAnswers] = useState<WizardAnswer[]>([])
  const [selectedValue, setSelectedValue] = useState<string | null>(null)

  const currentQuestion = WIZARD_QUESTIONS[currentQuestionId]

  const handleNext = () => {
    if (!selectedValue) return

    const newAnswers = [
      ...answers.filter((a) => a.questionId !== currentQuestionId),
      { questionId: currentQuestionId, value: selectedValue },
    ]
    setAnswers(newAnswers)

    const nextId = currentQuestion.nextQuestion(selectedValue)

    if (nextId) {
      setCurrentQuestionId(nextId)
      setSelectedValue(null)
    } else {
      // Wizard complete - navigate to recommended guide
      const businessType = getRecommendedBusinessType(newAnswers)
      const params = buildPersonalizationParams(newAnswers)
      router.push(`/vodic/${businessType}?${params.toString()}`)
    }
  }

  const handleBack = () => {
    const questionOrder = ["employment", "intent", "revenue", "cash", "activity"]
    const currentIndex = questionOrder.indexOf(currentQuestionId)
    if (currentIndex > 0) {
      setCurrentQuestionId(questionOrder[currentIndex - 1])
      const prevAnswer = answers.find((a) => a.questionId === questionOrder[currentIndex - 1])
      setSelectedValue(prevAnswer?.value || null)
    }
  }

  const progress = (answers.length / 5) * 100

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full mb-8">
        <div
          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-2xl font-bold mb-6">{currentQuestion.question}</h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedValue(option.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  selectedValue === option.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-500"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <p className="font-medium">{option.label}</p>
                {option.description && (
                  <p className="text-sm text-gray-500 mt-1">{option.description}</p>
                )}
              </button>
            ))}
          </div>

          <div className="flex justify-between mt-8">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentQuestionId === "employment"}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Natrag
            </Button>
            <Button onClick={handleNext} disabled={!selectedValue}>
              Nastavi
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 2: Create directory and commit**

```bash
mkdir -p /home/admin/FiskAI/src/components/knowledge-hub/wizard
git add src/components/knowledge-hub/wizard/
git commit -m "feat: add wizard container component"
```

---

### Task 16: Create Wizard Page

**Files:**

- Create: `/home/admin/FiskAI/src/app/(marketing)/wizard/page.tsx`

**Step 1: Write wizard page**

```typescript
// src/app/(marketing)/wizard/page.tsx
import { WizardContainer } from "@/components/knowledge-hub/wizard/WizardContainer"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Pronađite svoj poslovni oblik | FiskAI",
  description: "Interaktivni čarobnjak koji vam pomaže odabrati pravi oblik poslovanja u Hrvatskoj.",
}

export default function WizardPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Pronađite idealan oblik poslovanja
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Odgovorite na nekoliko pitanja i dobit ćete personaliziranu preporuku
          s detaljnim vodičem za vaš oblik poslovanja.
        </p>
      </div>

      <WizardContainer />
    </div>
  )
}
```

**Step 2: Create directory and commit**

```bash
mkdir -p /home/admin/FiskAI/src/app/\(marketing\)/wizard
git add src/app/\(marketing\)/wizard/
git commit -m "feat: add wizard page"
```

---

## Batch 6: Tools Pages (Tasks 17-19)

### Task 17: Create Tools Index Page

**Files:**

- Create: `/home/admin/FiskAI/src/app/(marketing)/alati/page.tsx`

**Step 1: Write tools index**

```typescript
// src/app/(marketing)/alati/page.tsx
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calculator, FileText, Scale, Calendar, CreditCard, BarChart3 } from "lucide-react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Besplatni alati za poslovanje | FiskAI",
  description: "Besplatni kalkulatori i alati za hrvatske poduzetnike - doprinosi, porezi, uplatnice i više.",
}

const tools = [
  {
    slug: "kalkulator-doprinosa",
    title: "Kalkulator doprinosa",
    description: "Izračunajte mjesečne doprinose za MIO i HZZO",
    icon: Calculator,
  },
  {
    slug: "kalkulator-poreza",
    title: "Kalkulator poreza",
    description: "Izračunajte paušalni porez na temelju prihoda",
    icon: BarChart3,
  },
  {
    slug: "pdv-prag-kalkulator",
    title: "PDV prag kalkulator",
    description: "Pratite koliko ste blizu PDV praga od 60.000 EUR",
    icon: Scale,
  },
  {
    slug: "generator-uplatnica",
    title: "Generator uplatnica",
    description: "Generirajte Hub3 barkod za uplate doprinosa",
    icon: CreditCard,
  },
  {
    slug: "usporedba-oblika",
    title: "Usporedba oblika",
    description: "Usporedite paušalni obrt, obrt na dohodak i d.o.o.",
    icon: FileText,
  },
  {
    slug: "kalendar-rokova",
    title: "Kalendar rokova",
    description: "Sve važne datume za plaćanje na jednom mjestu",
    icon: Calendar,
  },
]

export default function ToolsIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Besplatni alati</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Kalkulatori i pomoćni alati za hrvatske poduzetnike.
          Potpuno besplatno, bez registracije.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link key={tool.slug} href={`/alati/${tool.slug}`}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <tool.icon className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle>{tool.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">{tool.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Create directory and commit**

```bash
mkdir -p /home/admin/FiskAI/src/app/\(marketing\)/alati
git add src/app/\(marketing\)/alati/page.tsx
git commit -m "feat: add tools index page"
```

---

### Task 18: Create Contribution Calculator Page

**Files:**

- Create: `/home/admin/FiskAI/src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx`

**Step 1: Write calculator page**

```typescript
// src/app/(marketing)/alati/kalkulator-doprinosa/page.tsx
import { ContributionCalculator } from "@/components/knowledge-hub/calculators/ContributionCalculator"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Kalkulator doprinosa 2025 | FiskAI",
  description: "Izračunajte mjesečne doprinose za MIO I, MIO II i HZZO za paušalne obrtnike u 2025. godini.",
}

export default function ContributionCalculatorPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="mb-8">
        <Link href="/alati" className="text-blue-600 hover:underline">
          ← Natrag na alate
        </Link>
      </nav>

      <h1 className="text-3xl font-bold mb-4">Kalkulator doprinosa 2025.</h1>
      <p className="text-gray-600 mb-8">
        Mjesečni doprinosi za paušalne obrtnike. Iznosi vrijede za 2025. godinu
        i temelje se na minimalnoj osnovici od 719,20 EUR.
      </p>

      <ContributionCalculator embedded={false} />

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Povezani vodiči</h3>
        <ul className="space-y-2">
          <li>
            <Link href="/vodic/pausalni-obrt" className="text-blue-600 hover:underline">
              Paušalni obrt - kompletan vodič
            </Link>
          </li>
          <li>
            <Link href="/alati/generator-uplatnica" className="text-blue-600 hover:underline">
              Generator uplatnica za doprinose
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
```

**Step 2: Create directory and commit**

```bash
mkdir -p /home/admin/FiskAI/src/app/\(marketing\)/alati/kalkulator-doprinosa
git add src/app/\(marketing\)/alati/kalkulator-doprinosa/
git commit -m "feat: add contribution calculator standalone page"
```

---

### Task 19: Create Tax Calculator Page

**Files:**

- Create: `/home/admin/FiskAI/src/app/(marketing)/alati/kalkulator-poreza/page.tsx`

**Step 1: Write tax calculator page**

```typescript
// src/app/(marketing)/alati/kalkulator-poreza/page.tsx
import { TaxCalculator } from "@/components/knowledge-hub/calculators/TaxCalculator"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Kalkulator paušalnog poreza 2025 | FiskAI",
  description: "Izračunajte kvartalni i godišnji paušalni porez na temelju očekivanog prihoda. Svi porezni razredi za 2025.",
}

export default function TaxCalculatorPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="mb-8">
        <Link href="/alati" className="text-blue-600 hover:underline">
          ← Natrag na alate
        </Link>
      </nav>

      <h1 className="text-3xl font-bold mb-4">Kalkulator paušalnog poreza 2025.</h1>
      <p className="text-gray-600 mb-8">
        Unesite očekivani godišnji prihod i izračunajte ukupne godišnje troškove
        uključujući porez, doprinose i HOK članarinu.
      </p>

      <TaxCalculator embedded={false} />

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">Povezani vodiči</h3>
        <ul className="space-y-2">
          <li>
            <Link href="/vodic/pausalni-obrt" className="text-blue-600 hover:underline">
              Paušalni obrt - kompletan vodič
            </Link>
          </li>
          <li>
            <Link href="/alati/usporedba-oblika" className="text-blue-600 hover:underline">
              Usporedba oblika poslovanja
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
```

**Step 2: Create directory and commit**

```bash
mkdir -p /home/admin/FiskAI/src/app/\(marketing\)/alati/kalkulator-poreza
git add src/app/\(marketing\)/alati/kalkulator-poreza/
git commit -m "feat: add tax calculator standalone page"
```

---

## Batch 7: Final Integration (Tasks 20-21)

### Task 20: Update Test Script

**Files:**

- Modify: `/home/admin/FiskAI/package.json`

**Step 1: Update test script to include knowledge-hub tests**

Add to the test script in package.json:

```json
"test:knowledge-hub": "node --import tsx --test src/lib/knowledge-hub/__tests__/*.test.ts"
```

**Step 2: Run all knowledge-hub tests**

Run: `npm run test:knowledge-hub`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add knowledge-hub test script"
```

---

### Task 21: Build Verification

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 2: Final commit**

```bash
git add -A
git commit -m "feat: complete knowledge hub foundation"
```

---

## Summary

This plan covers the foundational implementation:

- **Batch 1**: Constants, calculations, types, Hub3 generator
- **Batch 2**: MDX infrastructure and first guide
- **Batch 3**: Calculator components
- **Batch 4**: Dynamic guide page routing
- **Batch 5**: Wizard flow
- **Batch 6**: Standalone tool pages
- **Batch 7**: Integration and verification

**Remaining work (future batches):**

- 19 additional MDX guide files
- Homepage redesign with wizard CTA
- Remaining 4 tool pages (PDV prag, uplatnice, usporedba, kalendar)
- SEO structured data
- Mobile optimization
