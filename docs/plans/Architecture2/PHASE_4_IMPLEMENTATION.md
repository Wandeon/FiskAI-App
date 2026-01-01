# Phase 4: Banking & Reconciliation - Implementation Plan

**Status:** READY FOR EXECUTION (after Phase 3)
**Depends On:** Phase 3 Completion (Money value objects fully integrated)
**Duration Estimate:** 3-4 focused sessions
**Goal:** Ensure external money flows cannot corrupt state

---

## 0. Phase 4 Objectives

1. Move bank import parsing logic to use Money value objects
2. Create banking domain entities (BankTransaction, BankAccount)
3. Enforce Money usage in reconciliation matching
4. Add idempotency for bank imports (prevent duplicates)
5. Create deterministic reconciliation rules

---

## 1. Current Banking Code Locations

Based on codebase exploration:

| Current Location                            | Lines | Violations   | Target                         |
| ------------------------------------------- | ----- | ------------ | ------------------------------ |
| `src/lib/banking/import/processor.ts`       | 300+  | 13 float ops | Split: domain + infrastructure |
| `src/lib/banking/csv-parser.ts`             | ~200  | 5 float ops  | `src/infrastructure/banking/`  |
| `src/lib/banking/reconciliation.ts`         | 380   | 4 float ops  | `src/domain/banking/`          |
| `src/lib/banking/reconciliation-service.ts` | 160   | 2 float ops  | `src/application/banking/`     |
| `src/lib/bank-sync/dedup.ts`                | 225   | 5 decimal    | Keep - already uses Decimal    |

---

## 2. Create Banking Domain

### 2.1 Create `src/domain/banking/BankTransaction.ts`

```typescript
// src/domain/banking/BankTransaction.ts
import { Money } from "@/domain/shared"

export enum TransactionDirection {
  CREDIT = "CREDIT", // Money in
  DEBIT = "DEBIT", // Money out
}

export enum MatchStatus {
  UNMATCHED = "UNMATCHED",
  AUTO_MATCHED = "AUTO_MATCHED",
  MANUAL_MATCHED = "MANUAL_MATCHED",
  IGNORED = "IGNORED",
}

export interface BankTransactionProps {
  id: string
  externalId: string // Bank's transaction ID
  bankAccountId: string
  date: Date
  amount: Money
  direction: TransactionDirection
  balance: Money
  counterpartyName?: string
  counterpartyIban?: string
  reference?: string
  description?: string
  matchStatus: MatchStatus
  matchedInvoiceId?: string
  matchedExpenseId?: string
  version: number
}

export class BankTransaction {
  private props: BankTransactionProps

  private constructor(props: BankTransactionProps) {
    this.props = props
  }

  static create(
    params: Omit<BankTransactionProps, "id" | "matchStatus" | "version">
  ): BankTransaction {
    return new BankTransaction({
      ...params,
      id: crypto.randomUUID(),
      matchStatus: MatchStatus.UNMATCHED,
      version: 1,
    })
  }

  static reconstitute(props: BankTransactionProps): BankTransaction {
    return new BankTransaction(props)
  }

  // Getters
  get id(): string {
    return this.props.id
  }
  get externalId(): string {
    return this.props.externalId
  }
  get amount(): Money {
    return this.props.amount
  }
  get direction(): TransactionDirection {
    return this.props.direction
  }
  get date(): Date {
    return this.props.date
  }
  get reference(): string | undefined {
    return this.props.reference
  }
  get matchStatus(): MatchStatus {
    return this.props.matchStatus
  }

  /**
   * Signed amount (positive for credits, negative for debits)
   */
  signedAmount(): Money {
    return this.props.direction === TransactionDirection.DEBIT
      ? this.props.amount.multiply(-1)
      : this.props.amount
  }

  // Business methods
  matchToInvoice(invoiceId: string, autoMatched: boolean): void {
    if (this.props.matchStatus !== MatchStatus.UNMATCHED) {
      throw new BankingError("Transaction already matched")
    }
    this.props.matchedInvoiceId = invoiceId
    this.props.matchStatus = autoMatched ? MatchStatus.AUTO_MATCHED : MatchStatus.MANUAL_MATCHED
    this.props.version++
  }

  matchToExpense(expenseId: string, autoMatched: boolean): void {
    if (this.props.matchStatus !== MatchStatus.UNMATCHED) {
      throw new BankingError("Transaction already matched")
    }
    this.props.matchedExpenseId = expenseId
    this.props.matchStatus = autoMatched ? MatchStatus.AUTO_MATCHED : MatchStatus.MANUAL_MATCHED
    this.props.version++
  }

  unmatch(): void {
    if (this.props.matchStatus === MatchStatus.UNMATCHED) {
      return // Idempotent
    }
    this.props.matchedInvoiceId = undefined
    this.props.matchedExpenseId = undefined
    this.props.matchStatus = MatchStatus.UNMATCHED
    this.props.version++
  }

  ignore(): void {
    this.props.matchStatus = MatchStatus.IGNORED
    this.props.version++
  }
}

export class BankingError extends Error {
  readonly code = "BANKING_ERROR"
  constructor(message: string) {
    super(message)
    this.name = "BankingError"
  }
}
```

### 2.2 Create `src/domain/banking/ReconciliationMatcher.ts`

```typescript
// src/domain/banking/ReconciliationMatcher.ts
import { Money } from "@/domain/shared"
import { BankTransaction } from "./BankTransaction"

export interface MatchCandidate {
  id: string
  reference: string
  amount: Money
  date: Date
  type: "INVOICE" | "EXPENSE"
}

export interface MatchResult {
  candidateId: string
  candidateType: "INVOICE" | "EXPENSE"
  score: number // 0-100
  reason: string
}

const AUTO_MATCH_THRESHOLD = 85

/**
 * Pure domain logic for matching bank transactions to invoices/expenses.
 * No database access - just matching algorithms.
 */
export class ReconciliationMatcher {
  match(transaction: BankTransaction, candidates: MatchCandidate[]): MatchResult[] {
    const results: MatchResult[] = []

    for (const candidate of candidates) {
      const score = this.calculateScore(transaction, candidate)
      if (score > 0) {
        results.push({
          candidateId: candidate.id,
          candidateType: candidate.type,
          score,
          reason: this.explainScore(transaction, candidate, score),
        })
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score)
  }

  shouldAutoMatch(result: MatchResult): boolean {
    return result.score >= AUTO_MATCH_THRESHOLD
  }

  private calculateScore(transaction: BankTransaction, candidate: MatchCandidate): number {
    let score = 0

    // Reference match (highest weight)
    if (transaction.reference && candidate.reference) {
      if (this.referencesMatch(transaction.reference, candidate.reference)) {
        score += 50
      }
    }

    // Amount match
    const amountMatch = this.amountsMatch(transaction.amount, candidate.amount)
    if (amountMatch === "exact") {
      score += 40
    } else if (amountMatch === "tolerance") {
      score += 25
    }

    // Date proximity
    const daysDiff = this.daysBetween(transaction.date, candidate.date)
    if (daysDiff <= 3) {
      score += 10
    } else if (daysDiff <= 7) {
      score += 5
    }

    return Math.min(score, 100)
  }

  private referencesMatch(txRef: string, candRef: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")
    return (
      normalize(txRef).includes(normalize(candRef)) || normalize(candRef).includes(normalize(txRef))
    )
  }

  private amountsMatch(txAmount: Money, candAmount: Money): "exact" | "tolerance" | "none" {
    if (txAmount.equals(candAmount)) {
      return "exact"
    }

    // 5% tolerance
    const tolerance = candAmount.multiply(0.05)
    const diff = txAmount.subtract(candAmount)
    if (diff.toDecimal().abs().lessThan(tolerance.toDecimal().abs())) {
      return "tolerance"
    }

    return "none"
  }

  private daysBetween(a: Date, b: Date): number {
    const ms = Math.abs(a.getTime() - b.getTime())
    return Math.floor(ms / (1000 * 60 * 60 * 24))
  }

  private explainScore(
    transaction: BankTransaction,
    candidate: MatchCandidate,
    score: number
  ): string {
    const reasons: string[] = []

    if (transaction.reference && candidate.reference) {
      if (this.referencesMatch(transaction.reference, candidate.reference)) {
        reasons.push("Reference match")
      }
    }

    const amountMatch = this.amountsMatch(transaction.amount, candidate.amount)
    if (amountMatch === "exact") {
      reasons.push("Exact amount")
    } else if (amountMatch === "tolerance") {
      reasons.push("Amount within 5%")
    }

    return reasons.join(", ") || "Partial match"
  }
}
```

---

## 3. Fix Float Violations in Import Processor

### 3.1 Current Violation (processor.ts line ~150)

```typescript
// VIOLATING CODE:
const amount = parseFloat(row.amount.replace(",", "."))
```

### 3.2 Fixed Version

```typescript
// COMPLIANT CODE:
import { Money } from "@/domain/shared"

function parseAmount(amountStr: string, currencyHint: string = "EUR"): Money {
  // Croatian format: 1.234,56 → normalize to 1234.56
  const normalized = amountStr
    .replace(/\./g, "") // Remove thousands separator
    .replace(",", ".") // Convert decimal comma
    .trim()

  return Money.fromString(normalized, currencyHint)
}
```

---

## 4. Idempotency for Bank Imports

### 4.1 Create Deduplication Logic

```typescript
// src/domain/banking/ImportDeduplicator.ts
import { BankTransaction } from "./BankTransaction"

export interface DuplicateCheckResult {
  isDuplicate: boolean
  existingTransactionId?: string
  reason?: string
}

/**
 * Checks if a transaction already exists (deduplication).
 */
export class ImportDeduplicator {
  constructor(private readonly existingTransactions: BankTransaction[]) {}

  check(candidate: BankTransaction): DuplicateCheckResult {
    // Check by external ID first (strongest match)
    const byExternalId = this.existingTransactions.find(
      (t) => t.externalId === candidate.externalId
    )
    if (byExternalId) {
      return {
        isDuplicate: true,
        existingTransactionId: byExternalId.id,
        reason: "Matching external ID",
      }
    }

    // Check by exact amount + date + reference
    const byContent = this.existingTransactions.find(
      (t) =>
        t.amount.equals(candidate.amount) &&
        t.date.toDateString() === candidate.date.toDateString() &&
        t.reference === candidate.reference
    )
    if (byContent) {
      return {
        isDuplicate: true,
        existingTransactionId: byContent.id,
        reason: "Matching amount, date, and reference",
      }
    }

    return { isDuplicate: false }
  }
}
```

---

## 5. Infrastructure Parser Updates

### 5.1 Update `src/infrastructure/banking/CsvParser.ts`

```typescript
// src/infrastructure/banking/CsvParser.ts
import { Money } from "@/domain/shared"
import { BankTransaction, TransactionDirection } from "@/domain/banking/BankTransaction"

export interface ParsedRow {
  date: Date
  amount: Money
  direction: TransactionDirection
  reference?: string
  counterpartyName?: string
  counterpartyIban?: string
  description?: string
}

export function parseCsvRow(
  row: Record<string, string>,
  format: "erste" | "pbz" | "zaba" | "generic"
): ParsedRow {
  switch (format) {
    case "erste":
      return parseErsteRow(row)
    case "pbz":
      return parsePbzRow(row)
    default:
      return parseGenericRow(row)
  }
}

function parseErsteRow(row: Record<string, string>): ParsedRow {
  const amountStr = row["Iznos"] || row["Amount"]
  const amount = parseCroatianAmount(amountStr)

  return {
    date: parseCroatianDate(row["Datum"]),
    amount: amount.abs(), // Store absolute value
    direction: amount.isNegative() ? TransactionDirection.DEBIT : TransactionDirection.CREDIT,
    reference: row["Poziv na broj"],
    counterpartyName: row["Naziv primatelja/platitelja"],
    counterpartyIban: row["IBAN"],
    description: row["Opis"],
  }
}

function parseCroatianAmount(value: string): Money {
  // Handle Croatian format: -1.234,56 or 1.234,56
  const cleaned = value
    .replace(/[^\d,.-]/g, "") // Keep digits, comma, dot, minus
    .replace(/\./g, "") // Remove thousands separator
    .replace(",", ".") // Convert decimal comma

  return Money.fromString(cleaned)
}

function parseCroatianDate(value: string): Date {
  // DD.MM.YYYY format
  const [day, month, year] = value.split(".")
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
}
```

---

## 6. Application Use Cases

### 6.1 Create `src/application/banking/ImportBankStatement.ts`

```typescript
// src/application/banking/ImportBankStatement.ts
import { BankTransaction } from "@/domain/banking/BankTransaction"
import { ImportDeduplicator } from "@/domain/banking/ImportDeduplicator"
import { BankTransactionRepository } from "@/domain/banking/BankTransactionRepository"
import { parseCsvRow } from "@/infrastructure/banking/CsvParser"

export interface ImportResult {
  imported: number
  duplicates: number
  errors: string[]
}

export class ImportBankStatement {
  constructor(private readonly repo: BankTransactionRepository) {}

  async execute(
    bankAccountId: string,
    rows: Record<string, string>[],
    format: "erste" | "pbz" | "zaba" | "generic"
  ): Promise<ImportResult> {
    // Load existing transactions for deduplication
    const existing = await this.repo.findByBankAccount(bankAccountId)
    const deduplicator = new ImportDeduplicator(existing)

    let imported = 0
    let duplicates = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      try {
        const parsed = parseCsvRow(rows[i], format)

        const transaction = BankTransaction.create({
          externalId: `${bankAccountId}-${i}-${parsed.date.toISOString()}`,
          bankAccountId,
          ...parsed,
          balance: Money.zero(), // Will be calculated
        })

        const dupCheck = deduplicator.check(transaction)
        if (dupCheck.isDuplicate) {
          duplicates++
          continue
        }

        await this.repo.save(transaction)
        imported++
      } catch (error) {
        errors.push(`Row ${i + 1}: ${error.message}`)
      }
    }

    return { imported, duplicates, errors }
  }
}
```

---

## 7. Exit Criteria

Phase 4 is complete when:

- [ ] `src/domain/banking/BankTransaction.ts` uses Money for all amounts
- [ ] `src/domain/banking/ReconciliationMatcher.ts` pure matching logic
- [ ] `src/domain/banking/ImportDeduplicator.ts` prevents duplicate imports
- [ ] `src/infrastructure/banking/CsvParser.ts` outputs Money objects
- [ ] No float operations in banking domain (`parseFloat`, `Number()`, `.toFixed()`)
- [ ] Import idempotency tested and working
- [ ] Reconciliation matching is deterministic

---

## 8. Files to Migrate

| File                                        | Float Violations | Action                            |
| ------------------------------------------- | ---------------- | --------------------------------- |
| `src/lib/banking/import/processor.ts`       | 13               | Full refactor to use Money        |
| `src/lib/banking/csv-parser.ts`             | 5                | Move to infrastructure, use Money |
| `src/lib/banking/reconciliation.ts`         | 4                | Extract domain logic, use Money   |
| `src/lib/banking/reconciliation-service.ts` | 2                | Becomes application use case      |
| `src/lib/banking/import/audit.ts`           | 2                | Update to use Money               |

---

**Next Document:** Phase 5 Implementation Plan (Compliance & Identity)
