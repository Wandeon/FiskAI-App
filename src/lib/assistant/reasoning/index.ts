// src/lib/assistant/reasoning/index.ts

// Types
export {
  SCHEMA_VERSION,
  REASONING_STAGES,
  isTerminal,
  getTerminalOutcome,
  isNonTerminalStage,
  type ReasoningStage,
  type ReasoningStatus,
  type Severity,
  type TerminalOutcome,
  type RiskTier,
  type ReasoningEvent,
  type BaseReasoningEvent,
  type StagePayload,
  type TerminalPayload,
  type UserContextSnapshot,
  type ContextResolutionPayload,
  type ClarificationPayload,
  type SourcesPayload,
  type SourceSummary,
  type RetrievalPayload,
  type ApplicabilityPayload,
  type RuleExclusion,
  type ExclusionCode,
  type ConflictsPayload,
  type AnalysisPayload,
  type ConfidencePayload,
  type InteractiveDriver,
  type FinalAnswerPayload,
  type QualifiedAnswerPayload,
  type ConflictWarning,
  type RefusalPayload,
  type ErrorPayload,
  type Citation,
} from "./types"

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

// Pipeline
export {
  buildAnswerWithReasoning,
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
