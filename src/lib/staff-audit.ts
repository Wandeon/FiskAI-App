/**
 * Staff Audit Logging Module
 *
 * Provides audit logging for staff portal access to client data.
 * Required for GDPR compliance - tracks when staff members view or access client data.
 *
 * Usage:
 *   import { logStaffAccess } from "@/lib/staff-audit"
 *   await logStaffAccess({
 *     staffUserId: session.user.id,
 *     clientCompanyId: companyId,
 *     action: "STAFF_VIEW_CLIENT",
 *     resourceType: "Company",
 *     resourceId: companyId,
 *   })
 */

import { db } from "./db"
import type { AuditAction } from "@prisma/client"

/** Staff audit action types */
export type StaffAuditAction =
  | "STAFF_VIEW_CLIENT"
  | "STAFF_VIEW_INVOICES"
  | "STAFF_VIEW_DOCUMENTS"
  | "STAFF_VIEW_REPORTS"
  | "STAFF_EXPORT_DATA"
  | "STAFF_MARK_REVIEWED"

interface StaffAuditLogParams {
  /** The staff user performing the action */
  staffUserId: string
  /** The client company whose data is being accessed */
  clientCompanyId: string
  /** The type of action being performed */
  action: StaffAuditAction
  /** The type of resource being accessed (e.g., "Company", "EInvoice", "Document") */
  resourceType: string
  /** The specific resource ID being accessed (optional for list views) */
  resourceId?: string
  /** Additional metadata about the access */
  metadata?: Record<string, unknown>
  /** IP address of the staff user (from request headers) */
  ipAddress?: string | null
  /** User agent of the staff user's browser */
  userAgent?: string | null
}

/**
 * Log staff access to client data.
 *
 * This function is fire-and-forget for performance - errors are logged but
 * do not affect the main operation. Staff access logging should never block
 * the user's request.
 *
 * The log is stored against the CLIENT's company (clientCompanyId), with the
 * staff user recorded in the userId field. This allows clients to see who
 * accessed their data via audit log.
 */
export async function logStaffAccess(params: StaffAuditLogParams): Promise<void> {
  try {
    const changes: Record<string, unknown> = {
      staffAction: true,
      resourceType: params.resourceType,
    }

    if (params.resourceId) {
      changes.resourceId = params.resourceId
    }

    if (params.metadata) {
      changes.metadata = params.metadata
    }

    await db.auditLog.create({
      data: {
        companyId: params.clientCompanyId,
        userId: params.staffUserId,
        action: params.action as AuditAction,
        entity: params.resourceType,
        entityId: params.resourceId ?? params.clientCompanyId,
        changes,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch (error) {
    // Log error but don't throw - audit should never break staff operations
    console.error("[StaffAudit] Failed to log staff access:", error)
  }
}

/**
 * Helper to extract request metadata for audit logging.
 */
export function getRequestMetadata(headers: Headers): {
  ipAddress: string | null
  userAgent: string | null
} {
  return {
    ipAddress:
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      headers.get("cf-connecting-ip") ||
      null,
    userAgent: headers.get("user-agent"),
  }
}
