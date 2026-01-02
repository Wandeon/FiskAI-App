/**
 * Action Handler Registry
 *
 * A registry for storing and retrieving action handlers by capability and action ID.
 * Uses a Map with composite keys in the format "capabilityId:actionId".
 *
 * @module capabilities/actions
 * @since PHASE 2 - Capability-Driven Actions
 */

import type { ActionRegistryEntry } from "./types"

/**
 * Internal storage for action handlers.
 * Key format: "capabilityId:actionId" (e.g., "INV-003:fiscalize")
 */
const registry = new Map<string, ActionRegistryEntry>()

/**
 * Creates a registry key from capability and action IDs.
 *
 * @param capabilityId - The capability ID (e.g., "INV-003")
 * @param actionId - The action ID (e.g., "fiscalize")
 * @returns Composite key in format "capabilityId:actionId"
 */
function makeKey(capabilityId: string, actionId: string): string {
  return `${capabilityId}:${actionId}`
}

/**
 * Registers an action handler in the registry.
 *
 * If a handler already exists for the same capability/action combination,
 * it will be overwritten.
 *
 * @param entry - The registry entry containing the handler and metadata
 *
 * @example
 * ```typescript
 * registerActionHandler({
 *   capabilityId: "INV-003",
 *   actionId: "fiscalize",
 *   handler: fiscalizeInvoiceHandler,
 *   permission: "invoices:fiscalize",
 * })
 * ```
 */
export function registerActionHandler(entry: ActionRegistryEntry): void {
  const key = makeKey(entry.capabilityId, entry.actionId)
  registry.set(key, entry)
}

/**
 * Retrieves an action handler from the registry.
 *
 * @param capabilityId - The capability ID (e.g., "INV-003")
 * @param actionId - The action ID (e.g., "fiscalize")
 * @returns The registry entry if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const entry = getActionHandler("INV-003", "fiscalize")
 * if (entry) {
 *   const result = await entry.handler(context, params)
 * }
 * ```
 */
export function getActionHandler(
  capabilityId: string,
  actionId: string
): ActionRegistryEntry | undefined {
  const key = makeKey(capabilityId, actionId)
  return registry.get(key)
}

/**
 * Returns all registered action handlers.
 *
 * @returns Array of all registry entries (new array instance)
 *
 * @example
 * ```typescript
 * const handlers = getAllHandlers()
 * handlers.forEach(entry => {
 *   console.log(`${entry.capabilityId}:${entry.actionId}`)
 * })
 * ```
 */
export function getAllHandlers(): ActionRegistryEntry[] {
  return Array.from(registry.values())
}

/**
 * Clears all handlers from the registry.
 *
 * Primarily intended for testing to ensure test isolation.
 *
 * @example
 * ```typescript
 * // In test setup
 * beforeEach(() => {
 *   clearRegistry()
 * })
 * ```
 */
export function clearRegistry(): void {
  registry.clear()
}
