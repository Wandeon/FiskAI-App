"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import {
  approveBaseline,
  type BaselineMetadata,
} from "@/lib/regulatory-truth/utils/structural-fingerprint"
import { revalidatePath } from "next/cache"

/**
 * Server action to approve a pending baseline for an endpoint.
 *
 * This action implements the human-in-the-loop approval workflow for baseline
 * governance (Appendix A.7). Only ADMIN users can approve baselines.
 *
 * @param endpointId - The ID of the DiscoveryEndpoint to approve baseline for
 * @returns Success status and approved baseline, or error message
 */
export async function approveEndpointBaseline(endpointId: string) {
  // 1. Verify admin authorization
  const session = await auth()
  if (!session?.user?.id) {
    throw new Error("Unauthorized: Authentication required")
  }

  // Check admin role in database (session.user.systemRole comes from JWT which could be stale)
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { systemRole: true, email: true },
  })

  if (user?.systemRole !== "ADMIN") {
    throw new Error("Unauthorized: Admin role required")
  }

  const approverEmail = user.email || session.user.email || "unknown"

  // 2. Fetch the endpoint
  const endpoint = await db.discoveryEndpoint.findUnique({
    where: { id: endpointId },
    select: {
      id: true,
      name: true,
      domain: true,
      path: true,
      metadata: true,
    },
  })

  if (!endpoint) {
    throw new Error(`Endpoint not found: ${endpointId}`)
  }

  // 3. Get pending baseline from metadata
  const metadata = endpoint.metadata as Record<string, unknown> | null
  const pendingBaseline = metadata?.structuralBaseline as BaselineMetadata | undefined

  if (!pendingBaseline) {
    throw new Error(`No baseline found for endpoint: ${endpoint.name}`)
  }

  if (pendingBaseline.approvalStatus === "approved") {
    throw new Error(`Baseline already approved for endpoint: ${endpoint.name}`)
  }

  // 4. Call approveBaseline to transition status
  const approvedBaseline = approveBaseline(pendingBaseline, approverEmail)

  // 5. Update endpoint metadata with approved baseline
  await db.discoveryEndpoint.update({
    where: { id: endpointId },
    data: {
      metadata: {
        ...(metadata || {}),
        structuralBaseline: approvedBaseline,
      },
    },
  })

  // 6. Log audit event
  await db.regulatoryAuditLog.create({
    data: {
      action: "BASELINE_APPROVED",
      entityType: "ENDPOINT",
      entityId: endpointId,
      performedBy: session.user.id,
      metadata: {
        endpointName: endpoint.name,
        endpointDomain: endpoint.domain,
        endpointPath: endpoint.path,
        approverEmail,
        previousStatus: pendingBaseline.approvalStatus,
        previousUpdatedBy: pendingBaseline.baselineUpdatedBy,
        previousUpdatedAt: pendingBaseline.baselineUpdatedAt,
      },
    },
  })

  // Revalidate admin pages that show baselines
  revalidatePath("/admin/regulatory")
  revalidatePath(`/admin/regulatory/endpoints/${endpointId}`)

  return {
    success: true,
    approvedBaseline,
    endpointId,
    endpointName: endpoint.name,
  }
}
