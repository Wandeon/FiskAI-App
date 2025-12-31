// src/lib/regulatory-truth/content-sync/index.ts
/**
 * RTL -> Content Sync Module
 *
 * This module handles the synchronization of regulatory changes from the
 * Regulatory Truth Layer to the content management system (MDX guides).
 */

// Types
export type {
  ContentDomain,
  ContentSyncEventSignature,
  ContentSyncEventV1,
  ChangeType,
  ValueType,
  EventSeverity,
} from "./types"

export { mapRtlDomainToContentDomain, isContentSyncEventV1 } from "./types"

// Event ID generation
export {
  generateEventId,
  hashSourcePointerIds,
  determineSeverity,
  buildEventSignature,
} from "./event-id"

// Event emitter
export { emitContentSyncEvent, type EmitEventParams, type EmitEventResult } from "./emit-event"

// Concept registry
export type { ConceptMapping } from "./concept-registry"
export {
  CONCEPT_REGISTRY,
  getConceptMapping,
  resolveContentPaths,
  getAllConceptIds,
  getConceptsForFile,
  getConceptsForTool,
} from "./concept-registry"

// Errors
export type { ClassifiedError } from "./errors"
export {
  ContentSyncError,
  // PERMANENT errors
  UnmappedConceptError,
  InvalidPayloadError,
  MissingPointersError,
  ContentNotFoundError,
  FrontmatterParseError,
  PatchConflictError,
  // TRANSIENT errors
  RepoWriteFailedError,
  DbWriteFailedError,
  // Classification
  classifyError,
} from "./errors"

// Frontmatter patcher
export type { ChangelogEntry, RtlFrontmatter, MdxReadResult } from "./patcher"
export {
  readMdxFrontmatter,
  writeMdxFile,
  generateChangelogSummary,
  createChangelogEntry,
  patchFrontmatter,
} from "./patcher"

// Repository adapter
export type { ContentRepoAdapter, CreatePRParams, GeneratePRBodyParams } from "./repo-adapter"
export {
  GitContentRepoAdapter,
  generateBranchName,
  generatePRTitle,
  generatePRBody,
} from "./repo-adapter"
