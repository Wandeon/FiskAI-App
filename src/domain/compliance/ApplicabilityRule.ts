// src/domain/compliance/ApplicabilityRule.ts
import { ComplianceError } from "./ComplianceError"

type RuleType = "ALL" | "INCLUDE" | "EXCLUDE"

interface ApplicabilityRuleProps {
  type: RuleType
  businessTypes?: string[]
}

export interface ApplicabilityRuleJSON {
  type: RuleType
  businessTypes?: string[]
}

/**
 * Value object representing which business types a compliance deadline applies to
 */
export class ApplicabilityRule {
  private readonly props: ApplicabilityRuleProps

  private constructor(props: ApplicabilityRuleProps) {
    this.props = props
  }

  /**
   * Creates a rule that applies to all business types
   */
  static all(): ApplicabilityRule {
    return new ApplicabilityRule({ type: "ALL" })
  }

  /**
   * Creates a rule that applies only to the specified business types
   */
  static forTypes(businessTypes: string[]): ApplicabilityRule {
    if (!businessTypes || businessTypes.length === 0) {
      throw new ComplianceError("Business types array cannot be empty")
    }
    return new ApplicabilityRule({
      type: "INCLUDE",
      businessTypes: businessTypes.map((t) => t.toLowerCase().trim()),
    })
  }

  /**
   * Creates a rule that applies to all business types except the specified ones
   */
  static except(businessTypes: string[]): ApplicabilityRule {
    if (!businessTypes || businessTypes.length === 0) {
      throw new ComplianceError("Business types array cannot be empty")
    }
    return new ApplicabilityRule({
      type: "EXCLUDE",
      businessTypes: businessTypes.map((t) => t.toLowerCase().trim()),
    })
  }

  /**
   * Checks if the rule applies to a given business type
   */
  appliesTo(businessType: string): boolean {
    const normalizedType = businessType.toLowerCase().trim()

    switch (this.props.type) {
      case "ALL":
        return true

      case "INCLUDE":
        return this.props.businessTypes!.includes(normalizedType)

      case "EXCLUDE":
        return !this.props.businessTypes!.includes(normalizedType)

      default:
        return false
    }
  }

  /**
   * Serializes the rule to a plain object for storage
   */
  toJSON(): ApplicabilityRuleJSON {
    if (this.props.type === "ALL") {
      return { type: "ALL" }
    }
    return {
      type: this.props.type,
      businessTypes: [...this.props.businessTypes!],
    }
  }

  /**
   * Reconstitutes an ApplicabilityRule from stored JSON
   */
  static fromJSON(json: ApplicabilityRuleJSON): ApplicabilityRule {
    switch (json.type) {
      case "ALL":
        return ApplicabilityRule.all()
      case "INCLUDE":
        return ApplicabilityRule.forTypes(json.businessTypes || [])
      case "EXCLUDE":
        return ApplicabilityRule.except(json.businessTypes || [])
      default:
        throw new ComplianceError(`Unknown applicability rule type: ${json.type}`)
    }
  }
}
