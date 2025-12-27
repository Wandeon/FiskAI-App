// src/lib/assistant/reasoning/index.ts

// Types
export * from "./types"

// Core pipeline
export { buildAnswerWithReasoning } from "./reasoning-pipeline"

// Decision coverage
export {
  calculateDecisionCoverage,
  inferTopicFromIntent,
  type DecisionCoverageResult,
  type ResolvedDimension,
  type UnresolvedDimension,
  type ConditionalBranch,
  type TerminalOutcome,
} from "./decision-coverage"

// Topic dimensions
export {
  getTopicDimensions,
  getAllTopics,
  isConditionallyRequired,
  VAT_RATE_DIMENSIONS,
  OSS_THRESHOLD_DIMENSIONS,
  PAUSALNI_DIMENSIONS,
  REGISTRATION_DIMENSIONS,
  type TopicDimensions,
  type DimensionRequirement,
} from "./topic-dimensions"

// Refusal policy
export {
  RefusalCode,
  getRefusalTemplate,
  buildRefusalPayload,
  determineRefusalCode,
  type RefusalTemplate,
  type RefusalPayload,
  type RefusalContext,
  type NextStep,
} from "./refusal-policy"

// Re-export Surface from assistant types for convenience
export type { Surface } from "@/lib/assistant/types"

// Validation
export {
  ReasoningEventSchema,
  TerminalPayloadSchema,
  validateReasoningEvent,
  validateTerminalPayload,
  checkAnswerInvariants,
  type ValidationResult,
  type AnswerInvariants,
} from "./validation"

// Event Factory
export { createEventFactory, type EventFactory, type EventEmitOptions } from "./event-factory"

// Legacy Pipeline (for backward compatibility)
export {
  buildAnswerWithReasoning as buildAnswerWithReasoningLegacy,
  type CompanyContext,
  type ClarificationQuestion,
  type ClarificationAnswer,
} from "./pipeline"

// Sinks
export {
  type ReasoningSink,
  type SinkMode,
  createAuditSink,
  createSSESink,
  createMetricsSink,
  sendHeartbeat,
  consumeReasoning,
} from "./sinks"

// Stages
export {
  contextResolutionStage,
  sourceDiscoveryStage,
  type ContextResolution,
  type SourceDiscoveryResult,
} from "./stages"

// Compatibility layer (for backward-compatible wrapper)
export { buildAnswerCompat } from "./compat"

// Feature Flags
export {
  isReasoningEnabled,
  getReasoningMode,
  isInReasoningBeta,
  getReasoningModeForUser,
  type ReasoningMode,
} from "./feature-flags"

// Shadow Mode
export { runShadowMode, compareShadowResults } from "./shadow-runner"

// Metrics
export {
  getMetrics,
  createMetricsCollector,
  resetMetricsSingleton,
  type ReasoningMetrics,
  type MetricEvent,
  type MetricStats,
} from "./metrics"
