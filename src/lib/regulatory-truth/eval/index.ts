// src/lib/regulatory-truth/eval/index.ts
/**
 * Regulatory Truth Evaluation Module
 *
 * Exports all evaluation types, functions, and rules.
 */

// Context fields
export {
  CONTEXT_FIELDS,
  isValidFieldPath,
  getFieldDefinition,
  getFieldsByPrefix,
  getContextValue,
  setContextValue,
  type FieldDefinition,
  type ContextFieldPath,
  type EvaluationContext,
} from "./context-fields"

// Assertion schema
export {
  ASSERTION_SCHEMA_VERSION,
  validateAssertion,
  generateAssertionId,
  createThresholdAssertion,
  type Assertion,
  type AssertionType,
  type Citation,
  type TopicDomain,
  type TopicArea,
  type TopicSubarea,
  type MeasurementBasis,
  type ConfidenceLevel,
  type ValueKind,
  type ValidationResult,
} from "./assertion-schema"

// Rule DSL
export {
  DSL_VERSION,
  validateRule,
  generateRuleId,
  createThresholdRule,
  type Rule,
  type Condition,
  type Obligation,
  type RuleSource,
  type ComparisonOp,
  type RuleValidationResult,
} from "./rule-dsl"

// Evaluator
export { evaluateRule, generateAnswer, type EvaluationResult, type AnswerResult } from "./evaluator"

// Rules
export {
  PDV_THRESHOLD_ASSERTION,
  VAT_REGISTRATION_RULE,
  PDV_THRESHOLD_EVIDENCE,
  getVatThresholdCitationLabel,
} from "./rules/vat-registration-hr"

// Query interface
export {
  answerQuery,
  answerMoramLiUciUPdv,
  formatQueryOutput,
  type QueryType,
  type QueryInput,
  type QueryOutput,
  type TemporalSelectionReason,
} from "./query"

// Rule store types (safe to import in unit tests)
export {
  type TopicKey,
  type RuleSelectionResult,
  type RuleSelectionReason,
} from "./rule-store-types"

// Note: Rule store FUNCTIONS (selectRuleFromDb, hasRuleForTopic, getRuleCoverage)
// are NOT re-exported here to avoid pulling in DB dependencies.
// Import them directly from "./rule-store" when needed.

// Edge types (separate from implementation to avoid DB imports in unit tests)
export { type EdgeBuildResult, type EdgeTrace } from "../graph/edge-types"

// Note: Edge tracing FUNCTIONS (rebuildEdgesForRule, buildEdgeTrace, findSupersedingRules, findSupersededRules)
// are NOT re-exported here to avoid pulling in DB dependencies.
// Import them directly from "../graph/edge-builder" when needed.
