/**
 * A/B Testing & Experimentation Framework
 *
 * Complete A/B testing infrastructure with:
 * - Experiment management (CRUD operations)
 * - User assignment with sticky sessions
 * - Event tracking
 * - Statistical analysis
 * - PostHog integration
 *
 * @see GitHub issue #292
 */

// Types
export * from "./types"

// Experiment management
export {
  createExperiment,
  getExperiment,
  getExperimentByName,
  listExperiments,
  updateExperiment,
  startExperiment,
  pauseExperiment,
  completeExperiment,
  cancelExperiment,
  deleteExperiment,
  getActiveExperiments,
  isExperimentActive,
} from "./manager"

// User assignment
export {
  assignUserToExperiment,
  getUserAssignment,
  getUserExperiments,
  markExposure,
  markConversion,
  batchAssignUsers,
} from "./assignment"

// Event tracking
export {
  trackExperimentEvent,
  trackExposure,
  trackEnrollment,
  trackConversion,
  getExperimentEvents,
  getUserExperimentEvents,
  getEventCountsByType,
  getEventCountsByName,
} from "./tracking"

// Statistical analysis
export {
  getExperimentMetrics,
  calculateVariantMetrics,
  calculateSignificance,
  calculateRequiredSampleSize,
  getExperimentReport,
  compareMultipleVariants,
} from "./analysis"
