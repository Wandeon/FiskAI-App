export const HEADLINE_STATUSES = ["OK", "ATTENTION", "ACTION_REQUIRED"] as const
export const REFRESH_STATUSES = ["SUCCESS", "FAILED"] as const
export const REFRESH_QUALITIES = ["FULL", "DEGRADED"] as const
export const EVENT_TYPES = [
  "NEW_CRITICAL",
  "CRITICAL_RESOLVED",
  "OWNER_CHANGED",
  "NEW_OBSERVED",
  "DECLARED_MISSING",
  "UNKNOWN_INTEGRATION",
  "REFRESH_FAILED",
  "REFRESH_DEGRADED",
] as const

export type HeadlineStatus = (typeof HEADLINE_STATUSES)[number]
export type RefreshStatus = (typeof REFRESH_STATUSES)[number]
export type RefreshQuality = (typeof REFRESH_QUALITIES)[number]
export type SystemStatusEventType = (typeof EVENT_TYPES)[number]
