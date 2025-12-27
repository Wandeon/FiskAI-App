// src/lib/assistant/reasoning/event-factory.ts
import {
  REASONING_EVENT_VERSION,
  type ReasoningEvent,
  type ReasoningStage,
  type EventStatus,
  type EventSeverity,
  type StagePayload,
} from "./types"

export interface EventEmitOptions {
  stage: ReasoningStage
  status: EventStatus
  message?: string
  severity?: EventSeverity
  progress?: { current: number; total?: number }
  data?: StagePayload
  meta?: Record<string, unknown>
}

export interface EventFactory {
  emit(options: EventEmitOptions): ReasoningEvent
  getSequence(): number
  getRequestId(): string
}

export function createEventFactory(requestId: string): EventFactory {
  let seq = 0

  return {
    emit(options: EventEmitOptions): ReasoningEvent {
      const currentSeq = seq++
      const paddedSeq = String(currentSeq).padStart(3, "0")

      return {
        v: REASONING_EVENT_VERSION,
        id: `${requestId}_${paddedSeq}`,
        requestId,
        seq: currentSeq,
        ts: new Date().toISOString(),
        stage: options.stage,
        status: options.status,
        ...(options.message && { message: options.message }),
        ...(options.severity && { severity: options.severity }),
        ...(options.progress && { progress: options.progress }),
        ...(options.data && { data: options.data }),
        ...(options.meta && { meta: options.meta }),
      }
    },

    getSequence(): number {
      return seq
    },

    getRequestId(): string {
      return requestId
    },
  }
}
