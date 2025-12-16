// src/lib/deadlines/queries.ts
import { drizzleDb } from "@/lib/db/drizzle"
import { complianceDeadlines } from "@/lib/db/schema"
import { desc, asc, gte, lte, and, sql, eq } from "drizzle-orm"

export interface GetDeadlinesParams {
  startDate?: string // ISO date string
  endDate?: string // ISO date string
  deadlineType?: string
  businessType?: string
  limit?: number
  offset?: number
  sortBy?: "date" | "severity" | "created"
  sortOrder?: "asc" | "desc"
}

/**
 * Get compliance deadlines with optional filters
 */
export async function getDeadlines(params: GetDeadlinesParams = {}) {
  const {
    startDate,
    endDate,
    deadlineType,
    businessType,
    limit = 50,
    offset = 0,
    sortBy = "date",
    sortOrder = "asc",
  } = params

  // Build WHERE conditions
  const conditions = []

  if (startDate) {
    conditions.push(gte(complianceDeadlines.deadlineDate, startDate))
  }

  if (endDate) {
    conditions.push(lte(complianceDeadlines.deadlineDate, endDate))
  }

  if (deadlineType) {
    conditions.push(eq(complianceDeadlines.deadlineType, deadlineType))
  }

  if (businessType) {
    // Filter by business type in the appliesTo JSONB array
    conditions.push(
      sql`${complianceDeadlines.appliesTo}::jsonb @> ${JSON.stringify([businessType])}::jsonb OR ${complianceDeadlines.appliesTo}::jsonb @> '["all"]'::jsonb`
    )
  }

  // Determine sort column
  let sortColumn
  switch (sortBy) {
    case "severity":
      sortColumn = complianceDeadlines.severity
      break
    case "created":
      sortColumn = complianceDeadlines.createdAt
      break
    case "date":
    default:
      sortColumn = complianceDeadlines.deadlineDate
      break
  }

  // Build query
  const query = drizzleDb
    .select()
    .from(complianceDeadlines)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sortOrder === "desc" ? desc(sortColumn) : asc(sortColumn))
    .limit(limit)
    .offset(offset)

  const results = await query

  return results
}

/**
 * Get a single deadline by ID
 */
export async function getDeadlineById(id: string) {
  const result = await drizzleDb
    .select()
    .from(complianceDeadlines)
    .where(eq(complianceDeadlines.id, id))
    .limit(1)

  return result[0] || null
}

/**
 * Get upcoming deadlines (next N days)
 */
export async function getUpcomingDeadlines(
  daysAhead: number = 30,
  businessType?: string,
  limit: number = 10
) {
  const today = new Date().toISOString().split("T")[0]
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)
  const futureDateStr = futureDate.toISOString().split("T")[0]

  return getDeadlines({
    startDate: today,
    endDate: futureDateStr,
    businessType,
    limit,
    sortBy: "date",
    sortOrder: "asc",
  })
}

/**
 * Get deadlines count with filters
 */
export async function getDeadlinesCount(
  params: Omit<GetDeadlinesParams, "limit" | "offset" | "sortBy" | "sortOrder">
) {
  const { startDate, endDate, deadlineType, businessType } = params

  const conditions = []

  if (startDate) {
    conditions.push(gte(complianceDeadlines.deadlineDate, startDate))
  }

  if (endDate) {
    conditions.push(lte(complianceDeadlines.deadlineDate, endDate))
  }

  if (deadlineType) {
    conditions.push(eq(complianceDeadlines.deadlineType, deadlineType))
  }

  if (businessType) {
    conditions.push(
      sql`${complianceDeadlines.appliesTo}::jsonb @> ${JSON.stringify([businessType])}::jsonb OR ${complianceDeadlines.appliesTo}::jsonb @> '["all"]'::jsonb`
    )
  }

  const result = await drizzleDb
    .select({ count: sql<number>`count(*)` })
    .from(complianceDeadlines)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return result[0]?.count || 0
}
