/**
 * Admin API Route Schemas
 *
 * Zod schemas for admin API route validation.
 */

import { z } from "zod"
import { FeatureFlagScope, FeatureFlagStatus } from "@prisma/client"

// Feature Flags
export const featureFlagQuerySchema = z.object({
  status: z.nativeEnum(FeatureFlagStatus).optional(),
  scope: z.nativeEnum(FeatureFlagScope).optional(),
  category: z.string().optional(),
  search: z.string().optional(),
})

export const createFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(
      /^[a-z][a-z0-9_]*$/,
      "Key must be lowercase alphanumeric with underscores, starting with a letter"
    ),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  scope: z.nativeEnum(FeatureFlagScope).default(FeatureFlagScope.GLOBAL),
  status: z.nativeEnum(FeatureFlagStatus).default(FeatureFlagStatus.INACTIVE),
  defaultValue: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const updateFeatureFlagSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.nativeEnum(FeatureFlagStatus).optional(),
  defaultValue: z.boolean().optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export const featureFlagOverrideSchema = z.object({
  targetType: z.enum(["USER", "COMPANY"]),
  targetId: z.string().min(1, "Target ID is required"),
  value: z.boolean(),
  reason: z.string().optional(),
})

// Staff Assignments
export const staffAssignmentIdSchema = z.object({
  id: z.string().uuid("Invalid assignment ID"),
})

// Tenant Routes
export const tenantParamsSchema = z.object({
  companyId: z.string().uuid("Invalid company ID"),
})

export const tenantActivityQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  type: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
})

// Regulatory Tables
export const regulatoryTableIdSchema = z.object({
  tableId: z.string().min(1, "Table ID is required"),
})

export const regulatoryTableQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  search: z.string().optional(),
})

export const createRegulatoryEntrySchema = z.object({
  key: z.string().min(1, "Key is required"),
  value: z.string().min(1, "Value is required"),
  effectiveFrom: z.coerce.date().optional(),
  effectiveUntil: z.coerce.date().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

// Alerts
export const alertQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]).optional(),
  severity: z.enum(["INFO", "WARNING", "ERROR", "CRITICAL"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
})

export const alertActionSchema = z
  .object({
    action: z.enum(["dismiss", "resolve", "acknowledge", "snooze"]),
    companyId: z.string().uuid("Invalid company ID"),
    type: z.string().min(1, "Alert type is required"),
    snoozedUntil: z.coerce.date().optional(),
  })
  .refine((data) => data.action !== "snooze" || data.snoozedUntil !== undefined, {
    message: "snoozedUntil is required for snooze action",
    path: ["snoozedUntil"],
  })

// Regulatory Truth
export const ruleIdSchema = z.object({
  id: z.string().uuid("Invalid rule ID"),
})

export const approveRuleSchema = z.object({
  notes: z.string().optional(),
})

export const rejectRuleSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
})

export const resolveConflictSchema = z.object({
  action: z.enum(["accept", "override"]),
  winningRuleId: z.string().uuid("Invalid winning rule ID").optional(),
  reason: z.string().optional(),
})
