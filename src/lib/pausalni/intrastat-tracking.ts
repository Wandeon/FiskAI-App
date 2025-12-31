/**
 * Intrastat Tracking Service
 * Tracks cumulative goods values and warns when approaching thresholds
 */

import { drizzleDb } from "@/lib/db/drizzle"
import { euTransaction, intrastatTracking } from "@/lib/db/schema/pausalni"
import { INTRASTAT_THRESHOLDS, TRANSACTION_TYPES } from "./constants"
import { eq, and, sql } from "drizzle-orm"

export interface IntrastatStatus {
  year: number
  arrivals: {
    total: number
    threshold: number
    percentage: number
    warningReached: boolean
    thresholdBreached: boolean
  }
  dispatches: {
    total: number
    threshold: number
    percentage: number
    warningReached: boolean
    thresholdBreached: boolean
  }
  requiresIntrastatReporting: boolean
}

export interface IntrastatWarning {
  type: "ARRIVALS" | "DISPATCHES"
  level: "WARNING" | "THRESHOLD_BREACHED"
  currentTotal: number
  threshold: number
  percentage: number
  message: string
}

async function getOrCreateTracking(companyId: string, year: number) {
  const existing = await drizzleDb
    .select()
    .from(intrastatTracking)
    .where(and(eq(intrastatTracking.companyId, companyId), eq(intrastatTracking.year, year)))
    .limit(1)

  if (existing.length > 0) {
    return existing[0]
  }

  const inserted = await drizzleDb.insert(intrastatTracking).values({ companyId, year }).returning()

  return inserted[0]
}

async function calculateGoodsTotal(
  companyId: string,
  year: number,
  direction: "RECEIVED" | "PROVIDED"
): Promise<number> {
  const result = await drizzleDb
    .select({
      total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
    })
    .from(euTransaction)
    .where(
      and(
        eq(euTransaction.companyId, companyId),
        eq(euTransaction.reportingYear, year),
        eq(euTransaction.transactionType, TRANSACTION_TYPES.GOODS),
        eq(euTransaction.direction, direction),
        eq(euTransaction.userConfirmed, true)
      )
    )

  return parseFloat(result[0]?.total || "0")
}

export async function getIntrastatStatus(
  companyId: string,
  year: number
): Promise<IntrastatStatus> {
  const tracking = await getOrCreateTracking(companyId, year)

  const arrivalsTotal = await calculateGoodsTotal(companyId, year, "RECEIVED")
  const dispatchesTotal = await calculateGoodsTotal(companyId, year, "PROVIDED")

  const arrivalsPercentage = (arrivalsTotal / INTRASTAT_THRESHOLDS.ARRIVALS) * 100
  const dispatchesPercentage = (dispatchesTotal / INTRASTAT_THRESHOLDS.DISPATCHES) * 100

  const arrivalsWarningReached = arrivalsPercentage >= INTRASTAT_THRESHOLDS.WARNING_THRESHOLD * 100
  const dispatchesWarningReached =
    dispatchesPercentage >= INTRASTAT_THRESHOLDS.WARNING_THRESHOLD * 100
  const arrivalsThresholdBreached = arrivalsTotal >= INTRASTAT_THRESHOLDS.ARRIVALS
  const dispatchesThresholdBreached = dispatchesTotal >= INTRASTAT_THRESHOLDS.DISPATCHES

  await drizzleDb
    .update(intrastatTracking)
    .set({
      arrivalsTotal: String(arrivalsTotal),
      dispatchesTotal: String(dispatchesTotal),
      arrivalsThresholdBreached,
      arrivalsThresholdBreachedAt: arrivalsThresholdBreached
        ? tracking.arrivalsThresholdBreachedAt || new Date()
        : null,
      dispatchesThresholdBreached,
      dispatchesThresholdBreachedAt: dispatchesThresholdBreached
        ? tracking.dispatchesThresholdBreachedAt || new Date()
        : null,
      updatedAt: new Date(),
    })
    .where(eq(intrastatTracking.id, tracking.id))

  return {
    year,
    arrivals: {
      total: arrivalsTotal,
      threshold: INTRASTAT_THRESHOLDS.ARRIVALS,
      percentage: arrivalsPercentage,
      warningReached: arrivalsWarningReached,
      thresholdBreached: arrivalsThresholdBreached,
    },
    dispatches: {
      total: dispatchesTotal,
      threshold: INTRASTAT_THRESHOLDS.DISPATCHES,
      percentage: dispatchesPercentage,
      warningReached: dispatchesWarningReached,
      thresholdBreached: dispatchesThresholdBreached,
    },
    requiresIntrastatReporting: arrivalsThresholdBreached || dispatchesThresholdBreached,
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("hr-HR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export async function checkIntrastatWarnings(
  companyId: string,
  year: number
): Promise<IntrastatWarning[]> {
  const status = await getIntrastatStatus(companyId, year)
  const tracking = await getOrCreateTracking(companyId, year)
  const warnings: IntrastatWarning[] = []

  if (status.arrivals.thresholdBreached && !tracking.arrivalsThresholdBreached) {
    warnings.push({
      type: "ARRIVALS",
      level: "THRESHOLD_BREACHED",
      currentTotal: status.arrivals.total,
      threshold: INTRASTAT_THRESHOLDS.ARRIVALS,
      percentage: status.arrivals.percentage,
      message: `Prekoračen je godišnji prag za Intrastat izvještavanje za primitke robe iz EU (${formatCurrency(status.arrivals.total)} / ${formatCurrency(INTRASTAT_THRESHOLDS.ARRIVALS)}). Potrebno je podnositi mjesečne Intrastat izvještaje.`,
    })
  } else if (status.arrivals.warningReached && !tracking.arrivalsWarningShown) {
    warnings.push({
      type: "ARRIVALS",
      level: "WARNING",
      currentTotal: status.arrivals.total,
      threshold: INTRASTAT_THRESHOLDS.ARRIVALS,
      percentage: status.arrivals.percentage,
      message: `Približavate se godišnjem pragu za Intrastat izvještavanje za primitke robe iz EU (${Math.round(status.arrivals.percentage)}% praga).`,
    })
  }

  if (status.dispatches.thresholdBreached && !tracking.dispatchesThresholdBreached) {
    warnings.push({
      type: "DISPATCHES",
      level: "THRESHOLD_BREACHED",
      currentTotal: status.dispatches.total,
      threshold: INTRASTAT_THRESHOLDS.DISPATCHES,
      percentage: status.dispatches.percentage,
      message: `Prekoračen je godišnji prag za Intrastat izvještavanje za otpremu robe u EU (${formatCurrency(status.dispatches.total)} / ${formatCurrency(INTRASTAT_THRESHOLDS.DISPATCHES)}). Potrebno je podnositi mjesečne Intrastat izvještaje.`,
    })
  } else if (status.dispatches.warningReached && !tracking.dispatchesWarningShown) {
    warnings.push({
      type: "DISPATCHES",
      level: "WARNING",
      currentTotal: status.dispatches.total,
      threshold: INTRASTAT_THRESHOLDS.DISPATCHES,
      percentage: status.dispatches.percentage,
      message: `Približavate se godišnjem pragu za Intrastat izvještavanje za otpremu robe u EU (${Math.round(status.dispatches.percentage)}% praga).`,
    })
  }

  return warnings
}

export async function markWarningsShown(
  companyId: string,
  year: number,
  types: ("ARRIVALS" | "DISPATCHES")[]
): Promise<void> {
  const tracking = await getOrCreateTracking(companyId, year)

  const updates: Record<string, boolean | Date> = { updatedAt: new Date() }

  if (types.includes("ARRIVALS")) {
    updates.arrivalsWarningShown = true
  }
  if (types.includes("DISPATCHES")) {
    updates.dispatchesWarningShown = true
  }

  await drizzleDb
    .update(intrastatTracking)
    .set(updates)
    .where(eq(intrastatTracking.id, tracking.id))
}
