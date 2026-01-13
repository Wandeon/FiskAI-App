// src/lib/regulatory-truth/utils/confidence-envelope.ts
//
// Mission #3: Confidence Envelope for RegulatoryRule
//
// Re-exports pure functions from confidence-envelope.types.ts
// This file maintains backward compatibility for existing imports.

// Re-export all pure types and functions
export {
  ConfidenceReason,
  type ConfidenceReasonEntry,
  type ConfidenceEnvelope,
  type ConfidenceEnvelopeInput,
  computeConfidenceEnvelope,
  summarizeConfidenceReasons,
  hasSignificantConcerns,
} from "./confidence-envelope.types"
