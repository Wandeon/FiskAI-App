// src/lib/shared/queue-contracts/v1/payloads/system-status.ts
/**
 * System status job payload - system health refresh.
 * Queue: system-status
 * Job names: refresh
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * System status job payload schema.
 */
export const SystemStatusJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Job ID for tracking (maps to SystemStatusRefreshJob). */
  jobId: z.string().min(1),
  /** User ID who requested the refresh. */
  userId: z.string().min(1),
  /** Timeout in seconds for the refresh operation. */
  timeoutSeconds: z.number().int().positive(),
  /** Lock key for distributed locking. */
  lockKey: z.string().min(1),
})

export type SystemStatusJobV1 = z.infer<typeof SystemStatusJobV1Schema>

/**
 * Validate system status job payload.
 */
export function validateSystemStatusJob(data: unknown): SystemStatusJobV1 {
  return SystemStatusJobV1Schema.parse(data)
}

/**
 * Check if data is a valid system status job payload.
 */
export function isSystemStatusJobValid(data: unknown): data is SystemStatusJobV1 {
  return SystemStatusJobV1Schema.safeParse(data).success
}
