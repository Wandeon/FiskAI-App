/**
 * Capabilities Module
 *
 * Provides capability resolution for determining what actions
 * are available to users and AI agents.
 *
 * @module capabilities
 * @since Enterprise Hardening - Capability Resolution API
 */

// Types
export type {
  CapabilityState,
  CapabilityInput,
  CapabilityBlocker,
  CapabilityAction,
  CapabilityResponse,
  CapabilityRequest,
  CapabilityMetadata,
} from "./types"

// Registry
export {
  CAPABILITY_REGISTRY,
  CAPABILITY_BY_ID,
  getCapabilityMetadata,
  getCapabilitiesByDomain,
  getCapabilitiesAffectingEntity,
} from "./registry"

// Resolver
export { resolveCapability, resolveCapabilities } from "./resolver"

// Server utilities (for server components)
export {
  resolveCapabilitiesForUser,
  resolveCapabilityForUser,
  resolveCapabilitiesByDomain,
} from "./server"

// Actions module
export * from "./actions"
