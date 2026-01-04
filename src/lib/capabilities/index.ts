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

// NOTE: Server utilities are intentionally NOT exported from this barrel file
// to prevent server-only code (period-locking, auth, redis) from being bundled
// into client components. Import directly when needed in server code:
//
//   import { resolveCapability, resolveCapabilities } from "@/lib/capabilities/resolver"
//   import { resolveCapabilitiesForUser } from "@/lib/capabilities/server"
//   import { executeCapability } from "@/lib/capabilities/actions"
