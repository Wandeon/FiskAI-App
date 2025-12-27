// src/lib/assistant/query-engine/__tests__/rule-eligibility.test.ts

import { describe, it, expect } from "vitest"
import {
  checkTemporalEligibility,
  checkConditionalEligibility,
  checkRuleEligibility,
  buildEvaluationContext,
  extractRequiredFields,
} from "../rule-eligibility"
import type { EvaluationContext } from "@/lib/regulatory-truth/dsl/applies-when"

describe("Rule Eligibility Gate", () => {
  const baseContext: EvaluationContext = {
    asOf: "2025-06-15T12:00:00Z",
    entity: {
      type: "OBRT",
      obrtSubtype: "PAUSALNI",
      vat: { status: "OUTSIDE_VAT" },
      location: { country: "HR" },
    },
  }

  describe("checkTemporalEligibility", () => {
    it("rejects future rules", () => {
      const futureRule = {
        effectiveFrom: new Date("2026-01-01"),
        effectiveUntil: null,
      }
      const asOfDate = new Date("2025-06-15")

      const result = checkTemporalEligibility(futureRule, asOfDate)

      expect(result.eligible).toBe(false)
      expect(result).toHaveProperty("reason", "FUTURE")
    })

    it("rejects expired rules", () => {
      const expiredRule = {
        effectiveFrom: new Date("2020-01-01"),
        effectiveUntil: new Date("2024-12-31"),
      }
      const asOfDate = new Date("2025-06-15")

      const result = checkTemporalEligibility(expiredRule, asOfDate)

      expect(result.eligible).toBe(false)
      expect(result).toHaveProperty("reason", "EXPIRED")
    })

    it("accepts currently valid rules", () => {
      const validRule = {
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: new Date("2026-12-31"),
      }
      const asOfDate = new Date("2025-06-15")

      const result = checkTemporalEligibility(validRule, asOfDate)

      expect(result.eligible).toBe(true)
    })

    it("accepts rules with no expiry", () => {
      const noExpiryRule = {
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: null,
      }
      const asOfDate = new Date("2025-06-15")

      const result = checkTemporalEligibility(noExpiryRule, asOfDate)

      expect(result.eligible).toBe(true)
    })

    it("handles boundary conditions correctly - effectiveFrom is inclusive", () => {
      const boundaryRule = {
        effectiveFrom: new Date("2025-06-15"),
        effectiveUntil: null,
      }
      const asOfDate = new Date("2025-06-15")

      // Rule should be valid ON the effectiveFrom date (inclusive)
      const result = checkTemporalEligibility(boundaryRule, asOfDate)
      expect(result.eligible).toBe(true)
    })

    it("handles boundary conditions correctly - effectiveUntil is exclusive", () => {
      const boundaryRule = {
        effectiveFrom: new Date("2025-06-01"),
        effectiveUntil: new Date("2025-06-15"),
      }

      // Day before effectiveUntil should be valid
      const dayBefore = new Date("2025-06-14")
      const resultBefore = checkTemporalEligibility(boundaryRule, dayBefore)
      expect(resultBefore.eligible).toBe(true)

      // ON effectiveUntil date, rule should be EXPIRED (exclusive boundary)
      const onDay = new Date("2025-06-15")
      const resultOn = checkTemporalEligibility(boundaryRule, onDay)
      expect(resultOn.eligible).toBe(false)
      expect(resultOn).toHaveProperty("reason", "EXPIRED")

      // Day after effectiveUntil should be expired
      const dayAfter = new Date("2025-06-16")
      const resultAfter = checkTemporalEligibility(boundaryRule, dayAfter)
      expect(resultAfter.eligible).toBe(false)
      expect(resultAfter).toHaveProperty("reason", "EXPIRED")
    })

    it("handles time component normalization", () => {
      const rule = {
        effectiveFrom: new Date("2025-06-15T12:00:00Z"),
        effectiveUntil: new Date("2025-06-30T18:30:00Z"),
      }

      // Should work regardless of time of day in query
      const morningQuery = new Date("2025-06-20T08:00:00Z")
      const eveningQuery = new Date("2025-06-20T22:00:00Z")

      expect(checkTemporalEligibility(rule, morningQuery).eligible).toBe(true)
      expect(checkTemporalEligibility(rule, eveningQuery).eligible).toBe(true)
    })
  })

  describe("checkConditionalEligibility", () => {
    it("accepts rules with no appliesWhen", () => {
      const rule = { appliesWhen: null }

      const result = checkConditionalEligibility(rule, baseContext)

      expect(result.eligible).toBe(true)
    })

    it('accepts rules with { op: "true" }', () => {
      const rule = { appliesWhen: JSON.stringify({ op: "true" }) }

      const result = checkConditionalEligibility(rule, baseContext)

      expect(result.eligible).toBe(true)
    })

    it('rejects rules with { op: "false" }', () => {
      const rule = { appliesWhen: JSON.stringify({ op: "false" }) }

      const result = checkConditionalEligibility(rule, baseContext)

      expect(result.eligible).toBe(false)
      expect(result).toHaveProperty("reason", "CONDITION_FALSE")
    })

    it("evaluates entity type conditions", () => {
      const obrtOnlyRule = {
        appliesWhen: JSON.stringify({
          op: "cmp",
          field: "entity.type",
          cmp: "eq",
          value: "OBRT",
        }),
      }

      const result = checkConditionalEligibility(obrtOnlyRule, baseContext)
      expect(result.eligible).toBe(true)

      const dooContext: EvaluationContext = {
        ...baseContext,
        entity: { ...baseContext.entity, type: "DOO" },
      }
      const resultDoo = checkConditionalEligibility(obrtOnlyRule, dooContext)
      expect(resultDoo.eligible).toBe(false)
      expect(resultDoo).toHaveProperty("reason", "CONDITION_FALSE")
    })

    it("returns MISSING_CONTEXT when required fields are absent", () => {
      const ruleNeedingRevenue = {
        appliesWhen: JSON.stringify({
          op: "cmp",
          field: "counters.revenueYtd",
          cmp: "gt",
          value: 50000,
        }),
      }

      // Context without counters
      const contextWithoutCounters: EvaluationContext = {
        ...baseContext,
        counters: undefined,
      }

      const result = checkConditionalEligibility(ruleNeedingRevenue, contextWithoutCounters)

      expect(result.eligible).toBe(false)
      expect(result).toHaveProperty("reason", "MISSING_CONTEXT")
    })

    it("evaluates complex AND conditions", () => {
      const complexRule = {
        appliesWhen: JSON.stringify({
          op: "and",
          args: [
            { op: "cmp", field: "entity.type", cmp: "eq", value: "OBRT" },
            { op: "cmp", field: "entity.obrtSubtype", cmp: "eq", value: "PAUSALNI" },
          ],
        }),
      }

      const result = checkConditionalEligibility(complexRule, baseContext)
      expect(result.eligible).toBe(true)
    })
  })

  describe("checkRuleEligibility (combined)", () => {
    it("rejects expired rules even with valid condition", () => {
      const rule = {
        id: "test-1",
        effectiveFrom: new Date("2020-01-01"),
        effectiveUntil: new Date("2024-12-31"),
        appliesWhen: JSON.stringify({ op: "true" }),
      }

      const result = checkRuleEligibility(rule, baseContext)

      expect(result.eligible).toBe(false)
      expect(result).toHaveProperty("reason", "EXPIRED")
    })

    it("rejects condition-false rules even with valid dates", () => {
      const rule = {
        id: "test-2",
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: null,
        appliesWhen: JSON.stringify({ op: "false" }),
      }

      const result = checkRuleEligibility(rule, baseContext)

      expect(result.eligible).toBe(false)
      expect(result).toHaveProperty("reason", "CONDITION_FALSE")
    })

    it("accepts fully eligible rules", () => {
      const rule = {
        id: "test-3",
        effectiveFrom: new Date("2024-01-01"),
        effectiveUntil: null,
        appliesWhen: JSON.stringify({
          op: "cmp",
          field: "entity.type",
          cmp: "eq",
          value: "OBRT",
        }),
      }

      const result = checkRuleEligibility(rule, baseContext)

      expect(result.eligible).toBe(true)
    })
  })

  describe("extractRequiredFields", () => {
    it("extracts fields from cmp operators", () => {
      const predicate = JSON.stringify({
        op: "cmp",
        field: "entity.type",
        cmp: "eq",
        value: "OBRT",
      })

      const fields = extractRequiredFields(predicate)

      expect(fields).toContain("entity.type")
    })

    it("extracts fields from nested AND/OR", () => {
      const predicate = JSON.stringify({
        op: "and",
        args: [
          { op: "cmp", field: "entity.type", cmp: "eq", value: "OBRT" },
          {
            op: "or",
            args: [
              { op: "cmp", field: "counters.revenueYtd", cmp: "gt", value: 50000 },
              { op: "exists", field: "txn.amount" },
            ],
          },
        ],
      })

      const fields = extractRequiredFields(predicate)

      expect(fields).toContain("entity.type")
      expect(fields).toContain("counters.revenueYtd")
      expect(fields).toContain("txn.amount")
    })

    it("returns empty set for null/invalid", () => {
      expect(extractRequiredFields(null).size).toBe(0)
      expect(extractRequiredFields("invalid json").size).toBe(0)
    })
  })

  describe("buildEvaluationContext", () => {
    it("builds context from company data", () => {
      const context = buildEvaluationContext({
        asOfDate: new Date("2025-06-15"),
        companyData: {
          legalForm: "OBRT_PAUSAL",
          vatStatus: "NO_PDV",
          revenueYtd: 45000,
        },
      })

      expect(context.entity.type).toBe("OBRT")
      expect(context.entity.obrtSubtype).toBe("PAUSALNI")
      expect(context.entity.vat.status).toBe("OUTSIDE_VAT")
      expect(context.counters?.revenueYtd).toBe(45000)
    })

    it("handles DOO legal form", () => {
      const context = buildEvaluationContext({
        companyData: { legalForm: "DOO" },
      })

      expect(context.entity.type).toBe("DOO")
    })

    it("handles JDOO legal form", () => {
      const context = buildEvaluationContext({
        companyData: { legalForm: "JDOO" },
      })

      expect(context.entity.type).toBe("JDOO")
    })

    it("sets default asOf to now if not provided", () => {
      const context = buildEvaluationContext({})

      expect(context.asOf).toBeDefined()
      const asOfDate = new Date(context.asOf)
      expect(asOfDate.getTime()).toBeCloseTo(Date.now(), -3) // Within 1 second
    })
  })
})
