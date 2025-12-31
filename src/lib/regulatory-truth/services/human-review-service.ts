// src/lib/regulatory-truth/services/human-review-service.ts
//
// Centralized Human Review Service for RTL
// Consolidates all human review triggers from scattered agents into a single service.
//
// Previously, human review was triggered inconsistently across:
// - OCR Worker: Low confidence -> needsManualReview
// - Extractor: Invalid domain -> reject (no explicit escalate)
// - Reviewer: T0/T1 -> PENDING_REVIEW (implementation unclear)
// - Arbiter: Cannot resolve -> ESCALATE_TO_HUMAN
//
// This service provides:
// - Unified HumanReviewRequest interface
// - Centralized reason enum with SLA definitions
// - Priority-based queue with backlog tracking
// - SLA breach detection and alerting
//
// Issue: #884

import { db } from "@/lib/db"
import { logAuditEvent } from "../utils/audit-log"

// =============================================================================
// TYPES & ENUMS
// =============================================================================

/**
 * Reasons why human review is required.
 * Each reason has an associated default SLA and priority.
 */
export enum HumanReviewReason {
  // OCR-related
  LOW_OCR_CONFIDENCE = "LOW_OCR_CONFIDENCE",
  OCR_FAILED = "OCR_FAILED",

  // Extraction-related
  LOW_EXTRACTION_CONFIDENCE = "LOW_EXTRACTION_CONFIDENCE",
  INVALID_DOMAIN = "INVALID_DOMAIN",
  EVIDENCE_QUALITY = "EVIDENCE_QUALITY",

  // Rule review-related
  T0_RULE_APPROVAL = "T0_RULE_APPROVAL",
  T1_RULE_APPROVAL = "T1_RULE_APPROVAL",
  LOW_RULE_CONFIDENCE = "LOW_RULE_CONFIDENCE",

  // Conflict-related
  CONFLICT_UNRESOLVABLE = "CONFLICT_UNRESOLVABLE",
  CONFLICT_BOTH_T0 = "CONFLICT_BOTH_T0",
  CONFLICT_EQUAL_AUTHORITY = "CONFLICT_EQUAL_AUTHORITY",

  // Arbiter-related
  ARBITER_LOW_CONFIDENCE = "ARBITER_LOW_CONFIDENCE",
  SOURCE_CONFLICT = "SOURCE_CONFLICT",
}

export type HumanReviewPriority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW"

export type HumanReviewEntityType = "EVIDENCE" | "RULE" | "CONFLICT" | "SOURCE_POINTER"

export type HumanReviewStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED"

/**
 * Configuration for each review reason.
 */
interface ReviewReasonConfig {
  defaultPriority: HumanReviewPriority
  slaHours: number
  descriptionHr: string
  descriptionEn: string
}

/**
 * SLA and priority configuration for each reason.
 */
const REASON_CONFIG: Record<HumanReviewReason, ReviewReasonConfig> = {
  // OCR - Generally lower priority, can wait
  [HumanReviewReason.LOW_OCR_CONFIDENCE]: {
    defaultPriority: "NORMAL",
    slaHours: 72,
    descriptionHr: "Niska pouzdanost OCR-a",
    descriptionEn: "Low OCR confidence",
  },
  [HumanReviewReason.OCR_FAILED]: {
    defaultPriority: "HIGH",
    slaHours: 48,
    descriptionHr: "OCR obrada nije uspjela",
    descriptionEn: "OCR processing failed",
  },

  // Extraction - Medium priority
  [HumanReviewReason.LOW_EXTRACTION_CONFIDENCE]: {
    defaultPriority: "NORMAL",
    slaHours: 48,
    descriptionHr: "Niska pouzdanost ekstrakcije",
    descriptionEn: "Low extraction confidence",
  },
  [HumanReviewReason.INVALID_DOMAIN]: {
    defaultPriority: "LOW",
    slaHours: 168, // 7 days
    descriptionHr: "Neispravna domena",
    descriptionEn: "Invalid domain",
  },
  [HumanReviewReason.EVIDENCE_QUALITY]: {
    defaultPriority: "NORMAL",
    slaHours: 72,
    descriptionHr: "Problem s kvalitetom dokaza",
    descriptionEn: "Evidence quality issue",
  },

  // T0/T1 Rules - Critical, must be reviewed quickly
  [HumanReviewReason.T0_RULE_APPROVAL]: {
    defaultPriority: "CRITICAL",
    slaHours: 4,
    descriptionHr: "T0 pravilo zahtijeva odobrenje",
    descriptionEn: "T0 rule requires approval",
  },
  [HumanReviewReason.T1_RULE_APPROVAL]: {
    defaultPriority: "HIGH",
    slaHours: 24,
    descriptionHr: "T1 pravilo zahtijeva odobrenje",
    descriptionEn: "T1 rule requires approval",
  },
  [HumanReviewReason.LOW_RULE_CONFIDENCE]: {
    defaultPriority: "NORMAL",
    slaHours: 48,
    descriptionHr: "Niska pouzdanost pravila",
    descriptionEn: "Low rule confidence",
  },

  // Conflicts - High priority, blocks pipeline
  [HumanReviewReason.CONFLICT_UNRESOLVABLE]: {
    defaultPriority: "HIGH",
    slaHours: 24,
    descriptionHr: "Sukob nije moguce automatski rijesiti",
    descriptionEn: "Conflict cannot be automatically resolved",
  },
  [HumanReviewReason.CONFLICT_BOTH_T0]: {
    defaultPriority: "CRITICAL",
    slaHours: 4,
    descriptionHr: "Sukob izmedu dva T0 pravila",
    descriptionEn: "Conflict between two T0 rules",
  },
  [HumanReviewReason.CONFLICT_EQUAL_AUTHORITY]: {
    defaultPriority: "HIGH",
    slaHours: 24,
    descriptionHr: "Sukob pravila jednakog autoriteta",
    descriptionEn: "Conflict between equal authority rules",
  },

  // Arbiter-related
  [HumanReviewReason.ARBITER_LOW_CONFIDENCE]: {
    defaultPriority: "HIGH",
    slaHours: 24,
    descriptionHr: "Niska pouzdanost arbitraze",
    descriptionEn: "Low arbiter confidence",
  },
  [HumanReviewReason.SOURCE_CONFLICT]: {
    defaultPriority: "HIGH",
    slaHours: 24,
    descriptionHr: "Sukob izvornih podataka",
    descriptionEn: "Source data conflict",
  },
}

// =============================================================================
// REQUEST/RESPONSE INTERFACES
// =============================================================================

export interface HumanReviewRequest {
  entityType: HumanReviewEntityType
  entityId: string
  reason: HumanReviewReason
  /** Optional priority override (uses reason default if not specified) */
  priority?: HumanReviewPriority
  /** Optional SLA override in hours (uses reason default if not specified) */
  slaHours?: number
  /** Additional context for the reviewer */
  context: Record<string, unknown>
  /** Source of the review request (e.g., "ocr-worker", "arbiter") */
  requestedBy: string
}

export interface HumanReviewRecord {
  id: string
  entityType: HumanReviewEntityType
  entityId: string
  reason: HumanReviewReason
  priority: HumanReviewPriority
  status: HumanReviewStatus
  context: Record<string, unknown>
  requestedBy: string
  requestedAt: Date
  slaDeadline: Date
  assignedTo: string | null
  completedAt: Date | null
  completedBy: string | null
  resolution: Record<string, unknown> | null
}

export interface HumanReviewStats {
  total: number
  byPriority: Record<HumanReviewPriority, number>
  byReason: Record<HumanReviewReason, number>
  byStatus: Record<HumanReviewStatus, number>
  slaBreaches: number
  avgResolutionHours: number | null
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

/**
 * Centralized Human Review Service.
 *
 * All agents should use this service to request human review instead of
 * implementing their own escalation logic.
 */
export class HumanReviewService {
  /**
   * Request a human review for an entity.
   *
   * @param request - The review request details
   * @returns The ID of the created review queue entry
   */
  async requestReview(request: HumanReviewRequest): Promise<string> {
    const config = REASON_CONFIG[request.reason]
    const priority = request.priority ?? config.defaultPriority
    const slaHours = request.slaHours ?? config.slaHours
    const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000)

    // Create review queue entry
    const review = await db.humanReviewQueue.create({
      data: {
        entityType: request.entityType,
        entityId: request.entityId,
        reason: request.reason,
        priority,
        status: "PENDING",
        context: request.context,
        requestedBy: request.requestedBy,
        slaDeadline,
      },
    })

    // Log audit event
    await logAuditEvent({
      action: "HUMAN_REVIEW_REQUESTED",
      entityType: request.entityType,
      entityId: request.entityId,
      metadata: {
        reviewId: review.id,
        reason: request.reason,
        priority,
        slaDeadline: slaDeadline.toISOString(),
        requestedBy: request.requestedBy,
        descriptionHr: config.descriptionHr,
        descriptionEn: config.descriptionEn,
      },
    })

    console.log(
      `[human-review] Created review ${review.id} for ${request.entityType}:${request.entityId} ` +
        `(reason: ${request.reason}, priority: ${priority}, SLA: ${slaHours}h)`
    )

    return review.id
  }

  /**
   * Mark a review as completed.
   */
  async completeReview(
    reviewId: string,
    completedBy: string,
    resolution: Record<string, unknown>
  ): Promise<void> {
    const review = await db.humanReviewQueue.update({
      where: { id: reviewId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy,
        resolution,
      },
    })

    await logAuditEvent({
      action: "HUMAN_REVIEW_COMPLETED",
      entityType: review.entityType as HumanReviewEntityType,
      entityId: review.entityId,
      performedBy: completedBy,
      metadata: {
        reviewId,
        reason: review.reason,
        resolution,
        withinSla: new Date() <= review.slaDeadline,
      },
    })
  }

  /**
   * Get pending reviews, optionally filtered.
   */
  async getPendingReviews(options?: {
    priority?: HumanReviewPriority
    entityType?: HumanReviewEntityType
    limit?: number
  }): Promise<HumanReviewRecord[]> {
    const reviews = await db.humanReviewQueue.findMany({
      where: {
        status: "PENDING",
        ...(options?.priority && { priority: options.priority }),
        ...(options?.entityType && { entityType: options.entityType }),
      },
      orderBy: [{ priority: "asc" }, { slaDeadline: "asc" }],
      take: options?.limit ?? 100,
    })
    return reviews as unknown as HumanReviewRecord[]
  }

  /**
   * Get reviews that have breached their SLA.
   */
  async getSlaBreaches(): Promise<HumanReviewRecord[]> {
    const reviews = await db.humanReviewQueue.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        slaDeadline: { lt: new Date() },
      },
      orderBy: { slaDeadline: "asc" },
    })
    return reviews as unknown as HumanReviewRecord[]
  }

  /**
   * Get backlog statistics.
   */
  async getBacklogStats(): Promise<HumanReviewStats> {
    const [pending, inProgress, completed, expired] = await Promise.all([
      db.humanReviewQueue.count({ where: { status: "PENDING" } }),
      db.humanReviewQueue.count({ where: { status: "IN_PROGRESS" } }),
      db.humanReviewQueue.count({ where: { status: "COMPLETED" } }),
      db.humanReviewQueue.count({ where: { status: "EXPIRED" } }),
    ])

    const slaBreaches = await db.humanReviewQueue.count({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        slaDeadline: { lt: new Date() },
      },
    })

    const byPriorityRaw = await db.humanReviewQueue.groupBy({
      by: ["priority"],
      where: { status: "PENDING" },
      _count: true,
    })

    const byPriority: Record<HumanReviewPriority, number> = {
      CRITICAL: 0,
      HIGH: 0,
      NORMAL: 0,
      LOW: 0,
    }
    for (const row of byPriorityRaw) {
      byPriority[row.priority as HumanReviewPriority] = row._count
    }

    const byReasonRaw = await db.humanReviewQueue.groupBy({
      by: ["reason"],
      where: { status: "PENDING" },
      _count: true,
    })

    const byReason: Record<HumanReviewReason, number> = {} as Record<HumanReviewReason, number>
    for (const reason of Object.values(HumanReviewReason)) {
      byReason[reason] = 0
    }
    for (const row of byReasonRaw) {
      byReason[row.reason as HumanReviewReason] = row._count
    }

    const completedReviews = await db.humanReviewQueue.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      select: { requestedAt: true, completedAt: true },
      take: 1000,
    })

    let avgResolutionHours: number | null = null
    if (completedReviews.length > 0) {
      const totalHours = completedReviews.reduce((sum, r) => {
        const diffMs = r.completedAt!.getTime() - r.requestedAt.getTime()
        return sum + diffMs / (1000 * 60 * 60)
      }, 0)
      avgResolutionHours = totalHours / completedReviews.length
    }

    return {
      total: pending + inProgress,
      byPriority,
      byReason,
      byStatus: {
        PENDING: pending,
        IN_PROGRESS: inProgress,
        COMPLETED: completed,
        EXPIRED: expired,
      },
      slaBreaches,
      avgResolutionHours,
    }
  }

  /**
   * Check if entity already has pending review.
   */
  async hasPendingReview(entityType: HumanReviewEntityType, entityId: string): Promise<boolean> {
    const count = await db.humanReviewQueue.count({
      where: { entityType, entityId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    })
    return count > 0
  }

  /**
   * Get reason configuration.
   */
  getReasonConfig(reason: HumanReviewReason): ReviewReasonConfig {
    return REASON_CONFIG[reason]
  }

  /**
   * Assign a review to a user.
   */
  async assignReview(reviewId: string, assignedTo: string): Promise<void> {
    await db.humanReviewQueue.update({
      where: { id: reviewId },
      data: { status: "IN_PROGRESS", assignedTo },
    })

    const review = await db.humanReviewQueue.findUnique({ where: { id: reviewId } })
    if (review) {
      await logAuditEvent({
        action: "HUMAN_REVIEW_ASSIGNED",
        entityType: review.entityType as HumanReviewEntityType,
        performedBy: assignedTo,
        entityId: review.entityId,
        metadata: { reviewId, assignedTo },
      })
    }
  }

  /**
   * Expire stale reviews exceeding SLA.
   */
  async expireStaleReviews(maxSlaExceedanceHours: number = 168): Promise<number> {
    const cutoff = new Date(Date.now() - maxSlaExceedanceHours * 60 * 60 * 1000)
    const result = await db.humanReviewQueue.updateMany({
      where: { status: "PENDING", slaDeadline: { lt: cutoff } },
      data: { status: "EXPIRED" },
    })
    if (result.count > 0) {
      console.log(`[human-review] Expired ${result.count} stale reviews`)
    }
    return result.count
  }
}

// Singleton instance
export const humanReviewService = new HumanReviewService()

// =============================================================================
// HELPER FUNCTIONS FOR AGENTS
// =============================================================================

/**
 * Helper to request human review for OCR issues.
 */
export async function requestOcrReview(
  evidenceId: string,
  options: { avgConfidence?: number; failedPages?: number[]; error?: string }
): Promise<string> {
  const reason =
    options.error || (options.failedPages?.length ?? 0) > 0
      ? HumanReviewReason.OCR_FAILED
      : HumanReviewReason.LOW_OCR_CONFIDENCE

  return humanReviewService.requestReview({
    entityType: "EVIDENCE",
    entityId: evidenceId,
    reason,
    context: {
      avgConfidence: options.avgConfidence,
      failedPages: options.failedPages,
      error: options.error,
    },
    requestedBy: "ocr-worker",
  })
}

/**
 * Helper to request human review for extraction issues.
 */
export async function requestExtractionReview(
  evidenceId: string,
  options: { confidence?: number; rejectionReason?: string; domain?: string }
): Promise<string> {
  const reason =
    options.rejectionReason === "INVALID_DOMAIN"
      ? HumanReviewReason.INVALID_DOMAIN
      : options.confidence && options.confidence < 0.7
        ? HumanReviewReason.LOW_EXTRACTION_CONFIDENCE
        : HumanReviewReason.EVIDENCE_QUALITY

  return humanReviewService.requestReview({
    entityType: "EVIDENCE",
    entityId: evidenceId,
    reason,
    context: {
      confidence: options.confidence,
      rejectionReason: options.rejectionReason,
      domain: options.domain,
    },
    requestedBy: "extractor",
  })
}

/**
 * Helper to request human review for rule approval.
 */
export async function requestRuleReview(
  ruleId: string,
  options: { riskTier: string; confidence: number; reviewerNotes?: string }
): Promise<string> {
  let reason: HumanReviewReason
  if (options.riskTier === "T0") {
    reason = HumanReviewReason.T0_RULE_APPROVAL
  } else if (options.riskTier === "T1") {
    reason = HumanReviewReason.T1_RULE_APPROVAL
  } else if (options.confidence < 0.85) {
    reason = HumanReviewReason.LOW_RULE_CONFIDENCE
  } else {
    reason = HumanReviewReason.T1_RULE_APPROVAL
  }

  return humanReviewService.requestReview({
    entityType: "RULE",
    entityId: ruleId,
    reason,
    priority:
      options.riskTier === "T0" ? "CRITICAL" : options.riskTier === "T1" ? "HIGH" : undefined,
    context: {
      riskTier: options.riskTier,
      confidence: options.confidence,
      reviewerNotes: options.reviewerNotes,
    },
    requestedBy: "reviewer",
  })
}

/**
 * Helper to request human review for conflict resolution.
 */
export async function requestConflictReview(
  conflictId: string,
  options: {
    conflictType: string
    ruleATier?: string
    ruleBTier?: string
    confidence?: number
    escalationReason?: string
  }
): Promise<string> {
  let reason: HumanReviewReason

  if (options.ruleATier === "T0" && options.ruleBTier === "T0") {
    reason = HumanReviewReason.CONFLICT_BOTH_T0
  } else if (options.escalationReason === "equal_authority") {
    reason = HumanReviewReason.CONFLICT_EQUAL_AUTHORITY
  } else if (options.conflictType === "SOURCE_CONFLICT") {
    reason = HumanReviewReason.SOURCE_CONFLICT
  } else if (options.confidence && options.confidence < 0.8) {
    reason = HumanReviewReason.ARBITER_LOW_CONFIDENCE
  } else {
    reason = HumanReviewReason.CONFLICT_UNRESOLVABLE
  }

  return humanReviewService.requestReview({
    entityType: "CONFLICT",
    entityId: conflictId,
    reason,
    context: {
      conflictType: options.conflictType,
      ruleATier: options.ruleATier,
      ruleBTier: options.ruleBTier,
      confidence: options.confidence,
      escalationReason: options.escalationReason,
    },
    requestedBy: "arbiter",
  })
}
