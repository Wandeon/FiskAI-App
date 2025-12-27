// src/lib/regulatory-truth/utils/adaptive-sentinel.ts

export { classifyUrl, applyRiskInheritance, type ClassificationResult } from "./node-classifier"
export {
  updateVelocity,
  describeVelocity,
  type VelocityUpdate,
  type VelocityConfig,
} from "./velocity-profiler"
export {
  calculateNextScan,
  calculateIntervalHours,
  describeInterval,
  type ScheduleConfig,
} from "./scan-scheduler"
