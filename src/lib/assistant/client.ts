/**
 * Client-safe exports from the assistant module
 *
 * This file only exports types and client-side hooks
 * that are safe to use in client components.
 */

// Types (safe - just TypeScript types)
export * from "./types"

// Fixtures (safe - just static data)
export * from "./fixtures"

// Hooks (safe - client-side React hooks)
export { useAssistantController } from "./hooks/useAssistantController"
export { useFocusManagement } from "./hooks/useFocusManagement"
export { useRovingTabindex } from "./hooks/useRovingTabindex"
export { useReducedMotion } from "./hooks/useReducedMotion"
export { useCTAEligibility } from "./hooks/useCTAEligibility"
export { useCTADismissal } from "./hooks/useCTADismissal"
export { useAssistantAnalytics } from "./hooks/useAssistantAnalytics"
