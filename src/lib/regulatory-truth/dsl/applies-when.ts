// src/lib/regulatory-truth/dsl/applies-when.ts
// Re-exports from shared DSL module for backwards compatibility
// The actual implementation has been moved to src/lib/shared/dsl/applies-when.ts

export {
  evaluateAppliesWhen,
  parseAppliesWhen,
  validateAppliesWhen,
  predicates,
  appliesWhenSchema,
  type AppliesWhenPredicate,
  type EvaluationContext,
} from "@/lib/shared/dsl/applies-when"
