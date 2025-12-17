# Fiscal Data Validator - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the fiscal data validator system by committing existing work, adding tests, migrating hardcoded values, and verifying end-to-end functionality.

**Architecture:** Central TypeScript config files store all fiscal values. Calculators/components import from `@/lib/fiscal-data`. Weekly GitHub Actions cron uses Ollama to scrape official sources and creates PRs when values change.

**Tech Stack:** TypeScript, Next.js, Ollama API, GitHub Actions, Vitest for testing

---

## Phase 1: Commit & Verify Existing Work

### Task 1.1: Commit Fiscal Data Library

**Files:**

- Stage: `src/lib/fiscal-data/**/*.ts`
- Stage: `.github/workflows/fiscal-validator.yml`
- Stage: `docs/plans/2025-12-17-fiscal-data-monitoring-design.md`

**Step 1: Review what will be committed**

Run: `git status`
Expected: Untracked files in `src/lib/fiscal-data/`, `.github/workflows/`, `docs/plans/`

**Step 2: Stage all fiscal-data files**

```bash
git add src/lib/fiscal-data/ .github/workflows/fiscal-validator.yml docs/plans/2025-12-17-fiscal-data-monitoring-design.md
```

**Step 3: Commit with descriptive message**

```bash
git commit -m "feat(fiscal-data): add central fiscal data library with AI validator

- Add fiscal-data library with type-safe constants
- Include contributions, tax-rates, thresholds, deadlines, payment-details, chamber-fees
- Add utility functions (getValueByPath, formatCurrency, getEffectiveValue)
- Add Ollama-based validator that scrapes official Croatian government sources
- Add GitHub Actions workflow for weekly validation (creates PRs on changes)
- Add design document explaining the system architecture"
```

**Step 4: Push to origin**

```bash
git push origin main
```

---

### Task 1.2: Verify TypeScript Compilation

**Files:**

- Check: `src/lib/fiscal-data/index.ts`

**Step 1: Run TypeScript compiler check**

Run: `npx tsc --noEmit`
Expected: No errors related to fiscal-data files

**Step 2: Verify imports work**

Create temporary test file to verify exports:

```bash
echo "import { CONTRIBUTIONS, TAX_RATES, THRESHOLDS } from '@/lib/fiscal-data'" | npx tsx --eval -
```

Expected: No import errors

---

## Phase 2: Add Unit Tests

### Task 2.1: Create Test File for Utility Functions

**Files:**

- Create: `src/lib/fiscal-data/__tests__/utils.test.ts`
- Test: `src/lib/fiscal-data/utils/get-value.ts`
- Test: `src/lib/fiscal-data/utils/format.ts`

**Step 1: Write failing tests for getValueByPath**

```typescript
// src/lib/fiscal-data/__tests__/utils.test.ts
import { describe, it, expect } from "vitest"
import { getValueByPath } from "../utils/get-value"
import { formatCurrency, formatPercentage } from "../utils/format"

describe("getValueByPath", () => {
  it("returns contribution rate for valid path", () => {
    const result = getValueByPath("CONTRIBUTIONS.rates.MIO_I.rate")
    expect(result).toBe(0.15)
  })

  it("returns threshold value for valid path", () => {
    const result = getValueByPath("THRESHOLDS.pdv.value")
    expect(result).toBe(60000)
  })

  it("returns undefined for invalid path", () => {
    const result = getValueByPath("INVALID.path.here")
    expect(result).toBeUndefined()
  })

  it("returns nested object when path points to object", () => {
    const result = getValueByPath("CONTRIBUTIONS.rates.MIO_I")
    expect(result).toHaveProperty("rate", 0.15)
    expect(result).toHaveProperty("name", "MIO I. stup")
  })
})

describe("formatCurrency", () => {
  it("formats EUR amounts with Croatian locale", () => {
    const result = formatCurrency(60000)
    expect(result).toMatch(/60\.000/)
    expect(result).toContain("EUR")
  })

  it("handles decimal amounts", () => {
    const result = formatCurrency(719.2)
    expect(result).toMatch(/719,20/)
  })
})

describe("formatPercentage", () => {
  it("formats decimal as percentage", () => {
    const result = formatPercentage(0.15)
    expect(result).toBe("15%")
  })

  it("formats percentage with decimals", () => {
    const result = formatPercentage(0.165)
    expect(result).toBe("16,5%")
  })
})
```

**Step 2: Run tests to verify they fail initially**

Run: `npm run test -- src/lib/fiscal-data/__tests__/utils.test.ts`
Expected: Tests should PASS (implementation already exists)

**Step 3: Commit tests**

```bash
git add src/lib/fiscal-data/__tests__/utils.test.ts
git commit -m "test(fiscal-data): add unit tests for utility functions"
```

---

### Task 2.2: Create Test File for Data Integrity

**Files:**

- Create: `src/lib/fiscal-data/__tests__/data-integrity.test.ts`

**Step 1: Write tests to verify data structure integrity**

```typescript
// src/lib/fiscal-data/__tests__/data-integrity.test.ts
import { describe, it, expect } from "vitest"
import {
  CONTRIBUTIONS,
  TAX_RATES,
  THRESHOLDS,
  DEADLINES,
  PAYMENT_DETAILS,
  CHAMBER_FEES,
} from "../index"

describe("CONTRIBUTIONS data integrity", () => {
  it("has valid year", () => {
    expect(CONTRIBUTIONS.year).toBeGreaterThanOrEqual(2024)
  })

  it("has lastVerified date in ISO format", () => {
    expect(CONTRIBUTIONS.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("has all required contribution rates", () => {
    expect(CONTRIBUTIONS.rates.MIO_I.rate).toBe(0.15)
    expect(CONTRIBUTIONS.rates.MIO_II.rate).toBe(0.05)
    expect(CONTRIBUTIONS.rates.HZZO.rate).toBe(0.165)
  })

  it("has valid IBANs (HR format, 21 chars)", () => {
    expect(CONTRIBUTIONS.rates.MIO_I.iban).toMatch(/^HR\d{19}$/)
    expect(CONTRIBUTIONS.rates.MIO_II.iban).toMatch(/^HR\d{19}$/)
    expect(CONTRIBUTIONS.rates.HZZO.iban).toMatch(/^HR\d{19}$/)
  })

  it("monthly contributions sum correctly", () => {
    const sum =
      CONTRIBUTIONS.monthly.mioI + CONTRIBUTIONS.monthly.mioII + CONTRIBUTIONS.monthly.hzzo
    expect(sum).toBeCloseTo(CONTRIBUTIONS.monthly.total, 2)
  })
})

describe("TAX_RATES data integrity", () => {
  it("has income tax brackets in ascending order", () => {
    const brackets = TAX_RATES.income.brackets
    for (let i = 1; i < brackets.length; i++) {
      expect(brackets[i].threshold).toBeGreaterThan(brackets[i - 1].threshold)
    }
  })

  it("has valid personal allowance", () => {
    expect(TAX_RATES.income.personalAllowance).toBeGreaterThan(0)
  })

  it("has corporate tax rates", () => {
    expect(TAX_RATES.corporate.small.rate).toBe(0.1)
    expect(TAX_RATES.corporate.large.rate).toBe(0.18)
  })
})

describe("THRESHOLDS data integrity", () => {
  it("has PDV threshold", () => {
    expect(THRESHOLDS.pdv.value).toBeGreaterThan(0)
    expect(THRESHOLDS.pdv.unit).toBe("EUR")
  })

  it("has paušalni limit", () => {
    expect(THRESHOLDS.pausalni.value).toBeGreaterThan(0)
  })
})

describe("CHAMBER_FEES data integrity", () => {
  it("has HOK monthly fee", () => {
    expect(CHAMBER_FEES.hok.monthly).toBeGreaterThan(0)
  })

  it("quarterly is 3x monthly", () => {
    expect(CHAMBER_FEES.hok.quarterly).toBeCloseTo(CHAMBER_FEES.hok.monthly * 3, 2)
  })

  it("annual is 12x monthly", () => {
    expect(CHAMBER_FEES.hok.annual).toBeCloseTo(CHAMBER_FEES.hok.monthly * 12, 2)
  })
})
```

**Step 2: Run tests**

Run: `npm run test -- src/lib/fiscal-data/__tests__/data-integrity.test.ts`
Expected: All tests PASS

**Step 3: Commit tests**

```bash
git add src/lib/fiscal-data/__tests__/data-integrity.test.ts
git commit -m "test(fiscal-data): add data integrity tests"
```

---

## Phase 3: Migrate Hardcoded Values

### Task 3.1: Find All Hardcoded Contribution Rates

**Files:**

- Search: `src/**/*.{ts,tsx}` (excluding `fiscal-data/`)
- Search: `content/**/*.mdx`

**Step 1: Search for MIO rate hardcoding**

Run: `grep -rn "0\.15\|15%" src/ --include="*.ts" --include="*.tsx" | grep -v fiscal-data | grep -v node_modules`
Expected: List of files with hardcoded 15% (MIO I rate)

Run: `grep -rn "0\.05\|5%" src/ --include="*.ts" --include="*.tsx" | grep -v fiscal-data | grep -v node_modules`
Expected: List of files with hardcoded 5% (MIO II rate)

Run: `grep -rn "0\.165\|16\.5\|16,5" src/ --include="*.ts" --include="*.tsx" | grep -v fiscal-data | grep -v node_modules`
Expected: List of files with hardcoded 16.5% (HZZO rate)

**Step 2: Document all findings**

Create a list of files that need migration, noting:

- File path
- Line number
- Current hardcoded value
- What it should import from fiscal-data

---

### Task 3.2: Migrate Knowledge-Hub Constants

**Files:**

- Modify: `src/lib/knowledge-hub/constants.ts`

**Step 1: Read current constants file**

Run: `cat src/lib/knowledge-hub/constants.ts`
Expected: See hardcoded values for contributions, payment IBANs, etc.

**Step 2: Replace with imports from fiscal-data**

```typescript
// src/lib/knowledge-hub/constants.ts
// Replace hardcoded values with imports from fiscal-data

import { CONTRIBUTIONS, PAYMENT_DETAILS, CHAMBER_FEES } from "@/lib/fiscal-data"

// Re-export for backward compatibility during migration
export const MONTHLY_CONTRIBUTIONS = {
  MIO_I: { amount: CONTRIBUTIONS.monthly.mioI, label: "MIO I. stup" },
  MIO_II: { amount: CONTRIBUTIONS.monthly.mioII, label: "MIO II. stup" },
  HZZO: { amount: CONTRIBUTIONS.monthly.hzzo, label: "Zdravstveno" },
  HOK: { amount: CHAMBER_FEES.hok.quarterly, label: "HOK članarina" },
}

export const PAYMENT_IBANS = {
  STATE_BUDGET: CONTRIBUTIONS.rates.MIO_I.iban,
  MIO_II: CONTRIBUTIONS.rates.MIO_II.iban,
  HZZO: CONTRIBUTIONS.rates.HZZO.iban,
  HOK: PAYMENT_DETAILS.accounts.hok.iban,
}

export const PAYMENT_MODEL = PAYMENT_DETAILS.model
```

**Step 3: Run build to verify no breakage**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit migration**

```bash
git add src/lib/knowledge-hub/constants.ts
git commit -m "refactor(knowledge-hub): use fiscal-data for constants"
```

---

### Task 3.3: Migrate TaxCalculator Component

**Files:**

- Modify: `src/components/knowledge-hub/calculators/TaxCalculator.tsx`

**Step 1: Read current implementation**

Identify hardcoded values:

- Tax brackets (20%, 30%)
- Personal allowance (560)
- Prirez percentages

**Step 2: Add imports and replace hardcoded values**

```typescript
// At top of file, add:
import { TAX_RATES } from "@/lib/fiscal-data"

// Replace hardcoded brackets with:
const brackets = TAX_RATES.income.brackets
const personalAllowance = TAX_RATES.income.personalAllowance
```

**Step 3: Run build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/knowledge-hub/calculators/TaxCalculator.tsx
git commit -m "refactor(TaxCalculator): use fiscal-data for tax rates"
```

---

### Task 3.4: Migrate ContributionCalculator Component

**Files:**

- Modify: `src/components/knowledge-hub/calculators/ContributionCalculator.tsx`

**Step 1: Read current implementation**

Identify hardcoded values:

- Contribution rates (15%, 5%, 16.5%)
- Base amounts (719.20)
- Monthly totals

**Step 2: Add imports and replace hardcoded values**

```typescript
// At top of file, add:
import { CONTRIBUTIONS } from "@/lib/fiscal-data"

// Replace hardcoded rates with:
const mioIRate = CONTRIBUTIONS.rates.MIO_I.rate
const mioIIRate = CONTRIBUTIONS.rates.MIO_II.rate
const hzzoRate = CONTRIBUTIONS.rates.HZZO.rate
const minBase = CONTRIBUTIONS.base.minimum
```

**Step 3: Run build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/knowledge-hub/calculators/ContributionCalculator.tsx
git commit -m "refactor(ContributionCalculator): use fiscal-data for rates"
```

---

### Task 3.5: Migrate PDVThresholdCalculator Component

**Files:**

- Modify: `src/components/knowledge-hub/calculators/PDVThresholdCalculator.tsx`

**Step 1: Read current implementation**

Identify hardcoded values:

- PDV threshold (60000)

**Step 2: Add imports and replace hardcoded values**

```typescript
// At top of file, add:
import { THRESHOLDS } from "@/lib/fiscal-data"

// Replace hardcoded threshold with:
const pdvThreshold = THRESHOLDS.pdv.value
```

**Step 3: Run build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/knowledge-hub/calculators/PDVThresholdCalculator.tsx
git commit -m "refactor(PDVThresholdCalculator): use fiscal-data for threshold"
```

---

### Task 3.6: Migrate Comparison Components

**Files:**

- Modify: `src/components/knowledge-hub/comparison/ComparisonCalculator.tsx`

**Step 1: Read current implementation**

Identify hardcoded values:

- Tax rates for different business types
- Contribution rates
- Thresholds

**Step 2: Add imports and replace hardcoded values**

```typescript
// At top of file, add:
import { CONTRIBUTIONS, TAX_RATES, THRESHOLDS } from "@/lib/fiscal-data"
```

**Step 3: Run build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/components/knowledge-hub/comparison/ComparisonCalculator.tsx
git commit -m "refactor(ComparisonCalculator): use fiscal-data for rates"
```

---

## Phase 4: Verify Validator Works

### Task 4.1: Test Validator Locally (Dry Run)

**Files:**

- Run: `src/lib/fiscal-data/validator/run.ts`

**Step 1: Ensure Ollama is running**

Run: `curl http://localhost:11434/api/tags`
Expected: JSON response with available models

**Step 2: Run validator in dry-run mode**

Run: `DRY_RUN=true npx tsx src/lib/fiscal-data/validator/run.ts`
Expected:

- Fetches from official sources
- Extracts values using Ollama
- Compares with current values
- Reports matches/mismatches without creating PR

**Step 3: Review output**

Check for:

- ✅ Matches (values are correct)
- ⚠️ Mismatches (values need updating)
- ❌ Errors (sources unreachable or parsing failed)

---

### Task 4.2: Fix Any Validator Issues

**Files:**

- May modify: `src/lib/fiscal-data/validator/*.ts`

Based on Task 4.1 output, fix any issues:

- Adjust prompts if Ollama extraction is inaccurate
- Update source URLs if they've changed
- Improve HTML-to-text conversion if needed

---

## Phase 5: Final Verification

### Task 5.1: Run Full Test Suite

**Step 1: Run all tests**

Run: `npm run test`
Expected: All tests pass

**Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Run linter**

Run: `npm run lint`
Expected: No errors

---

### Task 5.2: Create Summary Commit

**Step 1: Check status**

Run: `git status`
Expected: All changes committed

**Step 2: Push all commits**

Run: `git push origin main`
Expected: All commits pushed successfully

---

## Success Criteria Checklist

- [ ] Fiscal data library committed and pushed
- [ ] Unit tests for utilities pass
- [ ] Data integrity tests pass
- [ ] knowledge-hub/constants.ts uses fiscal-data imports
- [ ] TaxCalculator uses fiscal-data
- [ ] ContributionCalculator uses fiscal-data
- [ ] PDVThresholdCalculator uses fiscal-data
- [ ] ComparisonCalculator uses fiscal-data
- [ ] Validator runs successfully in dry-run mode
- [ ] Build passes with no errors
- [ ] All tests pass
