// src/app/api/pausalni/calendar/google/sync/route.ts

import { NextRequest, NextResponse } from "next/server"
import { requireAuth, requireCompany } from "@/lib/auth-utils"
import { drizzleDb } from "@/lib/db/drizzle"
import { paymentObligation, OBLIGATION_STATUS } from "@/lib/db/schema/pausalni"
import { eq, and, gte } from "drizzle-orm"
import {
  syncObligationsToGoogleCalendar,
  isGoogleCalendarAvailable,
} from "@/lib/pausalni/calendar/google-calendar"
import { withApiLogging } from "@/lib/api-logging"
import { setTenantContext } from "@/lib/db"
import { parseBody, isValidationError, formatValidationError } from "@/lib/api/validation"
import { googleCalendarSyncBodySchema } from "@/app/api/pausalni/_schemas"

/**
 * POST /api/pausalni/calendar/google/sync
 * Sync all pending obligations to user's Google Calendar
 */
export const POST = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({
      companyId: company.id,
      userId: user.id!,
    })

    // Check if Google Calendar is available
    const availability = await isGoogleCalendarAvailable(company.id)
    if (!availability.available) {
      return NextResponse.json(
        {
          error: "Google Calendar not available",
          reason: availability.reason,
        },
        { status: 400 }
      )
    }

    // Parse and validate body (with default empty object for optional body)
    let body: { year?: number; month?: number; includeAll?: boolean }
    try {
      body = await parseBody(request, googleCalendarSyncBodySchema)
    } catch (e) {
      // If body parsing fails due to empty body, use defaults
      if (isValidationError(e)) {
        body = { includeAll: false }
      } else {
        throw e
      }
    }

    const { year, month, includeAll } = body

    // Build query to get obligations
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const conditions = [eq(paymentObligation.companyId, company.id)]

    // By default, only sync future obligations (not paid/skipped)
    if (!includeAll) {
      conditions.push(gte(paymentObligation.dueDate, today.toISOString().split("T")[0]))
    }

    // Filter by year/month if provided
    if (year) {
      const startDate = new Date(year, month ? month - 1 : 0, 1)
      const endDate = new Date(year, month ? month : 12, 0)
      conditions.push(gte(paymentObligation.dueDate, startDate.toISOString().split("T")[0]))
      conditions.push(
        gte(
          paymentObligation.dueDate,
          today > startDate
            ? today.toISOString().split("T")[0]
            : startDate.toISOString().split("T")[0]
        )
      )
    }

    // Get obligations to sync
    const obligations = await drizzleDb
      .select({
        obligationType: paymentObligation.obligationType,
        periodMonth: paymentObligation.periodMonth,
        periodYear: paymentObligation.periodYear,
        dueDate: paymentObligation.dueDate,
        amount: paymentObligation.amount,
        status: paymentObligation.status,
      })
      .from(paymentObligation)
      .where(and(...conditions))

    // Filter out paid/skipped obligations unless includeAll is true
    const obligationsToSync = includeAll
      ? obligations
      : obligations.filter(
          (ob) => ob.status !== OBLIGATION_STATUS.PAID && ob.status !== OBLIGATION_STATUS.SKIPPED
        )

    if (obligationsToSync.length === 0) {
      return NextResponse.json({
        message: "No obligations to sync",
        eventsCreated: 0,
      })
    }

    // Sync to Google Calendar
    const result = await syncObligationsToGoogleCalendar(company.id, obligationsToSync)

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Failed to sync to Google Calendar",
          details: result.errors,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Successfully synced ${result.eventsCreated} obligation(s) to Google Calendar`,
      eventsCreated: result.eventsCreated,
      totalObligations: obligationsToSync.length,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[calendar/google/sync] Error:", error)

    const errorMessage = error instanceof Error ? error.message : "Internal server error"

    return NextResponse.json(
      {
        error: errorMessage,
      },
      { status: 500 }
    )
  }
})

/**
 * GET /api/pausalni/calendar/google/sync
 * Check if Google Calendar sync is available
 */
export const GET = withApiLogging(async (request: NextRequest) => {
  try {
    const user = await requireAuth()
    const company = await requireCompany(user.id!)

    setTenantContext({
      companyId: company.id,
      userId: user.id!,
    })

    // Check availability
    const availability = await isGoogleCalendarAvailable(company.id)

    // Count pending obligations
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const pendingCount = await drizzleDb
      .select()
      .from(paymentObligation)
      .where(
        and(
          eq(paymentObligation.companyId, company.id),
          gte(paymentObligation.dueDate, today.toISOString().split("T")[0])
        )
      )
      .then(
        (obs) =>
          obs.filter(
            (ob) => ob.status !== OBLIGATION_STATUS.PAID && ob.status !== OBLIGATION_STATUS.SKIPPED
          ).length
      )

    return NextResponse.json({
      available: availability.available,
      reason: availability.reason,
      pendingObligations: pendingCount,
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json(formatValidationError(error), { status: 400 })
    }
    console.error("[calendar/google/sync] GET error:", error)

    return NextResponse.json(
      {
        error: "Failed to check calendar availability",
      },
      { status: 500 }
    )
  }
})
