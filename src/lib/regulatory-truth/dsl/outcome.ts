// src/lib/regulatory-truth/dsl/outcome.ts
// Re-exports from shared DSL module for backwards compatibility
// The actual implementation has been moved to src/lib/shared/dsl/outcome.ts

export {
  parseOutcome,
  validateOutcome,
  outcomes,
  outcomeSchema,
  deadlineSchema,
  stepSchema,
  type Outcome,
  type Deadline,
  type Step,
} from "@/lib/shared/dsl/outcome"
