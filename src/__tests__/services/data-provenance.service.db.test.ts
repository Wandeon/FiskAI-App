// src/__tests__/services/data-provenance.service.db.test.ts

/**
 * Database tests for DataProvenanceService
 *
 * These tests require a real database connection and verify the service
 * correctly records, retrieves, and updates data provenance records.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { db } from "@/lib/db"
import {
  DataProvenanceService,
  dataProvenanceService,
  DataSource,
  ConfidenceLevel,
} from "@/lib/services/data-provenance.service"

// Skip tests if DATABASE_URL is not set (e.g., in CI without DB)
const skipIfNoDb = process.env.DATABASE_URL ? describe : describe.skip

skipIfNoDb("DataProvenanceService DB Tests", () => {
  let service: DataProvenanceService
  const testEntityType = "TestEntity"
  const testEntityId = `test-entity-${Date.now()}`
  const testEntityId2 = `test-entity-2-${Date.now()}`

  beforeAll(async () => {
    service = new DataProvenanceService()
  })

  afterAll(async () => {
    // Cleanup all test provenance records
    await db.dataProvenance.deleteMany({
      where: {
        entityType: testEntityType,
      },
    })
    await db.$disconnect()
  })

  beforeEach(async () => {
    // Clean provenance records before each test
    await db.dataProvenance.deleteMany({
      where: {
        entityType: testEntityType,
      },
    })
  })

  // ===========================================================================
  // recordProvenance
  // ===========================================================================

  describe("recordProvenance", () => {
    it("creates a new provenance record", async () => {
      const result = await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "address",
        source: DataSource.REGISTRY_LOOKUP,
        confidence: 0.95,
        sourceRef: "sudski-registar:12345",
      })

      expect(result).toBeDefined()
      expect(result.entityType).toBe(testEntityType)
      expect(result.entityId).toBe(testEntityId)
      expect(result.field).toBe("address")
      expect(result.source).toBe(DataSource.REGISTRY_LOOKUP)
      expect(result.confidence).toBe(0.95)
      expect(result.sourceRef).toBe("sudski-registar:12345")
      expect(result.capturedAt).toBeInstanceOf(Date)

      // Verify it was saved to database
      const dbRecord = await db.dataProvenance.findUnique({
        where: {
          entityType_entityId_field: {
            entityType: testEntityType,
            entityId: testEntityId,
            field: "address",
          },
        },
      })
      expect(dbRecord).not.toBeNull()
      expect(dbRecord!.source).toBe(DataSource.REGISTRY_LOOKUP)
    })

    it("creates provenance without confidence (manual entry)", async () => {
      const result = await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "notes",
        source: DataSource.MANUAL,
      })

      expect(result.source).toBe(DataSource.MANUAL)
      expect(result.confidence).toBeNull()
      expect(result.sourceRef).toBeNull()
    })

    it("upserts existing provenance record", async () => {
      // First record
      await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "name",
        source: DataSource.DOCUMENT_PARSE,
        confidence: 0.85,
      })

      // Upsert with new values
      const result = await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "name",
        source: DataSource.REGISTRY_LOOKUP,
        confidence: 0.98,
        sourceRef: "updated-ref",
      })

      expect(result.source).toBe(DataSource.REGISTRY_LOOKUP)
      expect(result.confidence).toBe(0.98)
      expect(result.sourceRef).toBe("updated-ref")

      // Verify only one record exists
      const count = await db.dataProvenance.count({
        where: {
          entityType: testEntityType,
          entityId: testEntityId,
          field: "name",
        },
      })
      expect(count).toBe(1)
    })

    it("throws error for invalid confidence value", async () => {
      await expect(
        service.recordProvenance({
          entityType: testEntityType,
          entityId: testEntityId,
          field: "test",
          source: DataSource.MANUAL,
          confidence: 1.5, // Invalid - greater than 1
        })
      ).rejects.toThrow("Invalid confidence value")

      await expect(
        service.recordProvenance({
          entityType: testEntityType,
          entityId: testEntityId,
          field: "test",
          source: DataSource.MANUAL,
          confidence: -0.1, // Invalid - negative
        })
      ).rejects.toThrow("Invalid confidence value")
    })
  })

  // ===========================================================================
  // recordMultipleProvenance
  // ===========================================================================

  describe("recordMultipleProvenance", () => {
    it("records multiple fields at once", async () => {
      const result = await service.recordMultipleProvenance(testEntityType, testEntityId, [
        { field: "name", source: DataSource.REGISTRY_LOOKUP, confidence: 0.98 },
        { field: "address", source: DataSource.REGISTRY_LOOKUP, confidence: 0.95 },
        { field: "oib", source: DataSource.MANUAL, confidence: 1.0 },
      ])

      expect(Object.keys(result)).toHaveLength(3)
      expect(result.name.source).toBe(DataSource.REGISTRY_LOOKUP)
      expect(result.name.confidence).toBe(0.98)
      expect(result.address.source).toBe(DataSource.REGISTRY_LOOKUP)
      expect(result.address.confidence).toBe(0.95)
      expect(result.oib.source).toBe(DataSource.MANUAL)
      expect(result.oib.confidence).toBe(1.0)
    })

    it("handles empty fields array", async () => {
      const result = await service.recordMultipleProvenance(testEntityType, testEntityId, [])
      expect(Object.keys(result)).toHaveLength(0)
    })

    it("throws error if any field has invalid confidence", async () => {
      await expect(
        service.recordMultipleProvenance(testEntityType, testEntityId, [
          { field: "name", source: DataSource.REGISTRY_LOOKUP, confidence: 0.9 },
          { field: "address", source: DataSource.REGISTRY_LOOKUP, confidence: 1.5 }, // Invalid
        ])
      ).rejects.toThrow("Invalid confidence value for field 'address'")
    })
  })

  // ===========================================================================
  // updateProvenance
  // ===========================================================================

  describe("updateProvenance", () => {
    it("updates existing provenance when user edits", async () => {
      // First, record auto-filled provenance
      await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "address",
        source: DataSource.REGISTRY_LOOKUP,
        confidence: 0.95,
      })

      // User edits the field
      const result = await service.updateProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "address",
        source: DataSource.MANUAL,
        confidence: 1.0,
      })

      expect(result).not.toBeNull()
      expect(result!.source).toBe(DataSource.MANUAL)
      expect(result!.confidence).toBe(1.0)
    })

    it("returns null for non-existent provenance", async () => {
      const result = await service.updateProvenance({
        entityType: testEntityType,
        entityId: "non-existent-id",
        field: "address",
        source: DataSource.MANUAL,
      })

      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // getProvenance
  // ===========================================================================

  describe("getProvenance", () => {
    it("retrieves single field provenance", async () => {
      await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "email",
        source: DataSource.DOCUMENT_PARSE,
        confidence: 0.88,
        sourceRef: "obrtnica.pdf",
      })

      const result = await service.getProvenance(testEntityType, testEntityId, "email")

      expect(result).not.toBeNull()
      expect(result!.field).toBe("email")
      expect(result!.source).toBe(DataSource.DOCUMENT_PARSE)
      expect(result!.confidence).toBe(0.88)
      expect(result!.sourceRef).toBe("obrtnica.pdf")
    })

    it("returns null for non-existent provenance", async () => {
      const result = await service.getProvenance(testEntityType, testEntityId, "non-existent-field")
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // getAllProvenance
  // ===========================================================================

  describe("getAllProvenance", () => {
    it("retrieves all provenance for an entity", async () => {
      // Create multiple provenance records
      await service.recordMultipleProvenance(testEntityType, testEntityId, [
        { field: "name", source: DataSource.REGISTRY_LOOKUP, confidence: 0.98 },
        { field: "address", source: DataSource.REGISTRY_LOOKUP, confidence: 0.95 },
        { field: "phone", source: DataSource.MANUAL },
      ])

      const result = await service.getAllProvenance(testEntityType, testEntityId)

      expect(Object.keys(result)).toHaveLength(3)
      expect(result.name).toBeDefined()
      expect(result.address).toBeDefined()
      expect(result.phone).toBeDefined()
    })

    it("returns empty map for entity with no provenance", async () => {
      const result = await service.getAllProvenance(testEntityType, "entity-with-no-provenance")
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  // ===========================================================================
  // getBulkProvenance
  // ===========================================================================

  describe("getBulkProvenance", () => {
    it("retrieves provenance for multiple entities", async () => {
      // Create provenance for two entities
      await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId,
        field: "name",
        source: DataSource.REGISTRY_LOOKUP,
        confidence: 0.9,
      })

      await service.recordProvenance({
        entityType: testEntityType,
        entityId: testEntityId2,
        field: "address",
        source: DataSource.DOCUMENT_PARSE,
        confidence: 0.85,
      })

      const result = await service.getBulkProvenance(testEntityType, [testEntityId, testEntityId2])

      expect(result[testEntityId]).toBeDefined()
      expect(result[testEntityId].name).toBeDefined()
      expect(result[testEntityId2]).toBeDefined()
      expect(result[testEntityId2].address).toBeDefined()
    })

    it("returns empty maps for entities with no provenance", async () => {
      const result = await service.getBulkProvenance(testEntityType, ["no-prov-1", "no-prov-2"])

      expect(result["no-prov-1"]).toEqual({})
      expect(result["no-prov-2"]).toEqual({})
    })

    it("handles empty entity IDs array", async () => {
      const result = await service.getBulkProvenance(testEntityType, [])
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  // ===========================================================================
  // getProvenanceDisplay
  // ===========================================================================

  describe("getProvenanceDisplay", () => {
    it("generates display text for registry lookup with high confidence", () => {
      const display = service.getProvenanceDisplay(DataSource.REGISTRY_LOOKUP, 0.95)

      expect(display.sourceLabel).toBe("Iz sudskog registra")
      expect(display.confidenceText).toBe("95%")
      expect(display.fullText).toBe("Iz sudskog registra (95% pouzdanost)")
      expect(display.confidenceLevel).toBe(ConfidenceLevel.HIGH)
      expect(display.isManual).toBe(false)
      expect(display.isSystem).toBe(false)
    })

    it("generates display text for document parse with medium confidence", () => {
      const display = service.getProvenanceDisplay(DataSource.DOCUMENT_PARSE, 0.75)

      expect(display.sourceLabel).toBe("Iz dokumenta")
      expect(display.confidenceText).toBe("75%")
      expect(display.confidenceLevel).toBe(ConfidenceLevel.MEDIUM)
    })

    it("generates display text for low confidence", () => {
      const display = service.getProvenanceDisplay(DataSource.AUTO_MATCH, 0.55)

      expect(display.confidenceText).toBe("55%")
      expect(display.confidenceLevel).toBe(ConfidenceLevel.LOW)
    })

    it("generates display text for manual entry without confidence", () => {
      const display = service.getProvenanceDisplay(DataSource.MANUAL)

      expect(display.sourceLabel).toBe("Ručni unos")
      expect(display.confidenceText).toBeNull()
      expect(display.fullText).toBe("Ručni unos")
      expect(display.confidenceLevel).toBeNull()
      expect(display.isManual).toBe(true)
    })

    it("generates display text for system-generated", () => {
      const display = service.getProvenanceDisplay(DataSource.SYSTEM, 1.0)

      expect(display.sourceLabel).toBe("Automatski generirano")
      expect(display.fullText).toBe("Automatski generirano")
      expect(display.isSystem).toBe(true)
    })

    it("handles unknown source", () => {
      const display = service.getProvenanceDisplay("custom_source", 0.8)

      expect(display.sourceLabel).toBe("Izvor: custom_source")
      expect(display.fullText).toBe("Izvor: custom_source (80% pouzdanost)")
    })

    it("handles bank statement source", () => {
      const display = service.getProvenanceDisplay(DataSource.BANK_STATEMENT, 0.99)

      expect(display.sourceLabel).toBe("Iz bankovnog izvoda")
      expect(display.confidenceLevel).toBe(ConfidenceLevel.HIGH)
    })
  })

  // ===========================================================================
  // getConfidenceLevel
  // ===========================================================================

  describe("getConfidenceLevel", () => {
    it("returns HIGH for confidence >= 0.9", () => {
      expect(service.getConfidenceLevel(0.9)).toBe(ConfidenceLevel.HIGH)
      expect(service.getConfidenceLevel(0.95)).toBe(ConfidenceLevel.HIGH)
      expect(service.getConfidenceLevel(1.0)).toBe(ConfidenceLevel.HIGH)
    })

    it("returns MEDIUM for confidence >= 0.7 and < 0.9", () => {
      expect(service.getConfidenceLevel(0.7)).toBe(ConfidenceLevel.MEDIUM)
      expect(service.getConfidenceLevel(0.8)).toBe(ConfidenceLevel.MEDIUM)
      expect(service.getConfidenceLevel(0.89)).toBe(ConfidenceLevel.MEDIUM)
    })

    it("returns LOW for confidence < 0.7", () => {
      expect(service.getConfidenceLevel(0.5)).toBe(ConfidenceLevel.LOW)
      expect(service.getConfidenceLevel(0.69)).toBe(ConfidenceLevel.LOW)
      expect(service.getConfidenceLevel(0.0)).toBe(ConfidenceLevel.LOW)
    })
  })

  // ===========================================================================
  // deleteEntityProvenance
  // ===========================================================================

  describe("deleteEntityProvenance", () => {
    it("deletes all provenance for an entity", async () => {
      // Create multiple provenance records
      await service.recordMultipleProvenance(testEntityType, testEntityId, [
        { field: "name", source: DataSource.MANUAL },
        { field: "address", source: DataSource.MANUAL },
        { field: "phone", source: DataSource.MANUAL },
      ])

      const deleteCount = await service.deleteEntityProvenance(testEntityType, testEntityId)

      expect(deleteCount).toBe(3)

      // Verify deletion
      const remaining = await service.getAllProvenance(testEntityType, testEntityId)
      expect(Object.keys(remaining)).toHaveLength(0)
    })

    it("returns 0 for entity with no provenance", async () => {
      const deleteCount = await service.deleteEntityProvenance(testEntityType, "no-provenance-id")
      expect(deleteCount).toBe(0)
    })
  })

  // ===========================================================================
  // deleteFieldProvenance
  // ===========================================================================

  describe("deleteFieldProvenance", () => {
    it("deletes specific field provenance", async () => {
      await service.recordMultipleProvenance(testEntityType, testEntityId, [
        { field: "name", source: DataSource.MANUAL },
        { field: "address", source: DataSource.MANUAL },
      ])

      const deleted = await service.deleteFieldProvenance(testEntityType, testEntityId, "name")

      expect(deleted).toBe(true)

      // Verify only name was deleted
      const remaining = await service.getAllProvenance(testEntityType, testEntityId)
      expect(Object.keys(remaining)).toHaveLength(1)
      expect(remaining.address).toBeDefined()
      expect(remaining.name).toBeUndefined()
    })

    it("returns false for non-existent field", async () => {
      const deleted = await service.deleteFieldProvenance(
        testEntityType,
        testEntityId,
        "non-existent"
      )
      expect(deleted).toBe(false)
    })
  })

  // ===========================================================================
  // Singleton
  // ===========================================================================

  describe("singleton export", () => {
    it("exports a singleton instance", () => {
      expect(dataProvenanceService).toBeInstanceOf(DataProvenanceService)
    })

    it("singleton works correctly", () => {
      const display = dataProvenanceService.getProvenanceDisplay(DataSource.MANUAL)
      expect(display.sourceLabel).toBe("Ručni unos")
    })
  })
})
