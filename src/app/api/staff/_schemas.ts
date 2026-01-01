/**
 * Shared Zod schemas for staff API routes
 */

import { z } from "zod"
import {
  SupportTicketPriority,
  SupportTicketStatus,
  TicketCategory,
  StaffReviewEntity,
} from "@prisma/client"

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Client ID parameter schema (used in route params)
 */
export const clientIdParamsSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
})

/**
 * Entity type enum for reviews
 */
export const entityTypeEnum = z.enum(["EINVOICE", "EXPENSE", "DOCUMENT"])

// ============================================================================
// Profile Schemas
// ============================================================================

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim()
    .regex(
      /^[\p{L}\p{M}\s'-]+$/u,
      "Name can only contain letters, spaces, hyphens, and apostrophes"
    ),
})

// ============================================================================
// Bulk Export Schemas
// ============================================================================

export const bulkExportQuerySchema = z.object({
  clientIds: z.string().min(1, "Client IDs are required"),
  from: z.string().optional(),
  to: z.string().optional(),
  format: z.enum(["csv", "summary", "kpr", "combined"]).optional().default("combined"),
  exportType: z.enum(["invoices", "expenses", "kpr", "summary", "all"]).optional().default("all"),
})

// ============================================================================
// Batch Review Schemas
// ============================================================================

export const batchReviewSchema = z.object({
  companyId: z.string().min(1, "Company ID is required"),
  reviews: z
    .array(
      z.object({
        entityType: entityTypeEnum,
        entityId: z.string().min(1, "Entity ID is required"),
        notes: z.string().optional(),
      })
    )
    .min(1, "At least one review is required"),
})

// ============================================================================
// Multi-Client Report Schemas
// ============================================================================

export const multiClientReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  reportType: z
    .enum(["overview", "kpr", "pending-review", "deadlines"])
    .optional()
    .default("overview"),
})

// ============================================================================
// Invitation Schemas
// ============================================================================

export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  companyName: z.string().optional(),
  message: z.string().optional(),
})

// ============================================================================
// Messages/Tickets Schemas
// ============================================================================

export const createTicketSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  body: z.string().min(1, "Message body is required"),
  priority: z.nativeEnum(SupportTicketPriority).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
})

export const addMessageSchema = z.object({
  ticketId: z.string().min(1, "Ticket ID is required"),
  body: z.string().min(1, "Message body is required"),
})

export const updateTicketStatusSchema = z.object({
  ticketId: z.string().min(1, "Ticket ID is required"),
  status: z.nativeEnum(SupportTicketStatus),
})

export const messagesQuerySchema = z.object({
  ticketId: z.string().optional(),
  status: z.string().optional(),
})

// ============================================================================
// Reviews Schemas
// ============================================================================

export const toggleReviewSchema = z.object({
  entityType: entityTypeEnum,
  entityId: z.string().min(1, "Entity ID is required"),
  reviewed: z.boolean(),
  notes: z.string().optional(),
})

export const reviewsQuerySchema = z.object({
  entityType: z.enum(["EINVOICE", "EXPENSE", "DOCUMENT"]).optional(),
  entityIds: z.string().optional(),
})
