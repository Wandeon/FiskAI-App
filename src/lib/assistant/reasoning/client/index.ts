// src/lib/assistant/reasoning/client/index.ts

// Types
export type {
  StreamState,
  ReasoningSelectors,
  ReasoningStreamState,
  ReasoningStreamActions,
  UseReasoningStreamReturn,
  SSEEventType,
} from "./types"
export { SSE_EVENT_TYPES } from "./types"

// Selectors
export {
  createSelectors,
  getTerminalFromEvents,
  getCurrentStage,
  isStageComplete,
  getStageProgress,
} from "./selectors"

// SSE Parser
export { parseSSEMessage, createSSEConnection, type SSEMessage } from "./sse-parser"

// Hook
export { useReasoningStream } from "./useReasoningStream"

// Stage UI Helper
export {
  useReasoningStage,
  getStageLabel,
  getStageIcon,
  type StageState,
} from "./useReasoningStage"
