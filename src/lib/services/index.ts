// src/lib/services/index.ts

/**
 * Services Index
 *
 * Central export point for all service facades.
 */

export {
  RegulatoryCalendarService,
  regulatoryCalendarService,
  type ContributionType,
  type DeadlineType,
  type VatRateType,
  type ContributionInfo,
  type MonthlyContributionsResult,
  type DeadlineResult,
} from "./regulatory-calendar.service"

export {
  TokenResolver,
  tokenResolver,
  type TokenContext,
  type TokenCompany,
  type TokenUser,
} from "./token-resolver.service"

export {
  ComplianceService,
  complianceService,
  ComplianceState,
  ComplianceReasonCodes,
  type ComplianceStatus,
  type ComplianceReason,
  type ComplianceReasonSeverity,
} from "./compliance.service"

export {
  DataProvenanceService,
  dataProvenanceService,
  DataSource,
  ConfidenceLevel,
  type RecordProvenanceParams,
  type UpdateProvenanceParams,
  type FieldProvenance,
  type EntityProvenanceMap,
  type ProvenanceDisplay,
} from "./data-provenance.service"

export {
  PaymentMatchingService,
  paymentMatchingService,
  MatchConfidenceLevel,
  type AutoMatchMethod,
  type MatchMethod,
  type MatchIndicator,
  type PotentialMatch,
  type MatchHistory,
  type AuditEntry,
  type MatchDisplay,
  type MatchingResult,
} from "./payment-matching.service"
