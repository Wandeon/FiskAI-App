// src/lib/shared/queue-contracts/v1/payloads/index.ts
/**
 * Barrel export for all v1 queue payload schemas.
 */

// Sentinel
export {
  SentinelJobV1Schema,
  type SentinelJobV1,
  DiscoveryPrioritySchema,
  type DiscoveryPriority,
  validateSentinelJob,
  isSentinelJobValid,
} from "./sentinel"

// Scout
export { ScoutJobV1Schema, type ScoutJobV1, validateScoutJob, isScoutJobValid } from "./scout"

// Router
export {
  RouterJobV1Schema,
  type RouterJobV1,
  ScoutResultSchema,
  type ScoutResult,
  validateRouterJob,
  isRouterJobValid,
} from "./router"

// OCR
export { OcrJobV1Schema, type OcrJobV1, validateOcrJob, isOcrJobValid } from "./ocr"

// Extract
export {
  ExtractJobV1Schema,
  type ExtractJobV1,
  LLMProviderSchema,
  type LLMProvider,
  validateExtractJob,
  isExtractJobValid,
} from "./extract"

// Compose
export {
  ComposeJobV1Schema,
  type ComposeJobV1,
  validateComposeJob,
  isComposeJobValid,
} from "./compose"

// Apply
export {
  ApplyJobV1Schema,
  type ApplyJobV1,
  ComposerProposalV1Schema,
  type ComposerProposalV1,
  ComposerOutputSchema,
  type ComposerOutput,
  validateApplyJob,
  isApplyJobValid,
} from "./apply"

// Review
export { ReviewJobV1Schema, type ReviewJobV1, validateReviewJob, isReviewJobValid } from "./review"

// Arbiter
export {
  ArbiterJobV1Schema,
  type ArbiterJobV1,
  validateArbiterJob,
  isArbiterJobValid,
} from "./arbiter"

// Release
export {
  ReleaseJobV1Schema,
  type ReleaseJobV1,
  validateReleaseJob,
  isReleaseJobValid,
} from "./release"

// Scheduled
export {
  ScheduledJobV1Schema,
  type ScheduledJobV1,
  ScheduledJobTypeSchema,
  type ScheduledJobType,
  validateScheduledJob,
  isScheduledJobValid,
} from "./scheduled"

// Article
export {
  ArticleJobV1Schema,
  type ArticleJobV1,
  ArticleTypeSchema,
  type ArticleType,
  ArticleActionSchema,
  type ArticleAction,
  ArticleMetadataSchema,
  type ArticleMetadata,
  validateArticleJob,
  isArticleJobValid,
} from "./article"

// Backup
export {
  BackupJobV1Schema,
  type BackupJobV1,
  BackupFrequencySchema,
  type BackupFrequency,
  validateBackupJob,
  isBackupJobValid,
} from "./backup"

// System Status
export {
  SystemStatusJobV1Schema,
  type SystemStatusJobV1,
  validateSystemStatusJob,
  isSystemStatusJobValid,
} from "./system-status"

// Dead Letter
export {
  DeadLetterJobV1Schema,
  type DeadLetterJobV1,
  ErrorCategorySchema,
  type ErrorCategory,
  validateDeadLetterJob,
  isDeadLetterJobValid,
} from "./deadletter"
