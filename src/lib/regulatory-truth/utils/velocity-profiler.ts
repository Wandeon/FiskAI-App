// src/lib/regulatory-truth/utils/velocity-profiler.ts

export interface VelocityUpdate {
  newFrequency: number
  lastChangedAt: Date | null
}

export interface VelocityConfig {
  warmupScans: number
  alphaChange: number
  alphaStable: number
  minFrequency: number
  maxFrequency: number
}

const DEFAULT_CONFIG: VelocityConfig = {
  warmupScans: 3,
  alphaChange: 0.3,
  alphaStable: 0.1,
  minFrequency: 0.01,
  maxFrequency: 0.99,
}

export function updateVelocity(
  currentFrequency: number,
  scanCount: number,
  contentChanged: boolean,
  config: VelocityConfig = DEFAULT_CONFIG
): VelocityUpdate {
  if (scanCount < config.warmupScans) {
    return { newFrequency: 0.5, lastChangedAt: contentChanged ? new Date() : null }
  }

  const alpha = contentChanged ? config.alphaChange : config.alphaStable
  const signal = contentChanged ? 1.0 : 0.0
  const rawFrequency = alpha * signal + (1 - alpha) * currentFrequency
  const newFrequency = Math.max(config.minFrequency, Math.min(config.maxFrequency, rawFrequency))

  return { newFrequency, lastChangedAt: contentChanged ? new Date() : null }
}

export function describeVelocity(frequency: number): string {
  if (frequency >= 0.8) return "volatile"
  if (frequency >= 0.5) return "active"
  if (frequency >= 0.2) return "moderate"
  return "static"
}
