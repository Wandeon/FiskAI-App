// src/lib/services/data-provenance.service.ts

/**
 * DataProvenanceService
 *
 * Tracks the source of every field for accountability. This is part of the
 * "Zero Redundant Input with Accountability" design principle.
 *
 * Data Intelligence Hierarchy:
 * 1. AUTOMATIC - System knows -> shows it with source + confidence
 * 2. SUGGESTED - System guesses -> user confirms with one click
 * 3. ASSISTED - System helps -> user picks from options
 * 4. MANUAL (last resort) - System can't help -> user types
 *
 * Every auto-filled field shows: source, confidence, "Edit" option
 *
 * @example
 * import { dataProvenanceService, DataSource } from '@/lib/services/data-provenance.service'
 *
 * // Record provenance when auto-filling from OIB lookup
 * await dataProvenanceService.recordProvenance({
 *   entityType: 'Contact',
 *   entityId: newContact.id,
 *   field: 'address',
 *   source: DataSource.REGISTRY_LOOKUP,
 *   confidence: 0.95,
 *   sourceRef: `oib-lookup:${oib}:${timestamp}`
 * })
 *
 * // Get provenance for display in UI
 * const provenance = await dataProvenanceService.getProvenance('Contact', 'contact-123', 'address')
 * const displayText = dataProvenanceService.getProvenanceDisplay(provenance.source, provenance.confidence)
 * // "Iz sudskog registra (95% pouzdanost)"
 */

import { db } from "@/lib/db"
import type { DataProvenance } from "@prisma/client"

// =============================================================================
// TYPES
// =============================================================================

/**
 * Data source types - identifies where data came from
 */
export enum DataSource {
  /** From OIB/court registry lookup */
  REGISTRY_LOOKUP = "registry_lookup",
  /** From uploaded document (Obrtnica, etc.) */
  DOCUMENT_PARSE = "document_parse",
  /** From bank transaction/statement */
  BANK_STATEMENT = "bank_statement",
  /** User typed it manually */
  MANUAL = "manual",
  /** System-generated (invoice numbers, etc.) */
  SYSTEM = "system",
  /** Auto-matched (payment reconciliation) */
  AUTO_MATCH = "auto_match",
}

/**
 * Confidence level ranges for categorization
 */
export enum ConfidenceLevel {
  HIGH = "HIGH", // >= 0.9
  MEDIUM = "MEDIUM", // >= 0.7
  LOW = "LOW", // < 0.7
}

/**
 * Parameters for recording provenance
 */
export interface RecordProvenanceParams {
  /** Entity type (e.g., 'Contact', 'Invoice', 'Company') */
  entityType: string
  /** Entity ID */
  entityId: string
  /** Field name (e.g., 'address', 'name', 'oib') */
  field: string
  /** Data source */
  source: DataSource | string
  /** Confidence score (0.0 - 1.0), optional for manual entries */
  confidence?: number
  /** External reference (e.g., 'oib-lookup:12345678901:2025-01-18') */
  sourceRef?: string
}

/**
 * Parameters for updating provenance
 */
export interface UpdateProvenanceParams {
  /** Entity type */
  entityType: string
  /** Entity ID */
  entityId: string
  /** Field name */
  field: string
  /** New source (typically 'manual' when user edits) */
  source: DataSource | string
  /** New confidence (typically 1.0 when user confirms) */
  confidence?: number
  /** New source reference */
  sourceRef?: string
}

/**
 * Provenance information for a single field
 */
export interface FieldProvenance {
  id: string
  entityType: string
  entityId: string
  field: string
  source: string
  confidence: number | null
  sourceRef: string | null
  capturedAt: Date
}

/**
 * Map of field names to their provenance
 */
export type EntityProvenanceMap = Record<string, FieldProvenance>

/**
 * Display information for provenance
 */
export interface ProvenanceDisplay {
  /** Localized source label (Croatian) */
  sourceLabel: string
  /** Confidence percentage string (e.g., "95%") */
  confidenceText: string | null
  /** Full display text (e.g., "Iz sudskog registra (95% pouzdanost)") */
  fullText: string
  /** Confidence level category */
  confidenceLevel: ConfidenceLevel | null
  /** Whether this was manually entered */
  isManual: boolean
  /** Whether this was system-generated */
  isSystem: boolean
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Source labels in Croatian
 */
const SOURCE_LABELS: Record<string, string> = {
  [DataSource.REGISTRY_LOOKUP]: "Iz sudskog registra",
  [DataSource.DOCUMENT_PARSE]: "Iz dokumenta",
  [DataSource.BANK_STATEMENT]: "Iz bankovnog izvoda",
  [DataSource.MANUAL]: "Ručni unos",
  [DataSource.SYSTEM]: "Automatski generirano",
  [DataSource.AUTO_MATCH]: "Automatski spojeno",
}

/**
 * Confidence thresholds
 */
const HIGH_CONFIDENCE_THRESHOLD = 0.9
const MEDIUM_CONFIDENCE_THRESHOLD = 0.7

// =============================================================================
// SERVICE CLASS
// =============================================================================

/**
 * DataProvenanceService
 *
 * Tracks and manages data provenance for accountability.
 */
export class DataProvenanceService {
  // ===========================================================================
  // PUBLIC API - RECORD & UPDATE
  // ===========================================================================

  /**
   * Record provenance for a field value
   *
   * Uses upsert to handle both new and existing provenance records.
   *
   * @param params - Provenance parameters
   * @returns The created/updated provenance record
   *
   * @example
   * await dataProvenanceService.recordProvenance({
   *   entityType: 'Contact',
   *   entityId: 'contact_123',
   *   field: 'address',
   *   source: DataSource.REGISTRY_LOOKUP,
   *   confidence: 0.95,
   *   sourceRef: 'sudski-registar:12345'
   * })
   */
  async recordProvenance(params: RecordProvenanceParams): Promise<FieldProvenance> {
    const { entityType, entityId, field, source, confidence, sourceRef } = params

    // Validate confidence if provided
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      throw new Error(`Invalid confidence value: ${confidence}. Must be between 0.0 and 1.0`)
    }

    const provenance = await db.dataProvenance.upsert({
      where: {
        entityType_entityId_field: {
          entityType,
          entityId,
          field,
        },
      },
      update: {
        source,
        confidence: confidence ?? null,
        sourceRef: sourceRef ?? null,
        capturedAt: new Date(),
      },
      create: {
        entityType,
        entityId,
        field,
        source,
        confidence: confidence ?? null,
        sourceRef: sourceRef ?? null,
      },
    })

    return this.mapToFieldProvenance(provenance)
  }

  /**
   * Record provenance for multiple fields at once
   *
   * Useful when auto-filling multiple fields from a single source.
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param fields - Array of field provenance data
   * @returns Map of field names to their provenance
   *
   * @example
   * await dataProvenanceService.recordMultipleProvenance('Contact', 'contact_123', [
   *   { field: 'name', source: DataSource.REGISTRY_LOOKUP, confidence: 0.98 },
   *   { field: 'address', source: DataSource.REGISTRY_LOOKUP, confidence: 0.95 },
   *   { field: 'oib', source: DataSource.MANUAL, confidence: 1.0 },
   * ])
   */
  async recordMultipleProvenance(
    entityType: string,
    entityId: string,
    fields: Array<{
      field: string
      source: DataSource | string
      confidence?: number
      sourceRef?: string
    }>
  ): Promise<EntityProvenanceMap> {
    const results: EntityProvenanceMap = {}

    // Use transaction for atomicity
    await db.$transaction(async (tx) => {
      for (const fieldData of fields) {
        // Validate confidence if provided
        if (
          fieldData.confidence !== undefined &&
          (fieldData.confidence < 0 || fieldData.confidence > 1)
        ) {
          throw new Error(
            `Invalid confidence value for field '${fieldData.field}': ${fieldData.confidence}. Must be between 0.0 and 1.0`
          )
        }

        const provenance = await tx.dataProvenance.upsert({
          where: {
            entityType_entityId_field: {
              entityType,
              entityId,
              field: fieldData.field,
            },
          },
          update: {
            source: fieldData.source,
            confidence: fieldData.confidence ?? null,
            sourceRef: fieldData.sourceRef ?? null,
            capturedAt: new Date(),
          },
          create: {
            entityType,
            entityId,
            field: fieldData.field,
            source: fieldData.source,
            confidence: fieldData.confidence ?? null,
            sourceRef: fieldData.sourceRef ?? null,
          },
        })

        results[fieldData.field] = this.mapToFieldProvenance(provenance)
      }
    })

    return results
  }

  /**
   * Update provenance when source changes (e.g., user edits auto-filled value)
   *
   * @param params - Update parameters
   * @returns The updated provenance record, or null if not found
   *
   * @example
   * // User edited an auto-filled address
   * await dataProvenanceService.updateProvenance({
   *   entityType: 'Contact',
   *   entityId: 'contact_123',
   *   field: 'address',
   *   source: DataSource.MANUAL,
   *   confidence: 1.0,
   * })
   */
  async updateProvenance(params: UpdateProvenanceParams): Promise<FieldProvenance | null> {
    const { entityType, entityId, field, source, confidence, sourceRef } = params

    // Validate confidence if provided
    if (confidence !== undefined && (confidence < 0 || confidence > 1)) {
      throw new Error(`Invalid confidence value: ${confidence}. Must be between 0.0 and 1.0`)
    }

    try {
      const provenance = await db.dataProvenance.update({
        where: {
          entityType_entityId_field: {
            entityType,
            entityId,
            field,
          },
        },
        data: {
          source,
          confidence: confidence ?? null,
          sourceRef: sourceRef ?? null,
          capturedAt: new Date(),
        },
      })

      return this.mapToFieldProvenance(provenance)
    } catch {
      // Record not found
      return null
    }
  }

  // ===========================================================================
  // PUBLIC API - QUERY
  // ===========================================================================

  /**
   * Get provenance for a specific field
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param field - Field name
   * @returns Provenance information or null if not found
   *
   * @example
   * const provenance = await dataProvenanceService.getProvenance('Contact', 'contact_123', 'address')
   * // { source: 'registry_lookup', confidence: 0.95, ... }
   */
  async getProvenance(
    entityType: string,
    entityId: string,
    field: string
  ): Promise<FieldProvenance | null> {
    const provenance = await db.dataProvenance.findUnique({
      where: {
        entityType_entityId_field: {
          entityType,
          entityId,
          field,
        },
      },
    })

    return provenance ? this.mapToFieldProvenance(provenance) : null
  }

  /**
   * Get all provenance for an entity
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns Map of field names to their provenance
   *
   * @example
   * const allProvenance = await dataProvenanceService.getAllProvenance('Contact', 'contact_123')
   * // { address: {...}, name: {...}, oib: {...} }
   */
  async getAllProvenance(entityType: string, entityId: string): Promise<EntityProvenanceMap> {
    const provenances = await db.dataProvenance.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: {
        capturedAt: "desc",
      },
    })

    const result: EntityProvenanceMap = {}
    for (const p of provenances) {
      result[p.field] = this.mapToFieldProvenance(p)
    }

    return result
  }

  /**
   * Get provenance for multiple entities at once
   *
   * Useful for list views where you need provenance for many items.
   *
   * @param entityType - Entity type
   * @param entityIds - Array of entity IDs
   * @returns Map of entity IDs to their provenance maps
   *
   * @example
   * const provenance = await dataProvenanceService.getBulkProvenance('Contact', ['c1', 'c2', 'c3'])
   * // { 'c1': { address: {...} }, 'c2': { name: {...} }, ... }
   */
  async getBulkProvenance(
    entityType: string,
    entityIds: string[]
  ): Promise<Record<string, EntityProvenanceMap>> {
    if (entityIds.length === 0) {
      return {}
    }

    const provenances = await db.dataProvenance.findMany({
      where: {
        entityType,
        entityId: { in: entityIds },
      },
      orderBy: {
        capturedAt: "desc",
      },
    })

    const result: Record<string, EntityProvenanceMap> = {}

    // Initialize empty maps for all requested IDs
    for (const id of entityIds) {
      result[id] = {}
    }

    // Populate with actual data
    for (const p of provenances) {
      if (!result[p.entityId]) {
        result[p.entityId] = {}
      }
      result[p.entityId][p.field] = this.mapToFieldProvenance(p)
    }

    return result
  }

  // ===========================================================================
  // PUBLIC API - DISPLAY
  // ===========================================================================

  /**
   * Get user-friendly display text for provenance
   *
   * @param source - Data source
   * @param confidence - Confidence score (0.0 - 1.0)
   * @returns Localized display text
   *
   * @example
   * const display = dataProvenanceService.getProvenanceDisplay('registry_lookup', 0.95)
   * // "Iz sudskog registra (95% pouzdanost)"
   *
   * const manualDisplay = dataProvenanceService.getProvenanceDisplay('manual')
   * // "Ručni unos"
   */
  getProvenanceDisplay(source: DataSource | string, confidence?: number | null): ProvenanceDisplay {
    const sourceLabel = SOURCE_LABELS[source] ?? `Izvor: ${source}`
    const isManual = source === DataSource.MANUAL
    const isSystem = source === DataSource.SYSTEM

    let confidenceText: string | null = null
    let confidenceLevel: ConfidenceLevel | null = null

    if (confidence !== undefined && confidence !== null) {
      const percentage = Math.round(confidence * 100)
      confidenceText = `${percentage}%`
      confidenceLevel = this.getConfidenceLevel(confidence)
    }

    // Build full text
    let fullText = sourceLabel
    if (confidenceText && !isManual && !isSystem) {
      fullText = `${sourceLabel} (${confidenceText} pouzdanost)`
    }

    return {
      sourceLabel,
      confidenceText,
      fullText,
      confidenceLevel,
      isManual,
      isSystem,
    }
  }

  /**
   * Get confidence level category
   *
   * @param confidence - Confidence score (0.0 - 1.0)
   * @returns Confidence level (HIGH, MEDIUM, LOW)
   */
  getConfidenceLevel(confidence: number): ConfidenceLevel {
    if (confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      return ConfidenceLevel.HIGH
    }
    if (confidence >= MEDIUM_CONFIDENCE_THRESHOLD) {
      return ConfidenceLevel.MEDIUM
    }
    return ConfidenceLevel.LOW
  }

  // ===========================================================================
  // PUBLIC API - CLEANUP
  // ===========================================================================

  /**
   * Delete all provenance for an entity
   *
   * Use when deleting an entity to clean up associated provenance records.
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @returns Number of deleted records
   */
  async deleteEntityProvenance(entityType: string, entityId: string): Promise<number> {
    const result = await db.dataProvenance.deleteMany({
      where: {
        entityType,
        entityId,
      },
    })

    return result.count
  }

  /**
   * Delete provenance for a specific field
   *
   * @param entityType - Entity type
   * @param entityId - Entity ID
   * @param field - Field name
   * @returns true if deleted, false if not found
   */
  async deleteFieldProvenance(
    entityType: string,
    entityId: string,
    field: string
  ): Promise<boolean> {
    try {
      await db.dataProvenance.delete({
        where: {
          entityType_entityId_field: {
            entityType,
            entityId,
            field,
          },
        },
      })
      return true
    } catch {
      return false
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Map Prisma DataProvenance to FieldProvenance
   */
  private mapToFieldProvenance(provenance: DataProvenance): FieldProvenance {
    return {
      id: provenance.id,
      entityType: provenance.entityType,
      entityId: provenance.entityId,
      field: provenance.field,
      source: provenance.source,
      confidence: provenance.confidence,
      sourceRef: provenance.sourceRef,
      capturedAt: provenance.capturedAt,
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

/**
 * Singleton instance of DataProvenanceService
 *
 * @example
 * import { dataProvenanceService } from '@/lib/services/data-provenance.service'
 *
 * const provenance = await dataProvenanceService.getProvenance('Contact', 'c1', 'address')
 */
export const dataProvenanceService = new DataProvenanceService()

// Also export the class for testing
export default DataProvenanceService
