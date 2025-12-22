// src/lib/regulatory-truth/watchdog/types.ts

import type {
  WatchdogSeverity,
  WatchdogHealthStatus,
  WatchdogCheckType,
  WatchdogAlertType,
  AuditResult,
} from "@prisma/client"

export interface DomainDelayConfig {
  base: number // base delay in ms
  maxJitter: number // max additional random delay in ms
}

export const DOMAIN_DELAYS: Record<string, DomainDelayConfig> = {
  "narodne-novine.nn.hr": { base: 3000, maxJitter: 1500 },
  "porezna-uprava.gov.hr": { base: 4000, maxJitter: 2000 },
  "hzzo.hr": { base: 5000, maxJitter: 2500 },
  "mirovinsko.hr": { base: 4000, maxJitter: 2000 },
  "fina.hr": { base: 3000, maxJitter: 1500 },
  "mfin.gov.hr": { base: 4000, maxJitter: 2000 },
}

export interface HealthCheckResult {
  checkType: WatchdogCheckType
  entityId: string
  status: WatchdogHealthStatus
  metric?: number
  threshold?: number
  message?: string
}

export interface AlertPayload {
  severity: WatchdogSeverity
  type: WatchdogAlertType
  entityId?: string
  message: string
  details?: Record<string, unknown>
}

export interface AuditCheckResult {
  name: string
  passed: boolean
  weight: number
  details?: string
}

export interface RuleAuditResult {
  ruleId: string
  conceptSlug: string
  checks: AuditCheckResult[]
  score: number
  passed: boolean
}

export interface AuditReport {
  runDate: Date
  rulesAudited: number
  rulesPassed: number
  rulesFailed: number
  overallScore: number
  result: AuditResult
  findings: RuleAuditResult[]
}

export interface PhaseResult {
  phase: "SCOUT" | "SCRAPE" | "PROCESS" | "HEALTH" | "AUDIT"
  startedAt: Date
  completedAt: Date
  success: boolean
  itemsProcessed: number
  itemsFailed: number
  error?: string
}

export interface WatchdogRunResult {
  runId: string
  startedAt: Date
  completedAt: Date
  phases: PhaseResult[]
  alertsRaised: string[]
}

// Thresholds (can be overridden via env)
export const DEFAULT_THRESHOLDS = {
  STALE_SOURCE_WARNING_DAYS: 7,
  STALE_SOURCE_CRITICAL_DAYS: 14,
  FAILURE_RATE_WARNING: 0.3,
  FAILURE_RATE_CRITICAL: 0.5,
  CONFIDENCE_WARNING: 0.85,
  CONFIDENCE_CRITICAL: 0.75,
  REJECTION_RATE_WARNING: 0.4,
  REJECTION_RATE_CRITICAL: 0.6,
  PHASE_DURATION_WARNING_MULTIPLIER: 2,
  PHASE_DURATION_CRITICAL_MULTIPLIER: 3,
}

export function getThreshold(key: keyof typeof DEFAULT_THRESHOLDS): number {
  const envKey = key.replace(/_/g, "_")
  const envValue = process.env[envKey]
  return envValue ? parseFloat(envValue) : DEFAULT_THRESHOLDS[key]
}
