/**
 * ComplianceDeadline Domain Tests
 * Following TDD: Write tests first, then implement
 */

import { describe, it } from "node:test"
import assert from "node:assert"
import { ComplianceDeadline, ComplianceDeadlineProps } from "../ComplianceDeadline"
import { DeadlineType } from "../DeadlineType"
import { Severity } from "../Severity"
import { Recurrence } from "../Recurrence"
import { ApplicabilityRule } from "../ApplicabilityRule"
import { ComplianceError } from "../ComplianceError"

describe("DeadlineType", () => {
  it("has all required types", () => {
    assert.strictEqual(DeadlineType.TAX, "TAX")
    assert.strictEqual(DeadlineType.REPORTING, "REPORTING")
    assert.strictEqual(DeadlineType.REGISTRATION, "REGISTRATION")
    assert.strictEqual(DeadlineType.REGULATORY, "REGULATORY")
  })

  it("values() returns all deadline types", () => {
    const values = DeadlineType.values()
    assert.strictEqual(values.length, 4)
    assert.ok(values.includes(DeadlineType.TAX))
    assert.ok(values.includes(DeadlineType.REPORTING))
    assert.ok(values.includes(DeadlineType.REGISTRATION))
    assert.ok(values.includes(DeadlineType.REGULATORY))
  })

  it("isValid() returns true for valid types", () => {
    assert.strictEqual(DeadlineType.isValid("TAX"), true)
    assert.strictEqual(DeadlineType.isValid("REPORTING"), true)
  })

  it("isValid() returns false for invalid types", () => {
    assert.strictEqual(DeadlineType.isValid("INVALID"), false)
    assert.strictEqual(DeadlineType.isValid(""), false)
  })
})

describe("Severity", () => {
  it("has all required levels", () => {
    assert.strictEqual(Severity.CRITICAL, "CRITICAL")
    assert.strictEqual(Severity.HIGH, "HIGH")
    assert.strictEqual(Severity.NORMAL, "NORMAL")
    assert.strictEqual(Severity.LOW, "LOW")
  })

  it("values() returns all severity levels", () => {
    const values = Severity.values()
    assert.strictEqual(values.length, 4)
    assert.ok(values.includes(Severity.CRITICAL))
    assert.ok(values.includes(Severity.HIGH))
    assert.ok(values.includes(Severity.NORMAL))
    assert.ok(values.includes(Severity.LOW))
  })

  it("isValid() returns true for valid levels", () => {
    assert.strictEqual(Severity.isValid("CRITICAL"), true)
    assert.strictEqual(Severity.isValid("LOW"), true)
  })

  it("isValid() returns false for invalid levels", () => {
    assert.strictEqual(Severity.isValid("URGENT"), false)
    assert.strictEqual(Severity.isValid(""), false)
  })

  it("compare() orders severity correctly (CRITICAL > HIGH > NORMAL > LOW)", () => {
    assert.ok(Severity.compare(Severity.CRITICAL, Severity.HIGH) > 0)
    assert.ok(Severity.compare(Severity.HIGH, Severity.NORMAL) > 0)
    assert.ok(Severity.compare(Severity.NORMAL, Severity.LOW) > 0)
    assert.strictEqual(Severity.compare(Severity.HIGH, Severity.HIGH), 0)
    assert.ok(Severity.compare(Severity.LOW, Severity.CRITICAL) < 0)
  })
})

describe("Recurrence", () => {
  describe("creation", () => {
    it("creates MONTHLY recurrence", () => {
      const recurrence = Recurrence.monthly(15)
      assert.strictEqual(recurrence.type, "MONTHLY")
      assert.strictEqual(recurrence.dayOfMonth, 15)
    })

    it("creates QUARTERLY recurrence", () => {
      const recurrence = Recurrence.quarterly(20)
      assert.strictEqual(recurrence.type, "QUARTERLY")
      assert.strictEqual(recurrence.dayOfMonth, 20)
    })

    it("creates YEARLY recurrence", () => {
      const recurrence = Recurrence.yearly(3, 31) // March 31
      assert.strictEqual(recurrence.type, "YEARLY")
      assert.strictEqual(recurrence.month, 3)
      assert.strictEqual(recurrence.dayOfMonth, 31)
    })

    it("creates ONE_TIME recurrence with specific date", () => {
      const dueDate = new Date("2025-06-15")
      const recurrence = Recurrence.oneTime(dueDate)
      assert.strictEqual(recurrence.type, "ONE_TIME")
      assert.deepStrictEqual(recurrence.specificDate, dueDate)
    })

    it("throws for invalid day of month (0)", () => {
      assert.throws(() => Recurrence.monthly(0), ComplianceError)
    })

    it("throws for invalid day of month (32)", () => {
      assert.throws(() => Recurrence.monthly(32), ComplianceError)
    })

    it("throws for invalid month (0)", () => {
      assert.throws(() => Recurrence.yearly(0, 15), ComplianceError)
    })

    it("throws for invalid month (13)", () => {
      assert.throws(() => Recurrence.yearly(13, 15), ComplianceError)
    })
  })

  describe("getNextOccurrence", () => {
    it("returns next month for MONTHLY when day has passed", () => {
      const recurrence = Recurrence.monthly(15)
      const fromDate = new Date("2025-01-20") // After the 15th

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 1) // February (0-indexed)
      assert.strictEqual(next.getDate(), 15)
    })

    it("returns same month for MONTHLY when day has not passed", () => {
      const recurrence = Recurrence.monthly(20)
      const fromDate = new Date("2025-01-10") // Before the 20th

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 0) // January
      assert.strictEqual(next.getDate(), 20)
    })

    it("handles month rollover for MONTHLY", () => {
      const recurrence = Recurrence.monthly(15)
      const fromDate = new Date("2025-12-20") // December, after 15th

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2026)
      assert.strictEqual(next.getMonth(), 0) // January
      assert.strictEqual(next.getDate(), 15)
    })

    it("returns next quarter for QUARTERLY", () => {
      const recurrence = Recurrence.quarterly(20)
      const fromDate = new Date("2025-01-25") // Q1, after the 20th

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 3) // April (Q2)
      assert.strictEqual(next.getDate(), 20)
    })

    it("returns same quarter for QUARTERLY when day has not passed", () => {
      const recurrence = Recurrence.quarterly(20)
      const fromDate = new Date("2025-01-10") // Q1, before the 20th

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 0) // January (Q1 start)
      assert.strictEqual(next.getDate(), 20)
    })

    it("returns next year for YEARLY when date has passed", () => {
      const recurrence = Recurrence.yearly(3, 31) // March 31
      const fromDate = new Date("2025-04-15") // After March 31

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2026)
      assert.strictEqual(next.getMonth(), 2) // March (0-indexed)
      assert.strictEqual(next.getDate(), 31)
    })

    it("returns same year for YEARLY when date has not passed", () => {
      const recurrence = Recurrence.yearly(6, 30) // June 30
      const fromDate = new Date("2025-01-15")

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 5) // June (0-indexed)
      assert.strictEqual(next.getDate(), 30)
    })

    it("returns specific date for ONE_TIME", () => {
      const dueDate = new Date("2025-06-15")
      const recurrence = Recurrence.oneTime(dueDate)
      const fromDate = new Date("2025-01-01")

      const next = recurrence.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 5) // June
      assert.strictEqual(next.getDate(), 15)
    })

    it("handles day overflow for short months", () => {
      const recurrence = Recurrence.monthly(31)
      const fromDate = new Date("2025-02-15") // February has 28 days

      const next = recurrence.getNextOccurrence(fromDate)

      // Should be last day of February
      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 1) // February
      assert.strictEqual(next.getDate(), 28)
    })
  })

  describe("isRecurring", () => {
    it("returns true for MONTHLY", () => {
      assert.strictEqual(Recurrence.monthly(15).isRecurring, true)
    })

    it("returns true for QUARTERLY", () => {
      assert.strictEqual(Recurrence.quarterly(20).isRecurring, true)
    })

    it("returns true for YEARLY", () => {
      assert.strictEqual(Recurrence.yearly(3, 31).isRecurring, true)
    })

    it("returns false for ONE_TIME", () => {
      assert.strictEqual(Recurrence.oneTime(new Date()).isRecurring, false)
    })
  })
})

describe("ApplicabilityRule", () => {
  describe("creation", () => {
    it("creates rule for all businesses", () => {
      const rule = ApplicabilityRule.all()
      assert.strictEqual(rule.appliesTo("pausalni"), true)
      assert.strictEqual(rule.appliesTo("doo"), true)
      assert.strictEqual(rule.appliesTo("anything"), true)
    })

    it("creates rule for specific business types", () => {
      const rule = ApplicabilityRule.forTypes(["pausalni", "obrt"])
      assert.strictEqual(rule.appliesTo("pausalni"), true)
      assert.strictEqual(rule.appliesTo("obrt"), true)
      assert.strictEqual(rule.appliesTo("doo"), false)
    })

    it("creates rule excluding specific business types", () => {
      const rule = ApplicabilityRule.except(["pausalni"])
      assert.strictEqual(rule.appliesTo("pausalni"), false)
      assert.strictEqual(rule.appliesTo("doo"), true)
      assert.strictEqual(rule.appliesTo("obrt"), true)
    })

    it("throws for empty types array", () => {
      assert.throws(() => ApplicabilityRule.forTypes([]), ComplianceError)
    })

    it("throws for empty except array", () => {
      assert.throws(() => ApplicabilityRule.except([]), ComplianceError)
    })
  })

  describe("appliesTo", () => {
    it("is case-insensitive", () => {
      const rule = ApplicabilityRule.forTypes(["PAUSALNI", "DOO"])
      assert.strictEqual(rule.appliesTo("pausalni"), true)
      assert.strictEqual(rule.appliesTo("Pausalni"), true)
      assert.strictEqual(rule.appliesTo("PAUSALNI"), true)
    })

    it("handles whitespace in business type", () => {
      const rule = ApplicabilityRule.forTypes(["pausalni"])
      assert.strictEqual(rule.appliesTo("  pausalni  "), true)
    })
  })

  describe("serialization", () => {
    it("toJSON returns correct format for ALL", () => {
      const rule = ApplicabilityRule.all()
      const json = rule.toJSON()
      assert.deepStrictEqual(json, { type: "ALL" })
    })

    it("toJSON returns correct format for INCLUDE", () => {
      const rule = ApplicabilityRule.forTypes(["pausalni", "obrt"])
      const json = rule.toJSON()
      assert.deepStrictEqual(json, { type: "INCLUDE", businessTypes: ["pausalni", "obrt"] })
    })

    it("toJSON returns correct format for EXCLUDE", () => {
      const rule = ApplicabilityRule.except(["pausalni"])
      const json = rule.toJSON()
      assert.deepStrictEqual(json, { type: "EXCLUDE", businessTypes: ["pausalni"] })
    })

    it("fromJSON reconstitutes ALL rule", () => {
      const rule = ApplicabilityRule.fromJSON({ type: "ALL" })
      assert.strictEqual(rule.appliesTo("anything"), true)
    })

    it("fromJSON reconstitutes INCLUDE rule", () => {
      const rule = ApplicabilityRule.fromJSON({ type: "INCLUDE", businessTypes: ["pausalni"] })
      assert.strictEqual(rule.appliesTo("pausalni"), true)
      assert.strictEqual(rule.appliesTo("doo"), false)
    })

    it("fromJSON reconstitutes EXCLUDE rule", () => {
      const rule = ApplicabilityRule.fromJSON({ type: "EXCLUDE", businessTypes: ["pausalni"] })
      assert.strictEqual(rule.appliesTo("pausalni"), false)
      assert.strictEqual(rule.appliesTo("doo"), true)
    })
  })
})

describe("ComplianceDeadline", () => {
  // Helper to create a valid deadline for testing
  function createTestDeadline(
    overrides: Partial<{
      title: string
      description: string
      deadlineType: string
      severity: string
      recurrence: Recurrence
      appliesTo: ApplicabilityRule
      sourceUrl: string
      sourceName: string
    }> = {}
  ): ComplianceDeadline {
    return ComplianceDeadline.create({
      title: overrides.title ?? "Monthly Tax Payment",
      description: overrides.description ?? "PDV payment due",
      deadlineType: (overrides.deadlineType ?? DeadlineType.TAX) as typeof DeadlineType.TAX,
      severity: (overrides.severity ?? Severity.HIGH) as typeof Severity.HIGH,
      recurrence: overrides.recurrence ?? Recurrence.monthly(20),
      appliesTo: overrides.appliesTo ?? ApplicabilityRule.all(),
      sourceUrl: overrides.sourceUrl ?? "https://porezna.gov.hr/pdv",
      sourceName: overrides.sourceName ?? "Porezna uprava",
    })
  }

  describe("creation", () => {
    it("creates deadline with valid inputs", () => {
      const deadline = createTestDeadline()

      assert.ok(deadline.id)
      assert.strictEqual(deadline.title, "Monthly Tax Payment")
      assert.strictEqual(deadline.description, "PDV payment due")
      assert.strictEqual(deadline.deadlineType, DeadlineType.TAX)
      assert.strictEqual(deadline.severity, Severity.HIGH)
      assert.strictEqual(deadline.sourceUrl, "https://porezna.gov.hr/pdv")
      assert.strictEqual(deadline.sourceName, "Porezna uprava")
    })

    it("generates unique ID for each deadline", () => {
      const deadline1 = createTestDeadline()
      const deadline2 = createTestDeadline()

      assert.notStrictEqual(deadline1.id, deadline2.id)
    })

    it("throws on empty title", () => {
      assert.throws(
        () => createTestDeadline({ title: "" }),
        (err: Error) => err instanceof ComplianceError && err.message.includes("title")
      )
    })

    it("throws on whitespace-only title", () => {
      assert.throws(() => createTestDeadline({ title: "   " }), ComplianceError)
    })

    it("throws on empty description", () => {
      assert.throws(() => createTestDeadline({ description: "" }), ComplianceError)
    })

    it("throws on invalid deadline type", () => {
      assert.throws(() => createTestDeadline({ deadlineType: "INVALID" }), ComplianceError)
    })

    it("throws on invalid severity", () => {
      assert.throws(() => createTestDeadline({ severity: "URGENT" }), ComplianceError)
    })

    it("throws on empty source URL", () => {
      assert.throws(() => createTestDeadline({ sourceUrl: "" }), ComplianceError)
    })

    it("throws on empty source name", () => {
      assert.throws(() => createTestDeadline({ sourceName: "" }), ComplianceError)
    })
  })

  describe("reconstitute", () => {
    it("reconstitutes from props", () => {
      const props: ComplianceDeadlineProps = {
        id: "deadline-123",
        title: "Quarterly Report",
        description: "Submit quarterly tax report",
        deadlineType: DeadlineType.REPORTING,
        severity: Severity.CRITICAL,
        recurrence: Recurrence.quarterly(15),
        appliesTo: ApplicabilityRule.forTypes(["doo"]),
        sourceUrl: "https://porezna.gov.hr/reports",
        sourceName: "Porezna uprava",
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-02"),
      }

      const deadline = ComplianceDeadline.reconstitute(props)

      assert.strictEqual(deadline.id, "deadline-123")
      assert.strictEqual(deadline.title, "Quarterly Report")
      assert.strictEqual(deadline.deadlineType, DeadlineType.REPORTING)
      assert.strictEqual(deadline.severity, Severity.CRITICAL)
    })
  })

  describe("isApplicableTo", () => {
    it("returns true when business type matches rule", () => {
      const deadline = createTestDeadline({
        appliesTo: ApplicabilityRule.forTypes(["pausalni", "obrt"]),
      })

      assert.strictEqual(deadline.isApplicableTo("pausalni"), true)
      assert.strictEqual(deadline.isApplicableTo("obrt"), true)
    })

    it("returns false when business type does not match", () => {
      const deadline = createTestDeadline({
        appliesTo: ApplicabilityRule.forTypes(["pausalni"]),
      })

      assert.strictEqual(deadline.isApplicableTo("doo"), false)
    })

    it("uses ALL rule to apply to any business", () => {
      const deadline = createTestDeadline({
        appliesTo: ApplicabilityRule.all(),
      })

      assert.strictEqual(deadline.isApplicableTo("pausalni"), true)
      assert.strictEqual(deadline.isApplicableTo("doo"), true)
      assert.strictEqual(deadline.isApplicableTo("anything"), true)
    })
  })

  describe("getNextOccurrence", () => {
    it("delegates to recurrence for next date", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.monthly(15),
      })
      const fromDate = new Date("2025-01-10")

      const next = deadline.getNextOccurrence(fromDate)

      assert.strictEqual(next.getDate(), 15)
      assert.strictEqual(next.getMonth(), 0) // January
    })

    it("handles QUARTERLY recurrence", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.quarterly(20),
      })
      const fromDate = new Date("2025-01-25") // After Q1 deadline

      const next = deadline.getNextOccurrence(fromDate)

      assert.strictEqual(next.getMonth(), 3) // April
    })

    it("handles YEARLY recurrence", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.yearly(12, 31), // Dec 31
      })
      const fromDate = new Date("2025-06-15")

      const next = deadline.getNextOccurrence(fromDate)

      assert.strictEqual(next.getFullYear(), 2025)
      assert.strictEqual(next.getMonth(), 11) // December
      assert.strictEqual(next.getDate(), 31)
    })
  })

  describe("getDaysUntil", () => {
    it("returns positive days when deadline is in future", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.monthly(20),
      })
      // Mock fromDate to ensure consistent test
      const fromDate = new Date("2025-01-10")

      const days = deadline.getDaysUntil(fromDate)

      assert.strictEqual(days, 10) // 20 - 10 = 10 days
    })

    it("returns negative days when deadline has passed", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-10")),
      })
      const fromDate = new Date("2025-01-15")

      const days = deadline.getDaysUntil(fromDate)

      assert.strictEqual(days, -5)
    })

    it("returns 0 on the deadline day", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-15")),
      })
      const fromDate = new Date("2025-01-15")

      const days = deadline.getDaysUntil(fromDate)

      assert.strictEqual(days, 0)
    })

    it("uses current date when fromDate not provided", () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 30)

      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(futureDate),
      })

      const days = deadline.getDaysUntil()

      // Should be approximately 30 days (might vary by a day due to time)
      assert.ok(days >= 29 && days <= 31)
    })
  })

  describe("isApproaching", () => {
    it("returns true when deadline is within default threshold (7 days)", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.monthly(15),
      })
      const fromDate = new Date("2025-01-10") // 5 days before

      assert.strictEqual(deadline.isApproaching(7, fromDate), true)
    })

    it("returns false when deadline is beyond threshold", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.monthly(25),
      })
      const fromDate = new Date("2025-01-10") // 15 days before

      assert.strictEqual(deadline.isApproaching(7, fromDate), false)
    })

    it("returns true when deadline is today", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-15")),
      })
      const fromDate = new Date("2025-01-15")

      assert.strictEqual(deadline.isApproaching(7, fromDate), true)
    })

    it("returns false when deadline has passed", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-10")),
      })
      const fromDate = new Date("2025-01-15")

      assert.strictEqual(deadline.isApproaching(7, fromDate), false)
    })

    it("accepts custom threshold", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.monthly(20),
      })
      const fromDate = new Date("2025-01-10") // 10 days before

      assert.strictEqual(deadline.isApproaching(5, fromDate), false)
      assert.strictEqual(deadline.isApproaching(15, fromDate), true)
    })
  })

  describe("isOverdue", () => {
    it("returns true when ONE_TIME deadline has passed", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-10")),
      })
      const asOfDate = new Date("2025-01-15")

      assert.strictEqual(deadline.isOverdue(asOfDate), true)
    })

    it("returns false when deadline is in future", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-20")),
      })
      const asOfDate = new Date("2025-01-15")

      assert.strictEqual(deadline.isOverdue(asOfDate), false)
    })

    it("returns false on the deadline day", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(new Date("2025-01-15")),
      })
      const asOfDate = new Date("2025-01-15")

      assert.strictEqual(deadline.isOverdue(asOfDate), false)
    })

    it("returns false for recurring deadlines (they always have a next occurrence)", () => {
      const deadline = createTestDeadline({
        recurrence: Recurrence.monthly(10),
      })
      const asOfDate = new Date("2025-01-15") // After the 10th

      // Recurring deadlines are never overdue - they have a next occurrence
      assert.strictEqual(deadline.isOverdue(asOfDate), false)
    })

    it("uses current date when asOfDate not provided", () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)

      const deadline = createTestDeadline({
        recurrence: Recurrence.oneTime(pastDate),
      })

      assert.strictEqual(deadline.isOverdue(), true)
    })
  })

  describe("update methods", () => {
    it("updateTitle changes the title", () => {
      const deadline = createTestDeadline({ title: "Original Title" })

      deadline.updateTitle("New Title")

      assert.strictEqual(deadline.title, "New Title")
    })

    it("updateTitle throws on empty title", () => {
      const deadline = createTestDeadline()

      assert.throws(() => deadline.updateTitle(""), ComplianceError)
    })

    it("updateSeverity changes the severity", () => {
      const deadline = createTestDeadline({ severity: Severity.NORMAL })

      deadline.updateSeverity(Severity.CRITICAL)

      assert.strictEqual(deadline.severity, Severity.CRITICAL)
    })

    it("updateApplicability changes the rule", () => {
      const deadline = createTestDeadline({
        appliesTo: ApplicabilityRule.all(),
      })

      deadline.updateApplicability(ApplicabilityRule.forTypes(["doo"]))

      assert.strictEqual(deadline.isApplicableTo("doo"), true)
      assert.strictEqual(deadline.isApplicableTo("pausalni"), false)
    })
  })
})
