// src/domain/compliance/Recurrence.ts
import { ComplianceError } from "./ComplianceError"

export type RecurrenceType = "MONTHLY" | "QUARTERLY" | "YEARLY" | "ONE_TIME"

interface RecurrenceProps {
  type: RecurrenceType
  dayOfMonth?: number
  month?: number // 1-12
  specificDate?: Date
}

/**
 * Value object representing recurrence pattern for compliance deadlines
 */
export class Recurrence {
  private readonly props: RecurrenceProps

  private constructor(props: RecurrenceProps) {
    this.props = props
  }

  /**
   * Creates a monthly recurrence on the specified day
   */
  static monthly(dayOfMonth: number): Recurrence {
    Recurrence.validateDayOfMonth(dayOfMonth)
    return new Recurrence({ type: "MONTHLY", dayOfMonth })
  }

  /**
   * Creates a quarterly recurrence on the specified day of the quarter's first month
   * Quarters: Q1 (Jan), Q2 (Apr), Q3 (Jul), Q4 (Oct)
   */
  static quarterly(dayOfMonth: number): Recurrence {
    Recurrence.validateDayOfMonth(dayOfMonth)
    return new Recurrence({ type: "QUARTERLY", dayOfMonth })
  }

  /**
   * Creates a yearly recurrence on the specified month and day
   * @param month 1-12 (January = 1)
   * @param dayOfMonth 1-31
   */
  static yearly(month: number, dayOfMonth: number): Recurrence {
    if (month < 1 || month > 12) {
      throw new ComplianceError("Month must be between 1 and 12")
    }
    Recurrence.validateDayOfMonth(dayOfMonth)
    return new Recurrence({ type: "YEARLY", month, dayOfMonth })
  }

  /**
   * Creates a one-time occurrence on a specific date
   */
  static oneTime(date: Date): Recurrence {
    return new Recurrence({ type: "ONE_TIME", specificDate: new Date(date) })
  }

  private static validateDayOfMonth(day: number): void {
    if (day < 1 || day > 31) {
      throw new ComplianceError("Day of month must be between 1 and 31")
    }
  }

  get type(): RecurrenceType {
    return this.props.type
  }

  get dayOfMonth(): number | undefined {
    return this.props.dayOfMonth
  }

  get month(): number | undefined {
    return this.props.month
  }

  get specificDate(): Date | undefined {
    return this.props.specificDate ? new Date(this.props.specificDate) : undefined
  }

  get isRecurring(): boolean {
    return this.props.type !== "ONE_TIME"
  }

  /**
   * Calculates the next occurrence of the deadline from a given date
   */
  getNextOccurrence(fromDate: Date): Date {
    const from = new Date(fromDate)
    from.setHours(0, 0, 0, 0)

    switch (this.props.type) {
      case "ONE_TIME":
        return new Date(this.props.specificDate!)

      case "MONTHLY":
        return this.getNextMonthlyOccurrence(from)

      case "QUARTERLY":
        return this.getNextQuarterlyOccurrence(from)

      case "YEARLY":
        return this.getNextYearlyOccurrence(from)

      default:
        throw new ComplianceError(`Unknown recurrence type: ${this.props.type}`)
    }
  }

  private getNextMonthlyOccurrence(from: Date): Date {
    const day = this.props.dayOfMonth!
    const year = from.getFullYear()
    const month = from.getMonth()

    // Try this month first
    let candidate = this.createDateWithDayOverflow(year, month, day)

    // If we've passed this month's deadline, go to next month
    if (candidate <= from) {
      candidate = this.createDateWithDayOverflow(year, month + 1, day)
    }

    return candidate
  }

  private getNextQuarterlyOccurrence(from: Date): Date {
    const day = this.props.dayOfMonth!
    const year = from.getFullYear()
    const currentMonth = from.getMonth()

    // Quarter start months: 0 (Jan), 3 (Apr), 6 (Jul), 9 (Oct)
    const quarterMonths = [0, 3, 6, 9]

    // Find current quarter start
    let quarterIndex = Math.floor(currentMonth / 3)
    let quarterMonth = quarterMonths[quarterIndex]

    // Try current quarter
    let candidate = this.createDateWithDayOverflow(year, quarterMonth, day)

    // If we've passed this quarter's deadline, go to next quarter
    if (candidate <= from) {
      quarterIndex = (quarterIndex + 1) % 4
      const nextYear = quarterIndex === 0 ? year + 1 : year
      quarterMonth = quarterMonths[quarterIndex]
      candidate = this.createDateWithDayOverflow(nextYear, quarterMonth, day)
    }

    return candidate
  }

  private getNextYearlyOccurrence(from: Date): Date {
    const day = this.props.dayOfMonth!
    const month = this.props.month! - 1 // Convert to 0-indexed
    const year = from.getFullYear()

    let candidate = this.createDateWithDayOverflow(year, month, day)

    // If we've passed this year's deadline, go to next year
    if (candidate <= from) {
      candidate = this.createDateWithDayOverflow(year + 1, month, day)
    }

    return candidate
  }

  /**
   * Creates a date, handling overflow for months with fewer days
   * e.g., Feb 31 -> Feb 28
   */
  private createDateWithDayOverflow(year: number, month: number, day: number): Date {
    // Normalize month (handles month > 11)
    const normalizedYear = year + Math.floor(month / 12)
    const normalizedMonth = month % 12

    // Get the last day of the target month
    const lastDay = new Date(normalizedYear, normalizedMonth + 1, 0).getDate()
    const actualDay = Math.min(day, lastDay)

    return new Date(normalizedYear, normalizedMonth, actualDay)
  }

  /**
   * Serializes the recurrence to a plain object for storage
   */
  toJSON(): RecurrenceProps {
    return { ...this.props }
  }

  /**
   * Reconstitutes a Recurrence from stored props
   */
  static fromJSON(props: RecurrenceProps): Recurrence {
    if (props.specificDate) {
      props.specificDate = new Date(props.specificDate)
    }
    return new Recurrence(props)
  }
}
