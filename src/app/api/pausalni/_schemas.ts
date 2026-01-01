/**
 * Shared Zod schemas for paušalni API routes
 */

import { z } from "zod"

// ============================================================
// Common Schemas
// ============================================================

/** UUID validation schema */
export const uuidSchema = z.string().uuid("Invalid UUID format")

/** Year validation schema (2000-2100) */
export const yearSchema = z.coerce
  .number()
  .int()
  .min(2000, "Year must be at least 2000")
  .max(2100, "Year cannot exceed 2100")

/** Month validation schema (1-12) */
export const monthSchema = z.coerce
  .number()
  .int()
  .min(1, "Month must be 1-12")
  .max(12, "Month must be 1-12")

/** Optional year with default to current year */
export const optionalYearSchema = z.coerce
  .number()
  .int()
  .min(2000)
  .max(2100)
  .optional()
  .default(() => new Date().getFullYear())

/** Limit schema with default */
export const limitSchema = z.coerce.number().int().min(1).max(500).optional().default(50)

// ============================================================
// Route Params Schemas
// ============================================================

/** Generic ID param schema */
export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
})

// ============================================================
// PO-SD / Forms Schemas
// ============================================================

/** Expense bracket values for PO-SD */
export const expenseBracketSchema = z
  .enum(["25", "30", "34", "40", "85"])
  .transform(Number) as z.ZodType<25 | 30 | 34 | 40 | 85>

/** Format options for generated forms */
export const formFormatSchema = z.enum(["pdf", "xml", "both"]).optional().default("pdf")

/** POST body schema for PO-SD generation */
export const posdGenerateBodySchema = z.object({
  year: yearSchema,
  expenseBracket: z.coerce.number().refine((val) => [25, 30, 34, 40, 85].includes(val), {
    message: "expenseBracket must be one of: 25, 30, 34, 40, 85",
  }),
  grossIncome: z.coerce.number().optional(),
  format: formFormatSchema,
})

/** Form type enum */
export const formTypeSchema = z.enum(["PDV", "PDV_S", "ZP", "PO-SD"])

/** GET query schema for forms list */
export const formsQuerySchema = z.object({
  formType: formTypeSchema.optional(),
  year: yearSchema.optional(),
  limit: limitSchema,
})

/** POST body schema for form generation */
export const formGenerateBodySchema = z
  .object({
    formType: z.enum(["PDV", "PDV_S", "ZP"]),
    periodMonth: monthSchema.optional(),
    periodYear: yearSchema,
    zpFormData: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (data) => {
      // periodMonth is required for PDV and PDV_S
      if ((data.formType === "PDV" || data.formType === "PDV_S") && !data.periodMonth) {
        return false
      }
      return true
    },
    {
      message: "periodMonth is required for PDV and PDV_S forms (1-12)",
      path: ["periodMonth"],
    }
  )

// ============================================================
// Preferences Schemas
// ============================================================

/** Channel type for notification preferences */
export const notificationChannelSchema = z.enum(["EMAIL", "CALENDAR"])

/** PUT body schema for preferences */
export const preferencesBodySchema = z.object({
  channel: notificationChannelSchema,
  enabled: z.boolean().optional(),
  remind7Days: z.boolean().optional(),
  remind3Days: z.boolean().optional(),
  remind1Day: z.boolean().optional(),
  remindDayOf: z.boolean().optional(),
})

// ============================================================
// Income Summary Schemas
// ============================================================

/** Query schema for income summary */
export const incomeSummaryQuerySchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .default(() => new Date().getFullYear() - 1),
})

// ============================================================
// Profile Schemas
// ============================================================

/** PDV-ID format: HR + 11 digits */
export const pdvIdSchema = z
  .string()
  .regex(/^HR\d{11}$/, "Invalid PDV-ID format. Expected: HR + 11 digits")
  .optional()
  .nullable()

/** PUT body schema for profile update */
export const profileUpdateBodySchema = z.object({
  hasPdvId: z.boolean().optional(),
  pdvId: pdvIdSchema,
  pdvIdSince: z.string().optional().nullable(),
  euActive: z.boolean().optional(),
  hokMemberSince: z.string().optional().nullable(),
  tourismActivity: z.boolean().optional(),
})

// ============================================================
// EU Transactions Schemas
// ============================================================

/** Query schema for EU transactions list */
export const euTransactionsQuerySchema = z.object({
  year: optionalYearSchema,
  month: monthSchema.optional(),
  status: z.enum(["confirmed", "pending"]).optional(),
})

/** POST body schema for EU transaction processing */
export const euTransactionsProcessBodySchema = z.object({
  year: yearSchema,
  month: monthSchema.optional(),
  bankAccountId: z.string().optional(),
})

/** EU country codes (ISO 3166-1 alpha-2) */
export const euCountryCodeSchema = z.string().length(2, "Country code must be 2 characters")

/** Transaction type enum */
export const transactionTypeSchema = z.enum(["GOODS", "SERVICES"])

/** POST body schema for EU transaction confirmation */
export const euTransactionConfirmBodySchema = z
  .object({
    isEu: z.boolean(),
    country: euCountryCodeSchema.optional(),
    vendorName: z.string().optional(),
    transactionType: transactionTypeSchema.optional(),
    vatId: z.string().optional(),
    viesValidated: z.boolean().optional(),
    viesValid: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // country is required when confirming as EU
      if (data.isEu && !data.country) {
        return false
      }
      return true
    },
    {
      message: "country is required when confirming as EU transaction",
      path: ["country"],
    }
  )

// ============================================================
// Obligations Schemas
// ============================================================

/** Obligation status filter */
export const obligationStatusSchema = z.string().optional()

/** Query schema for obligations list */
export const obligationsQuerySchema = z.object({
  status: obligationStatusSchema,
  year: optionalYearSchema,
  month: monthSchema.optional(),
})

/** POST body schema for obligation generation */
export const obligationsGenerateBodySchema = z.object({
  year: yearSchema,
  month: monthSchema.optional(),
})

/** POST body schema for marking obligation as paid */
export const markPaidBodySchema = z.object({
  paidDate: z.string().optional(),
  paidAmount: z.coerce.number().optional(),
  notes: z.string().optional(),
})

// ============================================================
// VIES Validation Schemas
// ============================================================

/** POST body schema for VIES validation */
export const viesValidateBodySchema = z.object({
  vatId: z.string().min(1, "vatId is required"),
})

// ============================================================
// Payment Slip Schemas
// ============================================================

/** Payment slip type enum */
export const paymentSlipTypeSchema = z.enum(["MIO_I", "MIO_II", "ZDRAVSTVENO", "PDV", "HOK"])

/** Query schema for payment slip GET */
export const paymentSlipQuerySchema = z
  .object({
    type: paymentSlipTypeSchema,
    month: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .default(() => new Date().getMonth() + 1),
    year: z.coerce
      .number()
      .int()
      .min(2000)
      .max(2100)
      .optional()
      .default(() => new Date().getFullYear()),
    amount: z.coerce.number().optional(),
  })
  .refine(
    (data) => {
      // amount is required for PDV
      if (data.type === "PDV" && data.amount === undefined) {
        return false
      }
      return true
    },
    {
      message: "Amount is required for PDV",
      path: ["amount"],
    }
  )

/** POST body schema for batch payment slips */
export const paymentSlipBatchBodySchema = z.object({
  month: monthSchema,
  year: yearSchema,
})

// ============================================================
// Calendar Schemas
// ============================================================

/** Query schema for calendar export */
export const calendarExportQuerySchema = z.object({
  year: optionalYearSchema,
})

/** POST body schema for Google Calendar sync */
export const googleCalendarSyncBodySchema = z.object({
  year: yearSchema.optional(),
  month: monthSchema.optional(),
  includeAll: z.boolean().optional().default(false),
})
