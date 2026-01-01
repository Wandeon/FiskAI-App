// src/domain/compliance/Severity.ts

/**
 * Enum for compliance deadline severity levels
 * Order from highest to lowest: CRITICAL > HIGH > NORMAL > LOW
 */
export const Severity = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  NORMAL: "NORMAL",
  LOW: "LOW",

  /**
   * Returns all valid severity values
   */
  values(): string[] {
    return [this.CRITICAL, this.HIGH, this.NORMAL, this.LOW]
  },

  /**
   * Checks if a value is a valid severity level
   */
  isValid(value: string): boolean {
    return this.values().includes(value)
  },

  /**
   * Compares two severity levels
   * Returns positive if a > b, negative if a < b, 0 if equal
   * CRITICAL > HIGH > NORMAL > LOW
   */
  compare(a: string, b: string): number {
    const order: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1,
    }
    return (order[a] ?? 0) - (order[b] ?? 0)
  },
} as const

export type Severity = (typeof Severity)[keyof typeof Severity]
