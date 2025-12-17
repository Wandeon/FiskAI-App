# Fiscal Data Monitoring System - Design Document

**Date:** 2025-12-17
**Status:** Approved
**Author:** Claude + Human collaboration

## Problem Statement

Fiscal values (tax rates, contribution percentages, thresholds) are scattered across 60+ files in the codebase. This leads to:

- Inconsistent values across different pages/calculators
- Difficulty updating when official values change
- No way to know when official sources publish new values
- Risk of displaying incorrect information to users

## Solution: Hybrid Config + AI Monitoring

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FISCAL DATA SYSTEM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐      ┌──────────────────┐      ┌───────────────┐  │
│  │  fiscal-data/    │      │   Components &   │      │   MDX Content │  │
│  │  constants.ts    │─────▶│   Calculators    │      │   (Generated) │  │
│  │  (Single Source) │      └──────────────────┘      └───────────────┘  │
│  └────────┬─────────┘                                        ▲          │
│           │                                                  │          │
│           │         ┌────────────────────────────────────────┘          │
│           │         │                                                   │
│           ▼         │                                                   │
│  ┌──────────────────┴───┐                                               │
│  │  generated/          │                                               │
│  │  fiscal-snapshot.json │  (For MDX/content to import)                 │
│  └──────────────────────┘                                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                       WEEKLY VALIDATION CRON                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌──────────┐  │
│  │  Official   │    │   Ollama    │    │  Compare    │    │  Create  │  │
│  │  Sources    │───▶│   API       │───▶│  Values     │───▶│  GitHub  │  │
│  │  (Web)      │    │  (Extract)  │    │  (Diff)     │    │  PR      │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────────┘  │
│                                                                          │
│  Sources: porezna-uprava.gov.hr, hzzo.hr, regos.hr, hok.hr, nn.hr       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Categories

All fiscal values organized by category:

### 1. Tax & Contribution Rates

- MIO I (15%), MIO II (5%), HZZO (16.5%)
- Income tax brackets (20%/30% base, ~23.6%/35.4% with prirez)
- Corporate tax (10%/18%)
- Paušalni tax rate (12%)

### 2. Thresholds & Limits

- PDV threshold (60,000 EUR as of 2025)
- Paušalni max revenue
- Cash B2B limit (700 EUR)

### 3. Payment Details

- IBANs for tax payments
- Payment models (HR68)
- Poziv na broj formats

### 4. Deadlines

- Monthly contribution deadlines
- Quarterly tax deadlines
- Annual filing deadlines

### 5. Base Amounts

- Minimalna osnovica (719.20 EUR)
- Osobni odbitak
- HOK membership fees

## Official Sources to Monitor

### Primary (Government/Tax Authority)

- **Porezna uprava** (porezna-uprava.gov.hr) - tax rates, deadlines, forms
- **Narodne novine** (nn.hr) - official gazette with law changes
- **FINA** (fina.hr) - payment info, IBANs

### Social Insurance

- **HZZO** (hzzo.hr) - health insurance rates
- **REGOS** (regos.hr) - pension fund info

### Business Registries

- **HOK** (hok.hr) - craft chamber fees
- **HGK** (hgk.hr) - business chamber info

## Data Structure

### Central Config Files

```typescript
// src/lib/fiscal-data/data/contributions.ts

export const CONTRIBUTIONS = {
  year: 2025,
  lastVerified: "2025-01-15",
  source: "https://www.hzzo.hr/...",

  rates: {
    MIO_I: { rate: 0.15, name: "MIO I. stup", iban: "HR12..." },
    MIO_II: { rate: 0.05, name: "MIO II. stup", iban: "HR87..." },
    HZZO: { rate: 0.165, name: "Zdravstveno", iban: "HR65..." },
  },

  base: {
    minimum: 719.2, // EUR - minimalna osnovica
    maximum: 9360.0, // EUR - maksimalna osnovica
  },

  monthly: {
    mioI: 107.88,
    mioII: 35.96,
    hzzo: 118.67,
    total: 262.51,
  },
} as const
```

```typescript
// src/lib/fiscal-data/data/thresholds.ts

export const THRESHOLDS = {
  year: 2025,
  lastVerified: "2025-01-15",

  pdv: {
    value: 60000,
    unit: "EUR",
    description: "Prag za ulazak u sustav PDV-a",
    source: "https://porezna-uprava.gov.hr/...",
    effectiveFrom: "2025-01-01",
  },

  pausalni: {
    maxRevenue: 60000,
    unit: "EUR",
    description: "Maksimalni godišnji prihod za paušalni obrt",
    source: "https://porezna-uprava.gov.hr/...",
  },

  cashB2B: {
    value: 700,
    unit: "EUR",
    description: "Limit za gotovinska plaćanja između poslovnih subjekata",
  },
} as const
```

## Validation System

### Source Configuration

```typescript
// src/lib/fiscal-data/validator/sources.ts

export const VALIDATION_SOURCES = {
  contributions: [
    {
      id: "hzzo-doprinosi",
      url: "https://www.hzzo.hr/obveznici-placanja-doprinosa/",
      dataPoints: ["CONTRIBUTIONS.rates.HZZO.rate", "CONTRIBUTIONS.base.minimum"],
      priority: 1,
    },
  ],
  thresholds: [
    {
      id: "porezna-pdv-prag",
      url: "https://www.porezna-uprava.hr/HR_porezni_sustav/Stranice/porez_na_dodanu_vrijednost.aspx",
      dataPoints: ["THRESHOLDS.pdv.value"],
      priority: 1,
    },
  ],
}
```

### Validation Logic (Using Ollama)

```typescript
// src/lib/fiscal-data/validator/validate.ts

export async function validateFiscalData(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  for (const [category, sources] of Object.entries(VALIDATION_SOURCES)) {
    for (const source of sources) {
      // 1. Fetch page content
      const html = await fetchPage(source.url)
      const text = extractText(html)

      // 2. Ask Ollama to extract values
      const extracted = await ollama.chat({
        model: "llama3.1",
        messages: [
          {
            role: "user",
            content: `Extract fiscal/tax values from this Croatian government page...`,
          },
        ],
      })

      // 3. Compare with current values
      const comparison = compareValues(extracted, getCurrentValues(source.dataPoints))
      results.push(...comparison)
    }
  }

  return results
}
```

### GitHub PR Creation

When changes are detected with confidence > 85%, create a PR with:

- Table of changes (current vs new values)
- Source URLs
- Extracted text snippets
- Confidence scores
- Effective dates if applicable

## Weekly Cron Job

```yaml
# .github/workflows/fiscal-validator.yml

name: Fiscal Data Validator

on:
  schedule:
    - cron: "0 6 * * 1" # Every Monday at 6:00 AM UTC
  workflow_dispatch: # Manual trigger

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
      - name: Run Fiscal Validator
        env:
          OLLAMA_API_URL: ${{ secrets.OLLAMA_API_URL }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx tsx src/lib/fiscal-data/validator/run.ts
```

## Component Integration

### TypeScript Components

```typescript
// BEFORE (hardcoded):
const MIO_I_RATE = 0.15

// AFTER (from central source):
import { CONTRIBUTIONS } from "@/lib/fiscal-data"
const mioI = revenue * CONTRIBUTIONS.rates.MIO_I.rate
```

### MDX Content

```tsx
// Component for dynamic values in MDX
export function FiscalValue({ path }: { path: string }) {
  const value = getValueByPath(path)
  return <span className="font-mono text-cyan-400">{formatValue(value)}</span>
}

// Usage in MDX:
// Prag za PDV iznosi <FiscalValue path="THRESHOLDS.pdv.value" /> EUR.
```

## File Structure

```
src/lib/fiscal-data/
├── index.ts                    # Main export barrel
├── types.ts                    # TypeScript interfaces
│
├── data/
│   ├── contributions.ts        # MIO, HZZO rates & IBANs
│   ├── tax-rates.ts           # Income tax, corporate tax, paušalni
│   ├── thresholds.ts          # PDV, paušalni limits, cash limits
│   ├── deadlines.ts           # Payment & filing deadlines
│   ├── payment-details.ts     # IBANs, models, poziv na broj
│   ├── hok.ts                 # Chamber fees
│   └── tz.ts                  # Tourist board rates
│
├── validator/
│   ├── sources.ts             # URLs to monitor
│   ├── validate.ts            # Ollama extraction logic
│   ├── compare.ts             # Diff current vs found values
│   ├── create-pr.ts           # GitHub PR creation
│   └── run.ts                 # Entry point for cron
│
├── utils/
│   ├── get-value.ts           # getValueByPath("THRESHOLDS.pdv.value")
│   ├── format.ts              # Currency, percentage formatting
│   └── effective-date.ts      # Handle values with future effective dates
│
└── generated/
    └── fiscal-snapshot.json    # For non-TS consumers

.github/workflows/
└── fiscal-validator.yml        # Weekly cron job

src/components/fiscal/
├── FiscalValue.tsx            # <FiscalValue path="..." /> for MDX
├── FiscalTable.tsx            # Auto-generated tables from data
└── LastVerified.tsx           # "Data verified: 15.01.2025" badge
```

## Safety Features

### Effective Date Handling

```typescript
export function getEffectiveValue<T>(
  current: { value: T; effectiveUntil?: string },
  upcoming?: { value: T; effectiveFrom: string }
): T {
  const now = new Date()
  const effectiveDate = new Date(upcoming.effectiveFrom)
  return now >= effectiveDate ? upcoming.value : current.value
}
```

### Confidence Thresholds

```typescript
const CONFIDENCE_THRESHOLDS = {
  autoIncludeInPR: 0.85, // Include in PR automatically
  flagForReview: 0.6, // Include but mark as "needs verification"
  ignore: 0.6, // Below this = don't include
}
```

### Multi-Source Validation

If 2+ sources agree on a value, confidence is higher.

## Migration Strategy

1. **Phase 1:** Create central config with all current values
2. **Phase 2:** Add migration script to find/replace hardcoded values
3. **Phase 3:** Update components to import from central source
4. **Phase 4:** Add FiscalValue component for MDX content
5. **Phase 5:** Set up validator and GitHub Actions

## Success Criteria

- [ ] Single source of truth for all fiscal values
- [ ] All calculators use central config
- [ ] MDX content uses FiscalValue component
- [ ] Weekly validator runs successfully
- [ ] PRs created when values change
- [ ] No hardcoded fiscal values in codebase
