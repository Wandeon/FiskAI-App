import { HEADLINE_STATUSES } from "./types"

export async function computeSystemStatusSnapshot({
  requestedByUserId,
  timeoutSeconds,
}: {
  requestedByUserId: string
  timeoutSeconds: number
}) {
  return {
    headlineStatus: HEADLINE_STATUSES[0],
    refreshQuality: "FULL",
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    observedCount: 0,
    declaredCount: 0,
    newDriftSinceDays: 7,
    lastRefreshStartedAt: new Date(),
    lastRefreshEndedAt: new Date(),
    lastRefreshStatus: "SUCCESS",
    lastRefreshError: null,
    topItems: [],
  }
}
