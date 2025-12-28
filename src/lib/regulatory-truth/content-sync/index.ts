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
export {
  emitContentSyncEvent,
  MissingPointersError,
  type EmitEventParams,
  type EmitEventResult,
} from "./emit-event"
