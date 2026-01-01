// src/domain/compliance/ComplianceDeadline.ts
import { ComplianceError } from "./ComplianceError"
import { DeadlineType } from "./DeadlineType"
import { Severity } from "./Severity"
import { Recurrence } from "./Recurrence"
import { ApplicabilityRule } from "./ApplicabilityRule"

export interface ComplianceDeadlineProps {
  id: string
  title: string
  description: string
  deadlineType:
    | typeof DeadlineType.TAX
    | typeof DeadlineType.REPORTING
    | typeof DeadlineType.REGISTRATION
    | typeof DeadlineType.REGULATORY
  severity:
    | typeof Severity.CRITICAL
    | typeof Severity.HIGH
    | typeof Severity.NORMAL
    | typeof Severity.LOW
  recurrence: Recurrence
  appliesTo: ApplicabilityRule
  sourceUrl: string
  sourceName: string
  createdAt: Date
  updatedAt: Date
}

interface CreateDeadlineInput {
  title: string
  description: string
  deadlineType:
    | typeof DeadlineType.TAX
    | typeof DeadlineType.REPORTING
    | typeof DeadlineType.REGISTRATION
    | typeof DeadlineType.REGULATORY
  severity:
    | typeof Severity.CRITICAL
    | typeof Severity.HIGH
    | typeof Severity.NORMAL
    | typeof Severity.LOW
  recurrence: Recurrence
  appliesTo: ApplicabilityRule
  sourceUrl: string
  sourceName: string
}

/**
 * ComplianceDeadline Aggregate - represents a compliance deadline that businesses must meet
 */
export class ComplianceDeadline {
  private props: ComplianceDeadlineProps

  private constructor(props: ComplianceDeadlineProps) {
    this.props = props
  }

  /**
   * Factory method to create a new ComplianceDeadline
   */
  static create(input: CreateDeadlineInput): ComplianceDeadline {
    // Validate title
    if (!input.title || input.title.trim() === "") {
      throw new ComplianceError("Deadline title cannot be empty")
    }

    // Validate description
    if (!input.description || input.description.trim() === "") {
      throw new ComplianceError("Deadline description cannot be empty")
    }

    // Validate deadline type
    if (!DeadlineType.isValid(input.deadlineType)) {
      throw new ComplianceError(`Invalid deadline type: ${input.deadlineType}`)
    }

    // Validate severity
    if (!Severity.isValid(input.severity)) {
      throw new ComplianceError(`Invalid severity: ${input.severity}`)
    }

    // Validate sourceUrl
    if (!input.sourceUrl || input.sourceUrl.trim() === "") {
      throw new ComplianceError("Source URL cannot be empty")
    }

    // Validate sourceName
    if (!input.sourceName || input.sourceName.trim() === "") {
      throw new ComplianceError("Source name cannot be empty")
    }

    const now = new Date()
    return new ComplianceDeadline({
      id: crypto.randomUUID(),
      title: input.title.trim(),
      description: input.description.trim(),
      deadlineType: input.deadlineType,
      severity: input.severity,
      recurrence: input.recurrence,
      appliesTo: input.appliesTo,
      sourceUrl: input.sourceUrl.trim(),
      sourceName: input.sourceName.trim(),
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * Reconstitutes a ComplianceDeadline from stored props (e.g., from database)
   */
  static reconstitute(props: ComplianceDeadlineProps): ComplianceDeadline {
    return new ComplianceDeadline(props)
  }

  // Getters
  get id(): string {
    return this.props.id
  }

  get title(): string {
    return this.props.title
  }

  get description(): string {
    return this.props.description
  }

  get deadlineType(): string {
    return this.props.deadlineType
  }

  get severity(): string {
    return this.props.severity
  }

  get recurrence(): Recurrence {
    return this.props.recurrence
  }

  get appliesTo(): ApplicabilityRule {
    return this.props.appliesTo
  }

  get sourceUrl(): string {
    return this.props.sourceUrl
  }

  get sourceName(): string {
    return this.props.sourceName
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  // Business methods

  /**
   * Checks if this deadline is applicable to a given business type
   */
  isApplicableTo(businessType: string): boolean {
    return this.props.appliesTo.appliesTo(businessType)
  }

  /**
   * Gets the next occurrence of this deadline from a given date
   */
  getNextOccurrence(fromDate: Date): Date {
    return this.props.recurrence.getNextOccurrence(fromDate)
  }

  /**
   * Calculates the number of days until the next occurrence
   * Returns negative if the deadline has passed (for one-time deadlines)
   */
  getDaysUntil(fromDate?: Date): number {
    const from = fromDate ?? new Date()
    from.setHours(0, 0, 0, 0)

    const next = this.getNextOccurrence(from)
    next.setHours(0, 0, 0, 0)

    const diffTime = next.getTime() - from.getTime()
    return Math.round(diffTime / (1000 * 60 * 60 * 24))
  }

  /**
   * Checks if the deadline is approaching within the specified number of days
   * Default threshold is 7 days
   */
  isApproaching(days: number = 7, fromDate?: Date): boolean {
    const daysUntil = this.getDaysUntil(fromDate)
    return daysUntil >= 0 && daysUntil <= days
  }

  /**
   * Checks if the deadline is overdue
   * For recurring deadlines, this always returns false (they have a next occurrence)
   * For one-time deadlines, returns true if the date has passed
   */
  isOverdue(asOfDate?: Date): boolean {
    // Recurring deadlines always have a future occurrence
    if (this.props.recurrence.isRecurring) {
      return false
    }

    // For one-time deadlines, check if the date has passed
    const asOf = asOfDate ?? new Date()
    asOf.setHours(0, 0, 0, 0)

    const deadline = this.props.recurrence.specificDate!
    const deadlineDate = new Date(deadline)
    deadlineDate.setHours(0, 0, 0, 0)

    return asOf > deadlineDate
  }

  // Update methods

  /**
   * Updates the deadline title
   */
  updateTitle(title: string): void {
    if (!title || title.trim() === "") {
      throw new ComplianceError("Deadline title cannot be empty")
    }
    this.props.title = title.trim()
    this.props.updatedAt = new Date()
  }

  /**
   * Updates the deadline severity
   */
  updateSeverity(
    severity:
      | typeof Severity.CRITICAL
      | typeof Severity.HIGH
      | typeof Severity.NORMAL
      | typeof Severity.LOW
  ): void {
    if (!Severity.isValid(severity)) {
      throw new ComplianceError(`Invalid severity: ${severity}`)
    }
    this.props.severity = severity
    this.props.updatedAt = new Date()
  }

  /**
   * Updates the applicability rule
   */
  updateApplicability(rule: ApplicabilityRule): void {
    this.props.appliesTo = rule
    this.props.updatedAt = new Date()
  }
}
