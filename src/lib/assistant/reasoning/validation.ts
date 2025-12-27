// src/lib/assistant/reasoning/validation.ts
import { z } from "zod"
import { REASONING_EVENT_VERSION } from "./types"

// === ENUMS AS ZOD ===
const ReasoningStageSchema = z.enum([
  "QUESTION_INTAKE",
  "CONTEXT_RESOLUTION",
  "CLARIFICATION",
  "SOURCES",
  "RETRIEVAL",
  "APPLICABILITY",
  "CONFLICTS",
  "ANALYSIS",
  "CONFIDENCE",
  "ANSWER",
  "CONDITIONAL_ANSWER",
  "REFUSAL",
  "ERROR",
])

const ReasoningStatusSchema = z.enum([
  "started",
  "progress",
  "checkpoint",
  "complete",
  "awaiting_input",
])

const SeveritySchema = z.enum(["info", "warning", "critical"])

const RiskTierSchema = z.enum(["T0", "T1", "T2", "T3"])

const AuthoritySchema = z.enum(["LAW", "REGULATION", "GUIDANCE", "PRACTICE"])

// === PAYLOAD SCHEMAS ===
const UserContextSnapshotSchema = z.object({
  vatStatus: z.enum(["registered", "unregistered", "unknown"]).optional(),
  turnoverBand: z.string().optional(),
  companySize: z.enum(["micro", "small", "medium", "large"]).optional(),
  jurisdiction: z.string().optional(),
  assumedDefaults: z.array(z.string()),
})

const ContextResolutionPayloadSchema = z.object({
  summary: z.string(),
  jurisdiction: z.enum(["HR", "EU", "UNKNOWN"]),
  domain: z.enum(["TAX", "LABOR", "COMPANY", "FINANCE", "OTHER"]),
  riskTier: RiskTierSchema,
  language: z.enum(["hr", "en"]),
  intent: z.enum(["QUESTION", "HOWTO", "CHECKLIST", "UNKNOWN"]),
  asOfDate: z.string(),
  entities: z.array(
    z.object({
      type: z.string(),
      value: z.string(),
      confidence: z.number(),
    })
  ),
  confidence: z.number().min(0).max(1),
  requiresClarification: z.boolean(),
  userContextSnapshot: UserContextSnapshotSchema,
})

const CitationSchema = z.object({
  id: z.string(),
  title: z.string(),
  authority: AuthoritySchema,
  quote: z.string(),
  url: z.string().url(),
  evidenceId: z.string(),
  fetchedAt: z.string(),
})

const FinalAnswerPayloadSchema = z.object({
  asOfDate: z.string(),
  answerHr: z.string(),
  structured: z
    .object({
      obligations: z.array(z.string()).optional(),
      deadlines: z.array(z.string()).optional(),
      thresholds: z.array(z.string()).optional(),
      exceptions: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
  citations: z.array(CitationSchema).min(1),
  limits: z.array(z.string()).optional(),
})

const ConflictWarningSchema = z.object({
  description: z.string(),
  sourceA: z.object({ name: z.string(), says: z.string() }),
  sourceB: z.object({ name: z.string(), says: z.string() }),
  practicalResolution: z.string().optional(),
})

const QualifiedAnswerPayloadSchema = z.object({
  asOfDate: z.string(),
  answerHr: z.string(),
  structured: z
    .object({
      obligations: z.array(z.string()).optional(),
      deadlines: z.array(z.string()).optional(),
      thresholds: z.array(z.string()).optional(),
      exceptions: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
  citations: z.array(CitationSchema).min(1),
  conflictWarnings: z.array(ConflictWarningSchema),
  caveats: z.array(z.string()),
  limits: z.array(z.string()).optional(),
})

const RefusalPayloadSchema = z.object({
  reason: z.enum([
    "NO_CITABLE_RULES",
    "OUT_OF_SCOPE",
    "MISSING_CLIENT_DATA",
    "UNRESOLVED_CONFLICT",
    "NEEDS_CLARIFICATION",
    "UNSUPPORTED_JURISDICTION",
    "UNSUPPORTED_DOMAIN",
  ]),
  message: z.string(),
  relatedTopics: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
})

const ErrorPayloadSchema = z.object({
  code: z.enum(["INTERNAL", "VALIDATION_FAILED", "CAPACITY", "TIMEOUT"]),
  message: z.string(),
  correlationId: z.string(),
  retriable: z.boolean(),
})

// === MAIN EVENT SCHEMA ===
export const ReasoningEventSchema = z.object({
  v: z.literal(REASONING_EVENT_VERSION),
  id: z.string(),
  requestId: z.string(),
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  stage: ReasoningStageSchema,
  status: ReasoningStatusSchema,
  message: z.string().optional(),
  severity: SeveritySchema.optional(),
  progress: z
    .object({
      current: z.number(),
      total: z.number().optional(),
    })
    .optional(),
  trace: z
    .object({
      runId: z.string(),
      span: z.string().optional(),
    })
    .optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  data: z.unknown().optional(),
})

// === TERMINAL PAYLOAD SCHEMA ===
export const TerminalPayloadSchema = z.discriminatedUnion("outcome", [
  z.object({ outcome: z.literal("ANSWER") }).merge(FinalAnswerPayloadSchema),
  z.object({ outcome: z.literal("CONDITIONAL_ANSWER") }).merge(QualifiedAnswerPayloadSchema),
  z.object({ outcome: z.literal("REFUSAL") }).merge(RefusalPayloadSchema),
  z.object({ outcome: z.literal("ERROR") }).merge(ErrorPayloadSchema),
])

// === VALIDATION HELPERS ===
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateReasoningEvent(event: unknown): ValidationResult {
  const result = ReasoningEventSchema.safeParse(event)
  if (result.success) {
    return { valid: true, errors: [] }
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  }
}

export function validateTerminalPayload(payload: unknown): ValidationResult {
  const result = TerminalPayloadSchema.safeParse(payload)
  if (result.success) {
    return { valid: true, errors: [] }
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  }
}

// === FAIL-CLOSED INVARIANT CHECKER ===
export interface AnswerInvariants {
  citations: boolean
  asOfDate: boolean
  appliesWhenEvaluated: boolean
  eligibleRulesCount: boolean
  userContextSnapshot: boolean
}

export function checkAnswerInvariants(
  payload: unknown,
  eligibleCount: number,
  hasUserContext: boolean
): { valid: boolean; violations: string[] } {
  const violations: string[] = []
  const p = payload as Record<string, unknown>

  // Citations must be non-empty array
  if (!Array.isArray(p.citations) || p.citations.length === 0) {
    violations.push("citations: must be non-empty array")
  }

  // asOfDate must be present
  if (!p.asOfDate || typeof p.asOfDate !== "string") {
    violations.push("asOfDate: must be present")
  }

  // Must have eligible rules
  if (eligibleCount <= 0) {
    violations.push("eligibleRulesCount: must be > 0")
  }

  // User context snapshot required
  if (!hasUserContext) {
    violations.push("userContextSnapshot: must be frozen at request start")
  }

  return {
    valid: violations.length === 0,
    violations,
  }
}
