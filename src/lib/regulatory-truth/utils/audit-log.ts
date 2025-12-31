// src/lib/regulatory-truth/utils/audit-log.ts

import { db } from "@/lib/db"
import { Prisma, AuditAction } from "@prisma/client"

export type { AuditAction }

export type EntityType =
  | "RULE"
  | "CONFLICT"
  | "RELEASE"
  | "EVIDENCE"
  | "CONCEPT"
  | "SYSTEM"
  | "PIPELINE"
  | "SOURCE_POINTER"
  | "WEBHOOK_EVENT"

interface LogParams {
  action: AuditAction
  entityType: EntityType
  entityId: string
  performedBy?: string
  metadata?: Record<string, unknown>
}

/**
 * Log an audit event for legal defense tracking
 */
export async function logAuditEvent(params: LogParams): Promise<void> {
  try {
    await db.regulatoryAuditLog.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        performedBy: params.performedBy || "SYSTEM",
        metadata: (params.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    })
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("[audit] Failed to log event:", error)
  }
}

/**
 * Get audit trail for an entity
 */
export async function getAuditTrail(
  entityType: EntityType,
  entityId: string
): Promise<
  Array<{
    action: string
    performedBy: string | null
    performedAt: Date
    metadata: unknown
  }>
> {
  return db.regulatoryAuditLog.findMany({
    where: { entityType, entityId },
    orderBy: { performedAt: "asc" },
    select: {
      action: true,
      performedBy: true,
      performedAt: true,
      metadata: true,
    },
  })
}
