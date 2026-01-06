/**
 * Feature flags for phased migration.
 * Phase 5 will remove these and enforce new paths.
 */

export const FEATURE_FLAGS = {
  /**
   * Phase 2: Use IntegrationAccount for outbound e-invoice sends.
   * When false, uses legacy Company.eInvoiceApiKeyEncrypted path.
   */
  USE_INTEGRATION_ACCOUNT_OUTBOUND: process.env.FF_INTEGRATION_ACCOUNT_OUTBOUND === "true",

  /**
   * Phase 3: Use IntegrationAccount for inbound e-invoice polling.
   */
  USE_INTEGRATION_ACCOUNT_INBOUND: process.env.FF_INTEGRATION_ACCOUNT_INBOUND === "true",

  /**
   * Phase 4: Use IntegrationAccount for fiscalization.
   */
  USE_INTEGRATION_ACCOUNT_FISCAL: process.env.FF_INTEGRATION_ACCOUNT_FISCAL === "true",

  /**
   * Phase 5: Enforce IntegrationAccount for all regulated actions.
   * When true, legacy paths throw errors.
   */
  ENFORCE_INTEGRATION_ACCOUNT: process.env.FF_ENFORCE_INTEGRATION_ACCOUNT === "true",

  /**
   * Phase 5 Shadow Mode: Log legacy path usage without blocking.
   * When true (and ENFORCE_INTEGRATION_ACCOUNT=false), emits structured logs
   * for operations that WOULD have been blocked if enforcement was enabled.
   * Use this for Stage 2 production soft-fail monitoring.
   */
  LOG_LEGACY_PATH_USAGE: process.env.FF_LOG_LEGACY_PATH_USAGE === "true",
} as const

export function isFeatureEnabled(flag: keyof typeof FEATURE_FLAGS): boolean {
  return FEATURE_FLAGS[flag]
}
