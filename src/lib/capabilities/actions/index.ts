/**
 * Capability Actions Module
 *
 * Exports for executing capability-driven actions.
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

export * from "./types"
export * from "./registry"
export { executeCapabilityAction, type ExecuteActionInput } from "./executor"
export {
  useCapabilityAction,
  type UseCapabilityActionOptions,
  type UseCapabilityActionReturn,
} from "./useCapabilityAction"

// Import handlers to ensure registration
import "./handlers/invoice"
