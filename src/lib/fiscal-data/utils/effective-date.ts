// src/lib/fiscal-data/utils/effective-date.ts

import type { ThresholdValue } from "../types"

/**
 * Value with optional effective dates
 */
interface EffectiveDateValue<T> {
  value: T
  effectiveFrom?: string
  effectiveUntil?: string
  previousValue?: T
  previousEffectiveUntil?: string
  upcomingValue?: T
  upcomingEffectiveFrom?: string
}

/**
 * Get the effective value based on current date
 *
 * Handles three scenarios:
 * 1. Value with effectiveFrom in the future → return previousValue
 * 2. Value with upcomingValue and upcomingEffectiveFrom → return upcoming if past date
 * 3. Normal case → return current value
 *
 * @example
 * // If today is 2024-12-15 and effectiveFrom is 2025-01-01
 * getEffectiveValue({ value: 60000, effectiveFrom: '2025-01-01', previousValue: 40000 })
 * // Returns 40000
 *
 * // If today is 2025-01-15
 * getEffectiveValue({ value: 60000, effectiveFrom: '2025-01-01', previousValue: 40000 })
 * // Returns 60000
 */
export function getEffectiveValue<T>(
  data: EffectiveDateValue<T>,
  referenceDate: Date = new Date()
): T {
  const now = referenceDate

  // Check if we have an upcoming value that should now be effective
  if (data.upcomingValue !== undefined && data.upcomingEffectiveFrom) {
    const upcomingDate = new Date(data.upcomingEffectiveFrom)
    if (now >= upcomingDate) {
      return data.upcomingValue
    }
  }

  // Check if current value's effective date hasn't started yet
  if (data.effectiveFrom) {
    const effectiveDate = new Date(data.effectiveFrom)
    if (now < effectiveDate && data.previousValue !== undefined) {
      return data.previousValue
    }
  }

  // Check if current value has expired
  if (data.effectiveUntil) {
    const expiryDate = new Date(data.effectiveUntil)
    if (now > expiryDate && data.upcomingValue !== undefined) {
      return data.upcomingValue
    }
  }

  return data.value
}

/**
 * Check if a value is currently effective
 */
export function isValueEffective(
  data: EffectiveDateValue<unknown>,
  referenceDate: Date = new Date()
): boolean {
  const now = referenceDate

  if (data.effectiveFrom) {
    const effectiveDate = new Date(data.effectiveFrom)
    if (now < effectiveDate) {
      return false
    }
  }

  if (data.effectiveUntil) {
    const expiryDate = new Date(data.effectiveUntil)
    if (now > expiryDate) {
      return false
    }
  }

  return true
}

/**
 * Get all versions of a value (past, current, future)
 */
export function getValueTimeline<T>(
  data: EffectiveDateValue<T>
): Array<{ value: T; from?: string; until?: string; status: "past" | "current" | "future" }> {
  const now = new Date()
  const timeline: Array<{
    value: T
    from?: string
    until?: string
    status: "past" | "current" | "future"
  }> = []

  // Add previous value if exists
  if (data.previousValue !== undefined) {
    timeline.push({
      value: data.previousValue,
      until: data.previousEffectiveUntil || data.effectiveFrom,
      status: "past",
    })
  }

  // Add current value
  const currentEffective = isValueEffective(data, now)
  timeline.push({
    value: data.value,
    from: data.effectiveFrom,
    until: data.effectiveUntil,
    status: currentEffective
      ? "current"
      : data.effectiveFrom && new Date(data.effectiveFrom) > now
        ? "future"
        : "past",
  })

  // Add upcoming value if exists
  if (data.upcomingValue !== undefined && data.upcomingEffectiveFrom) {
    const upcomingDate = new Date(data.upcomingEffectiveFrom)
    timeline.push({
      value: data.upcomingValue,
      from: data.upcomingEffectiveFrom,
      status: now >= upcomingDate ? "current" : "future",
    })
  }

  return timeline
}

/**
 * Format effective date range for display
 */
export function formatEffectiveDateRange(
  from?: string,
  until?: string,
  locale: string = "hr-HR"
): string {
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale, {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  if (from && until) {
    return `od ${formatDate(from)} do ${formatDate(until)}`
  }

  if (from) {
    return `od ${formatDate(from)}`
  }

  if (until) {
    return `do ${formatDate(until)}`
  }

  return "bez vremenskog ograničenja"
}

/**
 * Check if a value change is upcoming within given days
 */
export function hasUpcomingChange(
  data: EffectiveDateValue<unknown>,
  withinDays: number = 30
): boolean {
  if (!data.upcomingEffectiveFrom) return false

  const now = new Date()
  const upcomingDate = new Date(data.upcomingEffectiveFrom)
  const daysDiff = Math.ceil((upcomingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return daysDiff > 0 && daysDiff <= withinDays
}

/**
 * Get days until a value change
 */
export function daysUntilChange(data: EffectiveDateValue<unknown>): number | null {
  if (!data.upcomingEffectiveFrom) return null

  const now = new Date()
  const upcomingDate = new Date(data.upcomingEffectiveFrom)
  const daysDiff = Math.ceil((upcomingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return daysDiff > 0 ? daysDiff : null
}

/**
 * Specialized function for threshold values
 */
export function getEffectiveThresholdValue(threshold: ThresholdValue): number {
  return getEffectiveValue({
    value: threshold.value,
    effectiveFrom: threshold.effectiveFrom,
    previousValue: threshold.previousValue,
    previousEffectiveUntil: threshold.previousEffectiveUntil,
  })
}
