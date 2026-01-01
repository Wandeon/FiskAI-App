// src/domain/compliance/DeadlineType.ts

/**
 * Enum for compliance deadline types
 */
export const DeadlineType = {
  TAX: "TAX",
  REPORTING: "REPORTING",
  REGISTRATION: "REGISTRATION",
  REGULATORY: "REGULATORY",

  /**
   * Returns all valid deadline type values
   */
  values(): string[] {
    return [this.TAX, this.REPORTING, this.REGISTRATION, this.REGULATORY]
  },

  /**
   * Checks if a value is a valid deadline type
   */
  isValid(value: string): boolean {
    return this.values().includes(value)
  },
} as const

export type DeadlineType = (typeof DeadlineType)[keyof typeof DeadlineType]
