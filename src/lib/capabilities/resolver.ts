/**
 * Capability Resolver
 *
 * Resolves capabilities to determine what actions are available.
 *
 * @module capabilities
 * @since Enterprise Hardening - Capability Resolution API
 */

import type { PrismaClient } from "@prisma/client"

// Accept any Prisma-like client (base or extended)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaLike = PrismaClient | any
import {
  type CapabilityRequest,
  type CapabilityResponse,
  type CapabilityInput,
  type CapabilityBlocker,
  type CapabilityAction,
  type CapabilityState,
} from "./types"
import { getCapabilityMetadata } from "./registry"
import { checkPeriodWritable, isPeriodAffectingModel } from "../period-locking"

/**
 * Resolve a capability to determine its current state.
 */
export async function resolveCapability(
  prisma: PrismaLike,
  request: CapabilityRequest,
  userContext: {
    userId: string
    companyId: string
    permissions: string[]
  }
): Promise<CapabilityResponse> {
  const metadata = getCapabilityMetadata(request.capability)

  if (!metadata) {
    return createErrorResponse(request.capability, "BLOCKED", [
      {
        type: "MISSING_PREREQUISITE",
        message: `Unknown capability: ${request.capability}`,
      },
    ])
  }

  const blockers: CapabilityBlocker[] = []
  const inputs: CapabilityInput[] = []
  const actions: CapabilityAction[] = []

  // Check permissions
  const missingPermissions = metadata.requiredPermissions.filter(
    (p) => !userContext.permissions.includes(p)
  )

  if (missingPermissions.length > 0) {
    return createErrorResponse(request.capability, "UNAUTHORIZED", [
      {
        type: "MISSING_PREREQUISITE",
        message: `Missing permissions: ${missingPermissions.join(", ")}`,
        details: { missingPermissions },
      },
    ])
  }

  // Check required inputs
  const providedInputs = request.context.inputs ?? {}
  let hasMissingInputs = false

  for (const inputKey of metadata.requiredInputs) {
    const provided = inputKey in providedInputs
    const value = providedInputs[inputKey]

    inputs.push({
      key: inputKey,
      required: true,
      provided,
      value: provided ? value : undefined,
    })

    if (!provided) {
      hasMissingInputs = true
    }
  }

  // Add optional inputs
  for (const inputKey of metadata.optionalInputs) {
    const provided = inputKey in providedInputs
    const value = providedInputs[inputKey]

    inputs.push({
      key: inputKey,
      required: false,
      provided,
      value: provided ? value : undefined,
    })
  }

  if (hasMissingInputs) {
    return {
      capability: request.capability,
      state: "MISSING_INPUTS",
      inputs,
      blockers: [],
      actions: buildActions(metadata.id, false, "Missing required inputs"),
      resolvedAt: new Date().toISOString(),
    }
  }

  // Check period locks for affected entities
  const targetDate = request.context.targetDate ? new Date(request.context.targetDate) : null

  for (const entityType of metadata.affectedEntities) {
    if (!isPeriodAffectingModel(entityType)) {
      continue
    }

    // If we have a target date, check if the period is writable
    if (targetDate) {
      const periodCheck = await checkPeriodWritable(
        prisma as unknown as PrismaClient,
        entityType,
        "create", // Default to create, could be parameterized
        targetDate ? { date: targetDate, issueDate: targetDate, entryDate: targetDate } : undefined
      )

      if (!periodCheck.allowed) {
        blockers.push({
          type: "PERIOD_LOCKED",
          message: periodCheck.reason ?? `Period is locked for ${entityType}`,
          resolution: "Contact administrator to unlock the period",
          details: {
            entityType,
            periodStatus: periodCheck.periodStatus,
            targetDate: targetDate?.toISOString(),
          },
        })
      }
    }
  }

  // If we have an entity ID, check entity-specific conditions
  if (request.context.entityId && request.context.entityType) {
    const entityBlockers = await checkEntityConditions(
      prisma,
      request.context.entityType,
      request.context.entityId,
      metadata.id
    )
    blockers.push(...entityBlockers)
  }

  // Determine final state
  let state: CapabilityState = "READY"
  if (blockers.length > 0) {
    state = "BLOCKED"
  }

  return {
    capability: request.capability,
    state,
    inputs,
    blockers,
    actions: buildActions(metadata.id, state === "READY"),
    resolvedAt: new Date().toISOString(),
  }
}

/**
 * Check entity-specific conditions.
 */
async function checkEntityConditions(
  prisma: PrismaLike,
  entityType: string,
  entityId: string,
  capabilityId: string
): Promise<CapabilityBlocker[]> {
  const blockers: CapabilityBlocker[] = []

  switch (entityType) {
    case "EInvoice": {
      const invoice = await prisma.eInvoice.findUnique({
        where: { id: entityId },
        select: { status: true, jir: true, fiscalizedAt: true },
      })

      if (invoice) {
        // Check if invoice is immutable for certain capabilities
        if (
          (capabilityId === "INV-002" || capabilityId === "INV-003") &&
          invoice.status === "DRAFT"
        ) {
          blockers.push({
            type: "WORKFLOW_STATE",
            message: "Invoice must be issued before it can be sent or fiscalized",
            resolution: "Issue the invoice first",
            details: { currentStatus: invoice.status },
          })
        }

        if (invoice.fiscalizedAt && capabilityId !== "INV-004") {
          blockers.push({
            type: "ENTITY_IMMUTABLE",
            message: "Fiscalized invoices cannot be modified",
            resolution: "Use a credit note (INV-004) to make corrections",
            details: { fiscalizedAt: invoice.fiscalizedAt },
          })
        }
      }
      break
    }

    case "Expense": {
      const expense = await prisma.expense.findUnique({
        where: { id: entityId },
        select: { status: true },
      })

      if (expense) {
        if (expense.status === "PAID") {
          blockers.push({
            type: "WORKFLOW_STATE",
            message: `Expense in ${expense.status} status cannot be modified`,
            resolution: "Use correction capability (EXP-003)",
            details: { currentStatus: expense.status },
          })
        }
      }
      break
    }

    case "JournalEntry": {
      const entry = await prisma.journalEntry.findUnique({
        where: { id: entityId },
        select: { status: true },
      })

      if (entry?.status === "POSTED") {
        blockers.push({
          type: "ENTITY_IMMUTABLE",
          message: "Posted journal entries cannot be modified",
          resolution: "Create a reversing entry",
          details: { currentStatus: entry.status },
        })
      }
      break
    }

    case "Payout": {
      const payout = await prisma.payout.findUnique({
        where: { id: entityId },
        select: { status: true, lockedAt: true },
      })

      if (payout && payout.status !== "DRAFT") {
        blockers.push({
          type: "ENTITY_IMMUTABLE",
          message: `Payout in ${payout.status} status cannot be modified`,
          resolution: "Create a new payout for corrections",
          details: { currentStatus: payout.status, lockedAt: payout.lockedAt },
        })
      }
      break
    }
  }

  return blockers
}

/**
 * Build action buttons based on capability and state.
 */
function buildActions(
  capabilityId: string,
  enabled: boolean,
  disabledReason?: string
): CapabilityAction[] {
  // Define standard actions per capability
  const actionsByCapability: Record<string, CapabilityAction[]> = {
    "INV-001": [
      { id: "create", label: "Create Invoice", enabled, disabledReason, primary: true },
      { id: "save_draft", label: "Save as Draft", enabled, disabledReason },
    ],
    "INV-002": [
      { id: "send_email", label: "Send via Email", enabled, disabledReason, primary: true },
      { id: "send_einvoice", label: "Send as E-Invoice", enabled, disabledReason },
    ],
    "INV-003": [{ id: "fiscalize", label: "Fiscalize", enabled, disabledReason, primary: true }],
    "INV-004": [
      {
        id: "create_credit_note",
        label: "Create Credit Note",
        enabled,
        disabledReason,
        primary: true,
      },
    ],
    "EXP-001": [
      { id: "record", label: "Record Expense", enabled, disabledReason, primary: true },
      { id: "save_draft", label: "Save as Draft", enabled, disabledReason },
    ],
    "GL-001": [{ id: "create", label: "Create Entry", enabled, disabledReason, primary: true }],
    "GL-002": [{ id: "post", label: "Post Entry", enabled, disabledReason, primary: true }],
  }

  return (
    actionsByCapability[capabilityId] ?? [
      { id: "execute", label: "Execute", enabled, disabledReason, primary: true },
    ]
  )
}

/**
 * Create an error response.
 */
function createErrorResponse(
  capability: string,
  state: CapabilityState,
  blockers: CapabilityBlocker[]
): CapabilityResponse {
  return {
    capability,
    state,
    inputs: [],
    blockers,
    actions: [],
    resolvedAt: new Date().toISOString(),
  }
}

/**
 * Batch resolve multiple capabilities.
 */
export async function resolveCapabilities(
  prisma: PrismaLike,
  requests: CapabilityRequest[],
  userContext: {
    userId: string
    companyId: string
    permissions: string[]
  }
): Promise<CapabilityResponse[]> {
  return Promise.all(requests.map((request) => resolveCapability(prisma, request, userContext)))
}
