// src/lib/regulatory-truth/utils/scan-scheduler.ts

import { FreshnessRisk } from "@prisma/client"

export interface ScheduleConfig {
  baseIntervalHours: number
  maxIntervalHours: number
  jitterPercent: number
}

const DEFAULT_CONFIG: ScheduleConfig = {
  baseIntervalHours: 4,
  maxIntervalHours: 720,
  jitterPercent: 0.1,
}

const RISK_FACTORS: Record<FreshnessRisk, number> = {
  CRITICAL: 4.0,
  HIGH: 2.0,
  MEDIUM: 1.0,
  LOW: 0.5,
}

export function calculateNextScan(
  changeFrequency: number,
  freshnessRisk: FreshnessRisk,
  config: ScheduleConfig = DEFAULT_CONFIG
): Date {
  // Reuse calculateIntervalHours for DRY
  const intervalHours = calculateIntervalHours(changeFrequency, freshnessRisk, config)

  // Apply jitter using config value
  const jitter = 1 + (Math.random() * 2 * config.jitterPercent - config.jitterPercent)
  const jitteredHours = intervalHours * jitter

  const nextScan = new Date()
  nextScan.setTime(nextScan.getTime() + jitteredHours * 60 * 60 * 1000)
  return nextScan
}

export function calculateIntervalHours(
  changeFrequency: number,
  freshnessRisk: FreshnessRisk,
  config: ScheduleConfig = DEFAULT_CONFIG
): number {
  const riskFactor = RISK_FACTORS[freshnessRisk]
  const velocityFactor = Math.max(0.01, changeFrequency)
  let intervalHours = config.baseIntervalHours / (velocityFactor * riskFactor)
  intervalHours = Math.max(config.baseIntervalHours, intervalHours)
  intervalHours = Math.min(config.maxIntervalHours, intervalHours)
  return Math.round(intervalHours * 10) / 10
}

export function describeInterval(hours: number): string {
  if (hours < 24) return `${Math.round(hours)}h`
  if (hours < 168) return `${Math.round(hours / 24)}d`
  return `${Math.round(hours / 168)}w`
}
