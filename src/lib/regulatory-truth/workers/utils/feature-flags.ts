// src/lib/regulatory-truth/workers/utils/feature-flags.ts

/**
 * Feature flags evaluated at drainer level (single source of truth)
 *
 * Kill switch pattern: All feature flags are evaluated in one place (the drainer)
 * rather than in individual workers. This ensures:
 * 1. Single point of control for enabling/disabling features
 * 2. Consistent behavior across the pipeline
 * 3. Easy rollback in production emergencies
 */
export const FeatureFlags = {
  /**
   * Classification kill switch (Task 11 - Docker Worker Infrastructure Hardening)
   *
   * When false: drainer queues directly to extraction (legacy behavior)
   * When true: drainer queues to classifier first (pre-extraction classification)
   *
   * Default: false (legacy mode - direct to extraction)
   * This ensures safe deployment - classification is opt-in until fully tested.
   *
   * To enable classification in production:
   *   CLASSIFICATION_ENABLED=true
   */
  get classificationEnabled(): boolean {
    return process.env.CLASSIFICATION_ENABLED === "true"
  },
} as const
