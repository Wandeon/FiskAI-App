export interface SecurityEvent {
  type: "TENANT_SCOPE_VIOLATION" | "UNAUTHORIZED_ACCESS" | "SUSPICIOUS_ACTIVITY"
  actorUserId: string
  expectedCompanyId?: string
  actualCompanyId?: string
  aggregateType?: string
  aggregateId?: string
  operation?: string
  correlationId: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export function logSecurityEvent(event: SecurityEvent): void {
  // Structured logging - best-effort, failures swallowed by caller
  console.warn("[SECURITY]", JSON.stringify(event))

  // TODO: Send to security monitoring (SIEM, alerts)
}
