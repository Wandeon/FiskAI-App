import type { SystemStatusEventType } from "./types"

export interface SystemStatusEventInput {
  eventType: SystemStatusEventType
  severity: string
  message: string
  nextAction: string
  componentId?: string
  owner?: string
  link?: string
}

export function diffSnapshots(prev: any, next: any): SystemStatusEventInput[] {
  const events: SystemStatusEventInput[] = []
  if ((next.criticalCount ?? 0) > (prev.criticalCount ?? 0)) {
    events.push({
      eventType: "NEW_CRITICAL",
      severity: "CRITICAL",
      message: "New CRITICAL issue detected",
      nextAction: "Open top item and follow the action",
    })
  }
  return events
}
