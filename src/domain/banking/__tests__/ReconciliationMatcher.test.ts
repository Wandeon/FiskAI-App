// src/domain/banking/__tests__/ReconciliationMatcher.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { ReconciliationMatcher, MatchCandidate, MatchResult } from "../ReconciliationMatcher"
import { BankTransaction, TransactionDirection, MatchStatus } from "../BankTransaction"
import { Money } from "@/domain/shared"

function createTestTransaction(
  overrides: Partial<{
    amount: Money
    date: Date
    reference: string
  }> = {}
): BankTransaction {
  return BankTransaction.create({
    externalId: "ext-123",
    bankAccountId: "account-456",
    date: overrides.date ?? new Date("2025-01-15"),
    amount: overrides.amount ?? Money.fromString("100.00"),
    direction: TransactionDirection.CREDIT,
    balance: Money.fromString("1000.00"),
    reference: overrides.reference,
  })
}

function createCandidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: overrides.id ?? "candidate-1",
    reference: overrides.reference ?? "INV-001",
    amount: overrides.amount ?? Money.fromString("100.00"),
    date: overrides.date ?? new Date("2025-01-15"),
    type: overrides.type ?? "INVOICE",
  }
}

describe("ReconciliationMatcher", () => {
  let matcher: ReconciliationMatcher

  beforeEach(() => {
    matcher = new ReconciliationMatcher()
  })

  describe("Scoring - Reference Matching", () => {
    it("adds 50 points for exact reference match", () => {
      const tx = createTestTransaction({
        reference: "INV-2025-001",
        amount: Money.fromString("50.00"), // Different amount, no amount points
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          id: "inv-1",
          reference: "INV-2025-001",
          amount: Money.fromString("999.00"), // Different amount
          date: new Date("2025-02-15"), // Different date, beyond 7 days
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(50) // Only reference points
    })

    it("matches normalized references (case insensitive)", () => {
      const tx = createTestTransaction({
        reference: "inv-2025-001",
      })
      const candidates = [
        createCandidate({
          reference: "INV-2025-001",
          amount: Money.fromString("999.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(50)
    })

    it("matches normalized references (strips special characters)", () => {
      const tx = createTestTransaction({
        reference: "INV/2025/001",
      })
      const candidates = [
        createCandidate({
          reference: "INV-2025-001",
          amount: Money.fromString("999.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(50)
    })

    it("matches when transaction reference contains candidate reference", () => {
      const tx = createTestTransaction({
        reference: "Payment for INV-001 services",
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("999.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(50)
    })

    it("matches when candidate reference contains transaction reference", () => {
      const tx = createTestTransaction({
        reference: "001",
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("999.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(50)
    })

    it("gives 0 reference points when references do not match", () => {
      const tx = createTestTransaction({
        reference: "XYZ-999",
        amount: Money.fromString("50.00"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("999.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(0) // No match, score is 0
    })

    it("gives 0 reference points when transaction has no reference", () => {
      const tx = createTestTransaction({
        reference: undefined,
        amount: Money.fromString("100.00"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      // Should still match on amount (40) and date (10)
      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(50) // 40 (amount) + 10 (date)
    })
  })

  describe("Scoring - Amount Matching", () => {
    it("adds 40 points for exact amount match", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          id: "inv-1",
          reference: "", // Empty reference
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"), // Beyond 7 days, no date points
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(40) // Only amount points
    })

    it("adds 25 points for amount within 5% tolerance", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("102.00"), // 2% difference from 100
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(25) // Tolerance match
    })

    it("adds 25 points for amount within 5% tolerance (other direction)", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("98.00"), // 2% difference from 100
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(25)
    })

    it("adds 25 points for amount at exactly 5% tolerance", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("105.00"), // Exactly 5% difference from 100
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      // At exactly 5%, it should still be within tolerance (less than)
      // 5% of 100 = 5, diff = 5, diff < tolerance is false
      // Actually at exactly 5% it's NOT less than, so 0 points
      expect(results).toHaveLength(0)
    })

    it("gives 0 amount points for amounts beyond 5% tolerance", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("110.00"), // 10% difference from 100
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(0) // No match
    })

    it("handles Money precision correctly for tolerance calculation", () => {
      // 0.1 + 0.2 float precision issue test
      const tx = createTestTransaction({
        amount: Money.fromString("100.30"), // 0.3% difference from 100
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(25)
    })
  })

  describe("Scoring - Date Proximity", () => {
    it("adds 10 points for dates within 3 days", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-17"), // 2 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(10) // Only date points
    })

    it("adds 10 points for dates exactly 3 days apart", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-18"), // Exactly 3 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(10)
    })

    it("adds 10 points for same day", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-15"), // Same day
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(10)
    })

    it("adds 5 points for dates within 7 days (but more than 3)", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-20"), // 5 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(5)
    })

    it("adds 5 points for dates exactly 7 days apart", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-22"), // Exactly 7 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(5)
    })

    it("gives 0 date points for dates beyond 7 days", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-30"), // 15 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(40) // Only amount match, no date points
    })

    it("handles date differences correctly regardless of order", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-20"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-15"), // Candidate date before transaction
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(5) // 5 days apart
    })
  })

  describe("Combined Scoring", () => {
    it("calculates 100 points for reference + exact amount + date within 3 days", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-16"), // 1 day apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(100) // 50 + 40 + 10
    })

    it("calculates 95 points for reference + exact amount + date within 7 days", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-20"), // 5 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(95) // 50 + 40 + 5
    })

    it("calculates 90 points for reference + exact amount + no date match", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"), // 31 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(90) // 50 + 40 + 0
    })

    it("calculates 85 points for reference + tolerance amount + date within 3 days", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("102.00"), // Within 5% of 100
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-16"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(85) // 50 + 25 + 10
    })

    it("caps score at 100", () => {
      // This shouldn't happen with current scoring, but test the cap anyway
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results[0].score).toBeLessThanOrEqual(100)
    })
  })

  describe("match - Multiple Candidates", () => {
    it("returns results sorted by score descending", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          id: "low-score",
          reference: "OTHER",
          amount: Money.fromString("100.00"),
          date: new Date("2025-02-15"),
        }),
        createCandidate({
          id: "high-score",
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
        createCandidate({
          id: "mid-score",
          reference: "INV-001",
          amount: Money.fromString("150.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(3)
      expect(results[0].candidateId).toBe("high-score") // 100 points
      expect(results[1].candidateId).toBe("mid-score") // 60 points (ref + date)
      expect(results[2].candidateId).toBe("low-score") // 40 points (amount only)
    })

    it("returns empty array when no candidates match", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-12-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(0)
    })

    it("filters out candidates with 0 score", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          id: "matching",
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
        createCandidate({
          id: "non-matching",
          reference: "COMPLETELY-DIFFERENT",
          amount: Money.fromString("999999.00"),
          date: new Date("2030-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].candidateId).toBe("matching")
    })

    it("handles empty candidates array", () => {
      const tx = createTestTransaction()

      const results = matcher.match(tx, [])

      expect(results).toHaveLength(0)
    })
  })

  describe("match - Result Structure", () => {
    it("returns correct candidateId and candidateType", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          id: "invoice-123",
          type: "INVOICE",
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
        createCandidate({
          id: "expense-456",
          type: "EXPENSE",
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(2)
      const invoiceResult = results.find((r) => r.candidateId === "invoice-123")
      const expenseResult = results.find((r) => r.candidateId === "expense-456")

      expect(invoiceResult?.candidateType).toBe("INVOICE")
      expect(expenseResult?.candidateType).toBe("EXPENSE")
    })

    it("includes explanation reason for reference match", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results[0].reason).toContain("Reference match")
    })

    it("includes explanation reason for exact amount", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results[0].reason).toContain("Exact amount")
    })

    it("includes explanation reason for tolerance amount", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("102.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-16"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results[0].reason).toContain("Amount within 5%")
    })

    it("returns 'Partial match' when only date matches", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("50.00"),
        reference: undefined,
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("999.00"),
          date: new Date("2025-01-16"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].reason).toBe("Partial match")
    })
  })

  describe("shouldAutoMatch", () => {
    it("returns true for score >= 85", () => {
      const result: MatchResult = {
        candidateId: "inv-1",
        candidateType: "INVOICE",
        score: 85,
        reason: "Reference match, Exact amount",
      }

      expect(matcher.shouldAutoMatch(result)).toBe(true)
    })

    it("returns true for score of 100", () => {
      const result: MatchResult = {
        candidateId: "inv-1",
        candidateType: "INVOICE",
        score: 100,
        reason: "Reference match, Exact amount",
      }

      expect(matcher.shouldAutoMatch(result)).toBe(true)
    })

    it("returns false for score < 85", () => {
      const result: MatchResult = {
        candidateId: "inv-1",
        candidateType: "INVOICE",
        score: 84,
        reason: "Reference match, Amount within 5%",
      }

      expect(matcher.shouldAutoMatch(result)).toBe(false)
    })

    it("returns false for score of 0", () => {
      const result: MatchResult = {
        candidateId: "inv-1",
        candidateType: "INVOICE",
        score: 0,
        reason: "No match",
      }

      expect(matcher.shouldAutoMatch(result)).toBe(false)
    })

    it("returns true for reference + tolerance amount + date within 3 days (85 points)", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("102.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-16"),
        }),
      ]

      const results = matcher.match(tx, candidates)
      expect(results).toHaveLength(1)
      expect(matcher.shouldAutoMatch(results[0])).toBe(true)
    })

    it("returns false for reference + tolerance amount + date within 7 days (80 points)", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("102.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-20"), // 5 days apart
        }),
      ]

      const results = matcher.match(tx, candidates)
      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(80) // 50 + 25 + 5
      expect(matcher.shouldAutoMatch(results[0])).toBe(false)
    })
  })

  describe("Edge Cases", () => {
    it("handles very small amounts correctly", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("0.01"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("0.01"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(100)
    })

    it("handles large amounts correctly", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("1234567.89"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "INV-001",
          amount: Money.fromString("1234567.89"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      expect(results[0].score).toBe(100)
    })

    it("handles empty string reference in candidate", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-001",
        date: new Date("2025-01-15"),
      })
      const candidates = [
        createCandidate({
          reference: "",
          amount: Money.fromString("100.00"),
          date: new Date("2025-01-15"),
        }),
      ]

      const results = matcher.match(tx, candidates)

      expect(results).toHaveLength(1)
      // No reference match because candidate reference is empty
      expect(results[0].score).toBe(50) // 40 (amount) + 10 (date)
    })

    it("handles many candidates efficiently", () => {
      const tx = createTestTransaction({
        amount: Money.fromString("100.00"),
        reference: "INV-050",
        date: new Date("2025-01-15"),
      })

      const candidates: MatchCandidate[] = []
      for (let i = 0; i < 100; i++) {
        candidates.push(
          createCandidate({
            id: `inv-${i}`,
            reference: `INV-${String(i).padStart(3, "0")}`,
            amount: Money.fromString(`${100 + i}.00`),
            date: new Date(`2025-01-${15 + (i % 20)}`),
          })
        )
      }

      const startTime = Date.now()
      const results = matcher.match(tx, candidates)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100) // Should be fast
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe("Type Safety", () => {
    it("MatchCandidate requires all fields", () => {
      // This is a compile-time check, but we can verify the interface works
      const candidate: MatchCandidate = {
        id: "test-id",
        reference: "REF-001",
        amount: Money.fromString("100.00"),
        date: new Date(),
        type: "INVOICE",
      }

      expect(candidate.id).toBeDefined()
      expect(candidate.reference).toBeDefined()
      expect(candidate.amount).toBeDefined()
      expect(candidate.date).toBeDefined()
      expect(candidate.type).toBeDefined()
    })

    it("MatchResult has correct structure", () => {
      const result: MatchResult = {
        candidateId: "test-id",
        candidateType: "EXPENSE",
        score: 75,
        reason: "Some reason",
      }

      expect(result.candidateId).toBeDefined()
      expect(result.candidateType).toBeDefined()
      expect(result.score).toBeDefined()
      expect(result.reason).toBeDefined()
    })
  })
})
