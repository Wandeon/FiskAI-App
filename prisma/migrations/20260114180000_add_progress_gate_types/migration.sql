-- PR-2: Add progress gate check and alert types for pipeline stage stall detection
-- These types enable monitoring of Evidence→SourcePointer, SourcePointer→Rule, and Approved→Published transitions

-- Add new check types for progress gate monitoring
ALTER TYPE "WatchdogCheckType" ADD VALUE IF NOT EXISTS 'PROGRESS_GATE_EVIDENCE';
ALTER TYPE "WatchdogCheckType" ADD VALUE IF NOT EXISTS 'PROGRESS_GATE_EXTRACTION';
ALTER TYPE "WatchdogCheckType" ADD VALUE IF NOT EXISTS 'PROGRESS_GATE_RELEASE';

-- Add new alert types for progress stall notifications
ALTER TYPE "WatchdogAlertType" ADD VALUE IF NOT EXISTS 'PROGRESS_STALL_EVIDENCE';
ALTER TYPE "WatchdogAlertType" ADD VALUE IF NOT EXISTS 'PROGRESS_STALL_EXTRACTION';
ALTER TYPE "WatchdogAlertType" ADD VALUE IF NOT EXISTS 'PROGRESS_STALL_RELEASE';
