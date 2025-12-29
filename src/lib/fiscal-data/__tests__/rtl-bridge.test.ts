// src/lib/fiscal-data/__tests__/rtl-bridge.test.ts

import { describe, it, expect } from "vitest"
import {
  FISCAL_DATA_POINT_MAPPINGS,
  getRTLDomainForDataPoint,
  getConceptIdForDataPoint,
  getDataPointsForDomain,
  getRTLSourcesForDataPoint,
  createAuditEntry,
  createChangeNotification,
  createContentSyncEvent,
  type RTLVerificationResult,
} from "../validator/rtl-bridge"

describe("RTL Bridge", () => {
  describe("FISCAL_DATA_POINT_MAPPINGS", () => {
    it("should have mappings for critical fiscal data points", () => {
      const criticalDataPoints = [
        "CONTRIBUTIONS.rates.MIO_I.rate",
        "CONTRIBUTIONS.rates.MIO_II.rate",
        "CONTRIBUTIONS.rates.HZZO.rate",
        "TAX_RATES.pausal.rate",
        "THRESHOLDS.pdv.value",
        "THRESHOLDS.pausalni.value",
      ]

      for (const dp of criticalDataPoints) {
        const mapping = FISCAL_DATA_POINT_MAPPINGS.find((m) => m.dataPoint === dp)
        expect(mapping, `Missing mapping for ${dp}`).toBeDefined()
        expect(mapping!.rtlDomain).toBeTruthy()
        expect(mapping!.conceptId).toBeTruthy()
      }
    })

    it("should assign correct priorities to critical data points", () => {
      const criticalMappings = FISCAL_DATA_POINT_MAPPINGS.filter((m) => m.priority === "critical")
      expect(criticalMappings.length).toBeGreaterThanOrEqual(5)

      // Contribution rates should be critical
      const mioIMapping = FISCAL_DATA_POINT_MAPPINGS.find(
        (m) => m.dataPoint === "CONTRIBUTIONS.rates.MIO_I.rate"
      )
      expect(mioIMapping?.priority).toBe("critical")
    })
  })

  describe("getRTLDomainForDataPoint", () => {
    it("should return correct domain for contribution rates", () => {
      expect(getRTLDomainForDataPoint("CONTRIBUTIONS.rates.MIO_I.rate")).toBe("doprinosi")
      expect(getRTLDomainForDataPoint("CONTRIBUTIONS.rates.HZZO.rate")).toBe("doprinosi")
    })

    it("should return correct domain for tax rates", () => {
      expect(getRTLDomainForDataPoint("TAX_RATES.pausal.rate")).toBe("pausalni")
      expect(getRTLDomainForDataPoint("TAX_RATES.vat.standard.rate")).toBe("pdv")
    })

    it("should return undefined for unknown data points", () => {
      expect(getRTLDomainForDataPoint("UNKNOWN.path")).toBeUndefined()
    })
  })

  describe("getConceptIdForDataPoint", () => {
    it("should return correct concept IDs", () => {
      expect(getConceptIdForDataPoint("CONTRIBUTIONS.rates.MIO_I.rate")).toBe("mirovinsko-i-stup")
      expect(getConceptIdForDataPoint("THRESHOLDS.pdv.value")).toBe("pdv-threshold")
      expect(getConceptIdForDataPoint("TAX_RATES.pausal.rate")).toBe("pausalni-tax-rate")
    })
  })

  describe("getDataPointsForDomain", () => {
    it("should return all data points for doprinosi domain", () => {
      const dataPoints = getDataPointsForDomain("doprinosi")
      expect(dataPoints).toContain("CONTRIBUTIONS.rates.MIO_I.rate")
      expect(dataPoints).toContain("CONTRIBUTIONS.rates.MIO_II.rate")
      expect(dataPoints).toContain("CONTRIBUTIONS.rates.HZZO.rate")
    })

    it("should return empty array for unknown domain", () => {
      expect(getDataPointsForDomain("unknown-domain")).toHaveLength(0)
    })
  })

  describe("getRTLSourcesForDataPoint", () => {
    it("should return RTL sources for contribution data points", () => {
      const sources = getRTLSourcesForDataPoint("CONTRIBUTIONS.rates.MIO_I.rate")
      expect(sources.length).toBeGreaterThan(0)
      expect(sources.some((s) => s.domains.includes("doprinosi"))).toBe(true)
    })
  })

  describe("createAuditEntry", () => {
    it("should create valid audit entry", () => {
      const mockResult: RTLVerificationResult = {
        dataPoint: "CONTRIBUTIONS.rates.MIO_I.rate",
        currentValue: 0.15,
        foundValue: 0.16,
        status: "mismatch",
        confidence: 0.95,
        sourceUrl: "https://example.com/source",
        extractedText: "MIO I. stup 16%",
        checkedAt: new Date().toISOString(),
        sourcePointerIds: ["sp-1", "sp-2"],
        evidenceIds: ["ev-1"],
        hasRTLData: true,
      }

      const entry = createAuditEntry(mockResult, 0.15)

      expect(entry.id).toMatch(/^audit-/)
      expect(entry.dataPoint).toBe("CONTRIBUTIONS.rates.MIO_I.rate")
      expect(entry.previousValue).toBe(0.15)
      expect(entry.newValue).toBe(0.16)
      expect(entry.confidence).toBe(0.95)
      expect(entry.sourcePointerIds).toEqual(["sp-1", "sp-2"])
      expect(entry.changedBy).toBe("rtl-automated")
      // High confidence changes should be auto-approved
      expect(entry.status).toBe("approved")
    })

    it("should set status to pending for low confidence changes", () => {
      const mockResult: RTLVerificationResult = {
        dataPoint: "CONTRIBUTIONS.rates.MIO_I.rate",
        currentValue: 0.15,
        foundValue: 0.16,
        status: "mismatch",
        confidence: 0.7, // Below 0.95 threshold
        sourceUrl: "https://example.com/source",
        checkedAt: new Date().toISOString(),
        sourcePointerIds: [],
        evidenceIds: [],
        hasRTLData: true,
      }

      const entry = createAuditEntry(mockResult, 0.15)
      expect(entry.status).toBe("pending")
    })
  })

  describe("createChangeNotification", () => {
    it("should return null when no changes detected", () => {
      const results: RTLVerificationResult[] = [
        {
          dataPoint: "CONTRIBUTIONS.rates.MIO_I.rate",
          currentValue: 0.15,
          foundValue: 0.15,
          status: "match",
          confidence: 1.0,
          sourceUrl: "https://example.com",
          checkedAt: new Date().toISOString(),
          sourcePointerIds: [],
          evidenceIds: [],
          hasRTLData: true,
        },
      ]

      const notification = createChangeNotification(results)
      expect(notification).toBeNull()
    })

    it("should create breaking notification for critical changes", () => {
      const results: RTLVerificationResult[] = [
        {
          dataPoint: "CONTRIBUTIONS.rates.MIO_I.rate", // Critical priority
          currentValue: 0.15,
          foundValue: 0.16,
          status: "mismatch",
          confidence: 0.95,
          sourceUrl: "https://example.com",
          checkedAt: new Date().toISOString(),
          sourcePointerIds: ["sp-1"],
          evidenceIds: ["ev-1"],
          hasRTLData: true,
        },
      ]

      const notification = createChangeNotification(results)
      expect(notification).not.toBeNull()
      expect(notification!.severity).toBe("breaking")
      expect(notification!.type).toBe("change_detected")
    })
  })

  describe("createContentSyncEvent", () => {
    it("should create valid content sync event", () => {
      const mockResult: RTLVerificationResult = {
        dataPoint: "THRESHOLDS.pdv.value",
        currentValue: 60000,
        foundValue: 65000,
        status: "mismatch",
        confidence: 0.95,
        sourceUrl: "https://example.com/pdv",
        checkedAt: new Date().toISOString(),
        sourcePointerIds: ["sp-1", "sp-2"],
        evidenceIds: ["ev-1"],
        hasRTLData: true,
        ruleId: "rule-123",
      }

      const event = createContentSyncEvent(mockResult, 60000)

      expect(event).not.toBeNull()
      expect(event!.version).toBe(1)
      expect(event!.conceptId).toBe("pdv-threshold")
      expect(event!.changeType).toBe("update")
      expect(event!.previousValue).toBe("60000")
      expect(event!.newValue).toBe("65000")
      expect(event!.valueType).toBe("threshold")
      expect(event!.sourcePointerIds).toEqual(["sp-1", "sp-2"])
      expect(event!.confidenceLevel).toBe(95)
    })

    it("should return null for unknown data points", () => {
      const mockResult: RTLVerificationResult = {
        dataPoint: "UNKNOWN.data.point",
        currentValue: 100,
        foundValue: 200,
        status: "mismatch",
        confidence: 0.95,
        sourceUrl: "https://example.com",
        checkedAt: new Date().toISOString(),
        sourcePointerIds: [],
        evidenceIds: [],
        hasRTLData: false,
      }

      const event = createContentSyncEvent(mockResult, 100)
      expect(event).toBeNull()
    })

    it("should set correct severity for critical priority changes", () => {
      const mockResult: RTLVerificationResult = {
        dataPoint: "CONTRIBUTIONS.rates.MIO_I.rate", // Critical priority
        currentValue: 0.15,
        foundValue: 0.16,
        status: "mismatch",
        confidence: 0.95,
        sourceUrl: "https://example.com",
        checkedAt: new Date().toISOString(),
        sourcePointerIds: ["sp-1"],
        evidenceIds: ["ev-1"],
        hasRTLData: true,
      }

      const event = createContentSyncEvent(mockResult, 0.15)
      expect(event).not.toBeNull()
      expect(event!.severity).toBe("breaking")
    })
  })
})
