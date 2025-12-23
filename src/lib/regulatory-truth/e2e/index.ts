// src/lib/regulatory-truth/e2e/index.ts
// Live E2E Testing Harness - exports

export {
  collectEnvironmentFingerprint,
  printFingerprintHeader,
  getRunFolderPath,
  type EnvironmentFingerprint,
} from "./environment-fingerprint"

export {
  validateInvariants,
  type InvariantStatus,
  type InvariantResult,
  type InvariantResults,
} from "./invariant-validator"

export {
  runAssistantSuite,
  getTestCoverage,
  type AssistantTestCase,
  type AssistantTestResult,
  type AssistantSuiteResults,
} from "./assistant-suite"

export {
  createSyntheticConflict,
  verifySyntheticConflictProcessed,
  cleanupOldHeartbeatConflicts,
  checkHeartbeatHealth,
} from "./synthetic-heartbeat"

export {
  generateReport,
  saveReport,
  formatSlackMessage,
  formatGitHubComment,
  type LiveRunReport,
} from "./report-generator"

export { runLiveE2E, type PhaseResult, type LiveRunResult, type RunMetrics } from "./live-runner"

export { runDataRepair, type RepairResult } from "./data-repair"
