# Citation Compliance Gaps

Tracking questions that fail citation compliance tests. Target: 100% (currently ~93% with test fixtures, ~66% without seed data).

## Why This Matters

These aren't "acceptable noise" - they're regression targets. Each gap represents a user question that won't get a source-backed answer.

## Current Gaps

### Missing Seed Data (needs rules created)

| Question                                        | Expected Pattern | Status  | Notes                            |
| ----------------------------------------------- | ---------------- | ------- | -------------------------------- |
| "Kolika je stopa doprinosa za HZZO?"            | `hzzo`           | MISSING | Need HZZO contribution rate rule |
| "Kada sam obvezan voditi dvojno knjigovodstvo?" | `knjig`          | MISSING | Need accounting threshold rule   |
| "Koji su limiti za jednostavno knjigovodstvo?"  | `knjig`          | MISSING | Need simple bookkeeping limits   |
| "Koji su rokovi za predaju GFI-POD?"            | `gfi`            | MISSING | Need GFI-POD deadline rule       |
| "Do kada trebam predati godišnje izvješće?"     | `izvjes`         | MISSING | Need annual report deadline      |
| "Koje su obveze malog poduzetnika?"             | `poduzetn`       | MISSING | Need small business obligations  |
| "Kakva su pravila za obrtnike?"                 | `obrt`           | MISSING | Need sole proprietor rules       |

### Keyword Matching Issues

| Question                     | Expected Pattern | Status | Notes                                                                               |
| ---------------------------- | ---------------- | ------ | ----------------------------------------------------------------------------------- |
| "Koliki je porez na profit?" | `dobit`          | WEAK   | Query says "profit" but rules use "dobit" - need synonym expansion or titleHr match |

## Fix Priority

1. **High**: Add seed rules for common questions (HZZO, GFI-POD, bookkeeping thresholds)
2. **Medium**: Improve keyword extraction with domain synonyms (profit→dobit, plaća→minimalna)
3. **Low**: Add titleEn matching for bilingual queries

## How to Add Missing Rules

```typescript
// Example: Add HZZO contribution rate
await db.regulatoryRule.create({
  data: {
    conceptSlug: "doprinosi-hzzo",
    titleHr: "Doprinos za HZZO",
    value: "16.5",
    valueType: "percentage",
    // ... with sourcePointer
  },
})
```

## Tracking

- Created: 2025-12-23
- Last reviewed: 2025-12-23
- Target: 0 gaps (100% compliance)
