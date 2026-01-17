// src/lib/shared/dsl/index.ts
// Shared DSL module - re-exports for convenient importing

// AppliesWhen DSL for rule condition evaluation
export {
  evaluateAppliesWhen,
  parseAppliesWhen,
  validateAppliesWhen,
  predicates,
  appliesWhenSchema,
  type AppliesWhenPredicate,
  type EvaluationContext,
} from "./applies-when"

// Outcome DSL for rule results
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
} from "./outcome"
