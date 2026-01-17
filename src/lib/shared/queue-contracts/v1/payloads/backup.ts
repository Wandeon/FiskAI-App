// src/lib/shared/queue-contracts/v1/payloads/backup.ts
/**
 * Backup job payload - scheduled company data backups.
 * Queue: backup
 * Job names: scheduled-backup, manual-backup
 */
import { z } from "zod"
import { JobEnvelopeV1Schema } from "../envelope"

/**
 * Backup frequency options.
 */
export const BackupFrequencySchema = z.enum(["daily", "weekly", "monthly"])
export type BackupFrequency = z.infer<typeof BackupFrequencySchema>

/**
 * Backup job payload schema.
 */
export const BackupJobV1Schema = JobEnvelopeV1Schema.extend({
  /** Company ID to backup. */
  companyId: z.string().min(1),
  /** Backup frequency. */
  frequency: BackupFrequencySchema,
  /** Email to notify upon completion. */
  notifyEmail: z.string().email().optional(),
  /** Number of days to retain backups. */
  retentionDays: z.number().int().positive().optional(),
  /** Scheduled backup time (ISO). */
  scheduledAt: z.string().datetime(),
  /** Whether this is a manual backup request. */
  manual: z.boolean().optional(),
})

export type BackupJobV1 = z.infer<typeof BackupJobV1Schema>

/**
 * Validate backup job payload.
 */
export function validateBackupJob(data: unknown): BackupJobV1 {
  return BackupJobV1Schema.parse(data)
}

/**
 * Check if data is a valid backup job payload.
 */
export function isBackupJobValid(data: unknown): data is BackupJobV1 {
  return BackupJobV1Schema.safeParse(data).success
}
